/**
 * Ad-watched token verification for rewarded-ad redeem flows.
 *
 * Two layers stacked on every call:
 *
 *  1. **Nonce idempotency** — a client-generated nonce (crypto.randomUUID)
 *     is inserted into `ad_redeem_nonces` (PK = nonce, table from
 *     migration 0006). A duplicate insert returns 0 changes which we
 *     translate to `DUPLICATE_NONCE`. This guards against a single ad
 *     view being redeemed against multiple channels (watering / gift /
 *     treasure / item_use) or against a single channel twice.
 *
 *  2. **HMAC signature** (optional) — when `env.TOSS_AD_VERIFY_KEY` is
 *     configured the caller must also pass `signedToken`, which is
 *     verified as base64url(HMAC-SHA256(key, `${userKey}:${channel}:${nonce}`)).
 *     When the key is NOT configured we skip the signature check — this
 *     is the preview / staging mode where any client can pass any nonce
 *     and only the idempotency check runs.
 *
 * The function never throws — every failure mode is returned as a
 * tagged `AdTokenFail`. Callers map the tag to an HTTP status. See
 * routes/tools.ts and routes/items.ts for usage.
 */

import type { D1Database } from "@cloudflare/workers-types";

export type AdTokenChannel = "watering" | "gift" | "treasure" | "item_use";

export type AdTokenError =
  | "MISSING_NONCE"
  | "INVALID_SIG"
  | "DUPLICATE_NONCE"
  | "SCHEMA_NOT_READY";

export interface AdTokenOk {
  ok: true;
}

export interface AdTokenFail {
  ok: false;
  error: AdTokenError;
  message: string;
}

export type AdTokenResult = AdTokenOk | AdTokenFail;

export interface VerifyAdTokenOptions {
  db: D1Database;
  userKey: string;
  channel: AdTokenChannel;
  /** Per-redeem nonce (client-generated, ≥ 8 chars). Required. */
  nonce: string | undefined;
  /** base64url(HMAC-SHA256(key, "${userKey}:${channel}:${nonce}")). */
  signedToken?: string;
  /** env.TOSS_AD_VERIFY_KEY. Absent → preview/staging mode, signature check skipped. */
  verifyKey?: string;
}

const MIN_NONCE_LEN = 8;

export async function verifyAdToken(
  opts: VerifyAdTokenOptions,
): Promise<AdTokenResult> {
  const { db, userKey, channel, nonce, signedToken, verifyKey } = opts;

  if (typeof nonce !== "string" || nonce.length < MIN_NONCE_LEN) {
    return { ok: false, error: "MISSING_NONCE", message: "nonce required" };
  }

  if (verifyKey) {
    if (typeof signedToken !== "string" || signedToken.length === 0) {
      return { ok: false, error: "INVALID_SIG", message: "signedToken required" };
    }
    const sigOk = await verifyHmacSha256(
      `${userKey}:${channel}:${nonce}`,
      signedToken,
      verifyKey,
    );
    if (!sigOk) {
      return { ok: false, error: "INVALID_SIG", message: "signature mismatch" };
    }
  }

  try {
    const res = await db
      .prepare(
        `INSERT OR IGNORE INTO ad_redeem_nonces (nonce, user_key, channel)
         VALUES (?, ?, ?)`,
      )
      .bind(nonce, userKey, channel)
      .run();
    const changes = res.meta?.changes ?? 0;
    if (changes === 0) {
      return {
        ok: false,
        error: "DUPLICATE_NONCE",
        message: "nonce already redeemed",
      };
    }
  } catch (err) {
    console.warn("verifyAdToken insert failed (migration not applied?)", err);
    return {
      ok: false,
      error: "SCHEMA_NOT_READY",
      message: "ad_redeem_nonces missing — apply migration 0006",
    };
  }

  return { ok: true };
}

async function verifyHmacSha256(
  payload: string,
  signedToken: string,
  key: string,
): Promise<boolean> {
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(payload),
    );
    const expected = base64UrlEncode(new Uint8Array(sig));
    return timingSafeEqual(expected, signedToken.trim());
  } catch {
    return false;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) {
    acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return acc === 0;
}
