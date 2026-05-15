import type { Env } from "../types.js";

// Apps in Toss OAuth — env.TOSS_MTLS.fetch() 로 mTLS 핸드셰이크.
// base: https://apps-in-toss-api.toss.im
//
// 공식 가이드:
//   https://developers-apps-in-toss.toss.im/login/develop.html
//   https://developers-apps-in-toss.toss.im/api/overview.html
//
// 응답 envelope:
//   성공: { resultType: "SUCCESS", success: { ... } }
//   실패: { resultType: "FAIL", error: { ... } }
// 일부 엔드포인트는 top-level 형태로 돌려주기도 하므로 두 형태를 모두 지원한다.

interface GenerateTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface UpstreamDiag {
  status: number;
  // 응답 body 의 앞부분 — 토큰/PII 는 redact 한 뒤에만 남긴다.
  bodySnippet: string;
}

export interface MtlsHandshakeError {
  error: "MTLS_HANDSHAKE_FAILED";
  message: string;
}

export interface UpstreamError {
  error:
    | "TOKEN_EXCHANGE_FAILED"
    | "USERINFO_FAILED"
    | "TOKEN_RESPONSE_INVALID"
    | "USERINFO_RESPONSE_INVALID";
  upstream: UpstreamDiag;
}

export interface PromotionUpstreamError {
  error: "PROMOTION_FAILED" | "PROMOTION_RESPONSE_INVALID" | "PROMOTION_CONFIG_REQUIRED";
  upstream: UpstreamDiag;
}

export type TossError = MtlsHandshakeError | UpstreamError;
export type PromotionError = MtlsHandshakeError | PromotionUpstreamError;

export function isTossError(v: unknown): v is TossError {
  if (!v || typeof v !== "object") return false;
  const e = (v as { error?: unknown }).error;
  return (
    e === "MTLS_HANDSHAKE_FAILED" ||
    e === "TOKEN_EXCHANGE_FAILED" ||
    e === "USERINFO_FAILED" ||
    e === "TOKEN_RESPONSE_INVALID" ||
    e === "USERINFO_RESPONSE_INVALID"
  );
}

export function isPromotionError(v: unknown): v is PromotionError {
  if (!v || typeof v !== "object") return false;
  const e = (v as { error?: unknown }).error;
  return (
    e === "MTLS_HANDSHAKE_FAILED" ||
    e === "PROMOTION_FAILED" ||
    e === "PROMOTION_RESPONSE_INVALID" ||
    e === "PROMOTION_CONFIG_REQUIRED"
  );
}

const BODY_SNIPPET_MAX = 512;

// 로그/에러 응답에 절대 노출하면 안 되는 키. 토큰/PII/암호화 필드 모두 포함.
const SENSITIVE_KEYS = new Set([
  "accessToken",
  "refreshToken",
  "token",
  "id_token",
  "idToken",
  "authorizationCode",
  "ci",
  "di",
  "phone",
  "phoneNumber",
  "email",
  "name",
  "userKey",
  "birthday",
  "birth",
  "gender",
  "address",
]);

function redactValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redactValue);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactValue(val);
      }
    }
    return out;
  }
  return v;
}

/**
 * 외부에 노출 가능한 redacted snippet 을 만든다.
 *  - JSON 으로 파싱되면 sensitive key 값을 [REDACTED] 로 치환한 뒤 재직렬화.
 *  - JWT 모양 (header.payload.sig) 텍스트는 [REDACTED_JWT] 로 마스킹.
 *  - 길이는 BODY_SNIPPET_MAX 까지로 제한.
 */
function redactSnippet(text: string): string {
  if (!text) return "";
  const parsed = (() => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  })();
  if (parsed !== undefined) {
    const safe = redactValue(parsed);
    const out = JSON.stringify(safe);
    return out.length > BODY_SNIPPET_MAX ? `${out.slice(0, BODY_SNIPPET_MAX)}…` : out;
  }
  const masked = text.replace(
    /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    "[REDACTED_JWT]",
  );
  return masked.length > BODY_SNIPPET_MAX ? `${masked.slice(0, BODY_SNIPPET_MAX)}…` : masked;
}

/**
 * 2xx 인데 기대한 필드를 못 찾은 parse-mismatch 진단용.
 * 본문은 절대 포함하지 않는다 (토큰이 들어 있을 수 있다). top-level key 목록과
 * resultType 만 노출한다.
 */
function safeShapeFromText(text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return `type=${typeof parsed}`;
    const obj = parsed as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const resultType = typeof obj.resultType === "string" ? obj.resultType : null;
    const successKeys =
      obj.success && typeof obj.success === "object"
        ? Object.keys(obj.success as Record<string, unknown>).sort()
        : null;
    return JSON.stringify({ keys, resultType, successKeys });
  } catch {
    return "non-json";
  }
}

function jsonHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "content-type": "application/json",
    accept: "application/json",
    ...(extra ?? {}),
  };
}

async function readBodyText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function tryParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface TossEnvelope {
  resultType?: string;
  success?: unknown;
  error?: unknown;
}

/**
 * Apps in Toss 응답 envelope 을 풀어 본문 객체를 돌려준다.
 *  - { resultType: "SUCCESS", success: <obj> } → <obj>
 *  - { resultType: "FAIL", error: ... } → fail
 *  - 그 외 (top-level 형태) → 원본 객체
 */
function unwrapEnvelope(parsed: unknown): {
  payload: Record<string, unknown> | null;
  fail: boolean;
} {
  if (!parsed || typeof parsed !== "object") {
    return { payload: null, fail: false };
  }
  const env = parsed as TossEnvelope;
  if (env.resultType === "SUCCESS") {
    if (env.success && typeof env.success === "object") {
      return { payload: env.success as Record<string, unknown>, fail: false };
    }
    return { payload: null, fail: false };
  }
  if (env.resultType === "FAIL") {
    return { payload: null, fail: true };
  }
  return { payload: parsed as Record<string, unknown>, fail: false };
}

/**
 * Apps in Toss OAuth — authorizationCode -> accessToken.
 * 모든 호출은 mTLS 바인딩 fetch 를 통해 이루어진다.
 *
 * 실패 분기:
 *   - MTLS_HANDSHAKE_FAILED: env.TOSS_MTLS.fetch() 자체가 throw 한 경우.
 *   - TOKEN_EXCHANGE_FAILED: 비-2xx 응답 또는 Toss resultType=FAIL.
 *   - TOKEN_RESPONSE_INVALID: 2xx + SUCCESS 인데 accessToken 을 못 찾은 경우.
 *     bodySnippet 에는 토큰을 절대 포함하지 않고 안전한 shape 만 남긴다.
 */
export async function exchangeAuthCode(
  env: Env,
  authorizationCode: string,
  referrer: string | undefined,
): Promise<GenerateTokenResponse | MtlsHandshakeError | UpstreamError> {
  const url = `${env.APPS_IN_TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`;
  let res: Response;
  try {
    res = await env.TOSS_MTLS.fetch(url, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ authorizationCode, referrer }),
    });
  } catch (e) {
    return {
      error: "MTLS_HANDSHAKE_FAILED",
      message: e instanceof Error ? e.message : "fetch threw",
    };
  }
  const text = await readBodyText(res);
  if (!res.ok) {
    return {
      error: "TOKEN_EXCHANGE_FAILED",
      upstream: { status: res.status, bodySnippet: redactSnippet(text) },
    };
  }
  const parsed = tryParseJson<unknown>(text);
  const unwrapped = unwrapEnvelope(parsed);
  if (unwrapped.fail) {
    return {
      error: "TOKEN_EXCHANGE_FAILED",
      upstream: { status: res.status, bodySnippet: redactSnippet(text) },
    };
  }
  const payload = unwrapped.payload as GenerateTokenResponse | null;
  if (!payload || typeof payload.accessToken !== "string") {
    return {
      error: "TOKEN_RESPONSE_INVALID",
      upstream: { status: res.status, bodySnippet: safeShapeFromText(text) },
    };
  }
  return payload;
}

export async function fetchLoginMe(
  env: Env,
  accessToken: string,
): Promise<Record<string, unknown> | MtlsHandshakeError | UpstreamError> {
  const url = `${env.APPS_IN_TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/login-me`;
  let res: Response;
  try {
    res = await env.TOSS_MTLS.fetch(url, {
      method: "GET",
      // 공식 문서: Authorization: Bearer ${AccessToken}
      // https://developers-apps-in-toss.toss.im/login/develop.html
      headers: jsonHeaders({ authorization: `Bearer ${accessToken}` }),
    });
  } catch (e) {
    return {
      error: "MTLS_HANDSHAKE_FAILED",
      message: e instanceof Error ? e.message : "fetch threw",
    };
  }
  const text = await readBodyText(res);
  if (!res.ok) {
    return {
      error: "USERINFO_FAILED",
      upstream: { status: res.status, bodySnippet: redactSnippet(text) },
    };
  }
  const parsed = tryParseJson<unknown>(text);
  const unwrapped = unwrapEnvelope(parsed);
  if (unwrapped.fail) {
    return {
      error: "USERINFO_FAILED",
      upstream: { status: res.status, bodySnippet: redactSnippet(text) },
    };
  }
  const payload = unwrapped.payload;
  if (!payload || typeof payload !== "object") {
    return {
      error: "USERINFO_RESPONSE_INVALID",
      upstream: { status: res.status, bodySnippet: safeShapeFromText(text) },
    };
  }
  return payload;
}

/**
 * Toss executePromotion — server-to-server payout request.
 *
 * Endpoint contract (per Apps in Toss Promotion / 보상금 API):
 *   POST  ${TOSS_PROMOTION_API_BASE}/api-partner/v1/promotions/execute
 *   Headers:
 *     authorization:  Bearer ${TOSS_PROMOTION_API_KEY}
 *     content-type:   application/json
 *     Idempotency-Key: <idempotencyKey>
 *   Body: { userKey, amount, idempotencyKey }
 *   Response (success): { resultType: "SUCCESS", success: { transactionId, status } }
 *   Response (fail):    { resultType: "FAIL",    error: {...} }
 *
 * IMPORTANT — money path:
 *   - This function is NEVER called from a cron or autoplay path. Only
 *     `/economy/withdraw` invokes it, after a CAS decrement of
 *     pending_points. Caller must guarantee the idempotencyKey is
 *     stable for the same logical attempt (we use the
 *     promotion_withdrawals row id as `cc-w-<id>`).
 *   - If the two env vars are not configured the function returns
 *     PROMOTION_CONFIG_REQUIRED without touching the network. The
 *     route layer normally checks this first; the guard here is
 *     defense-in-depth.
 */
export interface PromotionExecutionResult {
  txid: string;
  status: "succeeded" | "pending" | "failed";
}

export interface PromotionExecuteEnv {
  TOSS_PROMOTION_API_BASE?: string;
  TOSS_PROMOTION_API_KEY?: string;
  TOSS_MTLS: Fetcher;
}

export async function executePromotion(
  env: PromotionExecuteEnv,
  userKey: string,
  amountP: number,
  idempotencyKey: string,
): Promise<PromotionExecutionResult | PromotionError> {
  if (!env.TOSS_PROMOTION_API_BASE || !env.TOSS_PROMOTION_API_KEY) {
    return {
      error: "PROMOTION_CONFIG_REQUIRED",
      upstream: { status: 0, bodySnippet: "missing TOSS_PROMOTION_API_BASE/KEY" },
    };
  }
  const url = `${env.TOSS_PROMOTION_API_BASE}/api-partner/v1/promotions/execute`;
  let res: Response;
  try {
    res = await env.TOSS_MTLS.fetch(url, {
      method: "POST",
      headers: jsonHeaders({
        authorization: `Bearer ${env.TOSS_PROMOTION_API_KEY}`,
        "Idempotency-Key": idempotencyKey,
      }),
      body: JSON.stringify({ userKey, amount: amountP, idempotencyKey }),
    });
  } catch (e) {
    return {
      error: "MTLS_HANDSHAKE_FAILED",
      message: e instanceof Error ? e.message : "fetch threw",
    };
  }
  const text = await readBodyText(res);
  if (!res.ok) {
    return {
      error: "PROMOTION_FAILED",
      upstream: { status: res.status, bodySnippet: redactSnippet(text) },
    };
  }
  const parsed = tryParseJson<unknown>(text);
  const unwrapped = unwrapEnvelope(parsed);
  if (unwrapped.fail) {
    return {
      error: "PROMOTION_FAILED",
      upstream: { status: res.status, bodySnippet: redactSnippet(text) },
    };
  }
  const payload = unwrapped.payload as
    | { transactionId?: unknown; status?: unknown }
    | null;
  if (!payload || typeof payload.transactionId !== "string") {
    return {
      error: "PROMOTION_RESPONSE_INVALID",
      upstream: { status: res.status, bodySnippet: safeShapeFromText(text) },
    };
  }
  const status: PromotionExecutionResult["status"] =
    payload.status === "succeeded" || payload.status === "pending" || payload.status === "failed"
      ? payload.status
      : "pending";
  return { txid: payload.transactionId, status };
}

export async function refreshAccessToken(
  env: Env,
  refreshToken: string,
): Promise<RefreshTokenResponse | MtlsHandshakeError | UpstreamError> {
  const url = `${env.APPS_IN_TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/refresh-token`;
  let res: Response;
  try {
    res = await env.TOSS_MTLS.fetch(url, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ refreshToken }),
    });
  } catch (e) {
    return {
      error: "MTLS_HANDSHAKE_FAILED",
      message: e instanceof Error ? e.message : "fetch threw",
    };
  }
  const text = await readBodyText(res);
  if (!res.ok) {
    return {
      error: "TOKEN_EXCHANGE_FAILED",
      upstream: { status: res.status, bodySnippet: redactSnippet(text) },
    };
  }
  const parsed = tryParseJson<unknown>(text);
  const unwrapped = unwrapEnvelope(parsed);
  if (unwrapped.fail) {
    return {
      error: "TOKEN_EXCHANGE_FAILED",
      upstream: { status: res.status, bodySnippet: redactSnippet(text) },
    };
  }
  const payload = unwrapped.payload as RefreshTokenResponse | null;
  if (!payload || typeof payload.accessToken !== "string") {
    return {
      error: "TOKEN_RESPONSE_INVALID",
      upstream: { status: res.status, bodySnippet: safeShapeFromText(text) },
    };
  }
  return payload;
}
