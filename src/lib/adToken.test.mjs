/**
 * verifyAdToken unit tests — exercises nonce idempotency + HMAC signature
 * paths. The worker lib is loaded via the esbuild TS transform (see
 * _test-helpers.mjs) so we can run it under `node --test` without a
 * Cloudflare runtime.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { webcrypto } from "node:crypto";
import { loadTs } from "./_test-helpers.mjs";

// Node 22's globalThis.crypto already exposes subtle, but on older
// runners (or under --test isolation) we wire it manually so the worker
// helper sees the same surface as the Workers runtime.
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto;
}

const mod = await loadTs(
  "../../cloudflare/workers/carrot-carrot-api/src/lib/adToken.ts",
  import.meta.url,
);
const { verifyAdToken } = mod;

/** Stub D1Database that mimics prepare→bind→run with an in-memory nonce set. */
function makeDb(opts = {}) {
  const inserted = new Set();
  const db = {
    inserted,
    prepare: () => ({
      bind: (...args) => ({
        run: async () => {
          if (opts.fail) throw new Error("schema_not_ready");
          const [nonce] = args;
          if (inserted.has(nonce)) {
            return { meta: { changes: 0 } };
          }
          inserted.add(nonce);
          return { meta: { changes: 1 } };
        },
      }),
    }),
  };
  return db;
}

async function makeSignedToken(key, payload) {
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
  const bytes = new Uint8Array(sig);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

test("verifyAdToken: missing nonce → MISSING_NONCE", async () => {
  const db = makeDb();
  const r = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "watering",
    nonce: undefined,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "MISSING_NONCE");
});

test("verifyAdToken: short nonce (< 8) → MISSING_NONCE", async () => {
  const db = makeDb();
  const r = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "watering",
    nonce: "short",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "MISSING_NONCE");
});

test("verifyAdToken: valid nonce inserts and returns ok", async () => {
  const db = makeDb();
  const r = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "watering",
    nonce: "abcdef1234",
  });
  assert.equal(r.ok, true);
  assert.equal(db.inserted.size, 1);
});

test("verifyAdToken: duplicate nonce returns DUPLICATE_NONCE", async () => {
  const db = makeDb();
  const first = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "watering",
    nonce: "abcdef1234",
  });
  assert.equal(first.ok, true);
  const dup = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "watering",
    nonce: "abcdef1234",
  });
  assert.equal(dup.ok, false);
  assert.equal(dup.error, "DUPLICATE_NONCE");
});

test("verifyAdToken: verifyKey set + no signedToken → INVALID_SIG", async () => {
  const db = makeDb();
  const r = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "watering",
    nonce: "abcdef1234",
    verifyKey: "test-secret",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "INVALID_SIG");
  // Crucially, nonce must NOT be marked redeemed on a bad-sig attempt
  // — otherwise a replay attacker could DoS the user's nonce pool.
  assert.equal(db.inserted.size, 0);
});

test("verifyAdToken: valid HMAC signature passes", async () => {
  const db = makeDb();
  const key = "test-secret";
  const nonce = "abcdef1234567890";
  const signedToken = await makeSignedToken(key, `u1:watering:${nonce}`);
  const r = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "watering",
    nonce,
    signedToken,
    verifyKey: key,
  });
  assert.equal(r.ok, true);
});

test("verifyAdToken: wrong signature → INVALID_SIG", async () => {
  const db = makeDb();
  const r = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "watering",
    nonce: "abcdef1234",
    signedToken: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    verifyKey: "test-secret",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "INVALID_SIG");
});

test("verifyAdToken: signature bound to channel (cross-channel replay fails)", async () => {
  const db = makeDb();
  const key = "test-secret";
  const nonce = "abcdef1234567890";
  // Signature minted for "watering" channel.
  const signedToken = await makeSignedToken(key, `u1:watering:${nonce}`);
  // …but submitted against "gift" channel.
  const r = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "gift",
    nonce,
    signedToken,
    verifyKey: key,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "INVALID_SIG");
});

test("verifyAdToken: DB throws → SCHEMA_NOT_READY", async () => {
  const db = makeDb({ fail: true });
  const r = await verifyAdToken({
    db,
    userKey: "u1",
    channel: "watering",
    nonce: "abcdef1234",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "SCHEMA_NOT_READY");
});
