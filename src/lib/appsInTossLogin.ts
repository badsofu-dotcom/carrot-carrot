/**
 * Apps in Toss Login 어댑터.
 *
 * 흐름 (Apps in Toss 공식 가이드):
 *   1) 클라이언트가 SDK `appLogin()` 호출 → 토스 앱이 사용자에게 동의 화면을 띄우고
 *      `{ authorizationCode, referrer }` 를 반환.
 *   2) Cloudflare Worker `${VITE_APPS_IN_TOSS_PROXY_URL}/login` 으로
 *      `{ authorizationCode, referrer }` 를 그대로 보낸다.
 *      Worker 가 mTLS 바인딩으로 토스 generate-token / login-me 를 호출하고
 *      AES-GCM 으로 userKey 를 복호화한 뒤 D1 에 upsert 후 자체 JWT 를 돌려준다.
 *   3) 일반 브라우저 / Perplexity preview 등에서는 `VITE_TOSS_AUTH_MOCK=true`
 *      또는 `VITE_MOCK_AUTH=true` 로 mock 통과.
 *
 * 보안:
 *   - mTLS 인증서 / DECRYPTION_KEY 는 어떤 경우에도 frontend 에 두지 않는다.
 *   - 사용자 personal_data 는 client 에 도달시키지 않고, gate 는 통과 boolean
 *     + 우리쪽 userKey 만 safeSessionStorage 에 기록한다.
 *
 * 절대 throw 하지 않는다. 모든 결과는 `LoginResult.kind` 로 표현.
 */

import { tokenStore } from "./api";
import { safeSessionStorage } from "./safeStorage";
import {
  appLogin as appsInTossAppLogin,
  getTossAppVersion,
} from "@apps-in-toss/web-framework";

/**
 * Apps in Toss 진단 빌드 마커.
 * NETWORK_ERROR 발생 시 게이트 화면에 같은 문자열이 표시되어
 * 어떤 빌드가 디바이스에 설치되어 있는지 확인할 수 있다.
 */
export const LOGIN_DIAG_BUILD = "diag-20260504-1345";

export type LoginErrorCode =
  | "AUTHORIZE_FAILED"
  | "TOKEN_EXCHANGE_FAILED"
  | "USERINFO_FAILED"
  | "DECRYPT_FAILED"
  | "MTLS_HANDSHAKE_FAILED"
  | "DB_WRITE_FAILED"
  | "SDK_NOT_FOUND"
  | "ENV_NOT_APPS_IN_TOSS"
  | "SERVER_ENV_MISSING"
  | "AUTHORIZE_CANCELLED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

/**
 * NETWORK_ERROR 발생 시에만 채워지는 진단 정보.
 * 토큰/authorizationCode/PII 는 절대 포함하지 않는다.
 */
export interface LoginNetworkDiag {
  build: string;
  workerUrl: string;
  attemptedUrl: string;
  hasAuthCode: "yes" | "no";
  fetchErrorName?: string;
  fetchErrorMessage?: string;
  healthStatus?: number;
  healthOk?: boolean;
  healthBody?: string;
  healthErrorName?: string;
  healthErrorMessage?: string;
}

export type LoginResult =
  | { kind: "ok"; via: "apps-in-toss" | "mock"; userKey?: string; nickname?: string }
  | { kind: "fail"; code: LoginErrorCode; detail?: string; networkDiag?: LoginNetworkDiag }
  | { kind: "cancelled"; code: LoginErrorCode }
  | { kind: "unavailable"; code: LoginErrorCode; detail?: string };

interface LoginResponse {
  token: string;
  user: {
    userKey: string;
    name: string | null;
    gender: string | null;
  };
}

function envBool(key: string): boolean {
  const v = (import.meta.env as Record<string, unknown>)[key];
  return typeof v === "string" && v === "true";
}

function isMockForced(): boolean {
  if (envBool("VITE_TOSS_AUTH_MOCK")) return true;
  if (envBool("VITE_MOCK_AUTH")) return true;
  return false;
}

function isInAppsInToss(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    ReactNativeWebView?: unknown;
    __CONSTANT_HANDLER_MAP?: Record<string, unknown>;
  };
  // ReactNativeWebView 는 토스 앱 내부 WebView 만 주입한다. 가장 확실한 신호.
  if (w.ReactNativeWebView) return true;
  // __GRANITE_NATIVE_EMITTER 는 SDK 가 일반 브라우저에서도 import 시점에
  // 무조건 설치하므로 환경 감지 신호로 쓸 수 없다 (false positive 의 원인).
  // __CONSTANT_HANDLER_MAP 은 앱 안에서만 채워지므로 신호로 사용 가능.
  if (w.__CONSTANT_HANDLER_MAP && typeof w.__CONSTANT_HANDLER_MAP === "object") {
    return true;
  }
  try {
    const v = getTossAppVersion();
    if (typeof v === "string" && v.length > 0) return true;
  } catch {
    /* 환경 아님 */
  }
  return false;
}

interface AppLoginNativeResult {
  authorizationCode?: string;
  referrer?: string;
}

async function callAppLogin(): Promise<
  { ok: true; data: AppLoginNativeResult } | { ok: false; cancelled: boolean; reason: string }
> {
  if (typeof appsInTossAppLogin !== "function") {
    return { ok: false, cancelled: false, reason: "sdk_missing" };
  }
  try {
    const res = (await appsInTossAppLogin()) as AppLoginNativeResult | undefined;
    if (!res || typeof res.authorizationCode !== "string" || !res.authorizationCode) {
      return { ok: false, cancelled: false, reason: "no_auth_code" };
    }
    return { ok: true, data: res };
  } catch (e) {
    const detail = humanError(e);
    return {
      ok: false,
      cancelled: /cancel/i.test(detail),
      reason: detail,
    };
  }
}

/**
 * 앱 시작 시 1회 호출. 성공 시 Worker JWT 를 tokenStore 에 저장한다.
 */
export async function startAppsInTossLogin(): Promise<LoginResult> {
  // 일반 브라우저 (Perplexity preview, 로컬 미리보기 등) bypass.
  // 핵심: ReactNativeWebView 가 없으면 appLogin() 은 항상
  // "ReactNativeWebView is not available in browser environment" 로 throw 한다.
  // mock 강제 빌드면 SDK 호출 자체를 건너뛰고 즉시 통과시킨다.
  if (isMockForced()) {
    const hasRNWebView =
      typeof window !== "undefined" &&
      Boolean((window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView);
    if (!hasRNWebView) {
      await delay(420);
      return { kind: "ok", via: "mock" };
    }
  }

  if (!isInAppsInToss()) {
    if (import.meta.env.DEV) {
      await delay(280);
      return { kind: "ok", via: "mock" };
    }
    return {
      kind: "unavailable",
      code: "ENV_NOT_APPS_IN_TOSS",
      detail: "Apps in Toss 환경에서만 로그인을 진행할 수 있어요.",
    };
  }

  const authorize = await callAppLogin();
  if (!authorize.ok) {
    if (authorize.cancelled) {
      return { kind: "cancelled", code: "AUTHORIZE_CANCELLED" };
    }
    if (authorize.reason === "sdk_missing") {
      return {
        kind: "unavailable",
        code: "SDK_NOT_FOUND",
        detail: "appLogin 이 SDK 에 없어요.",
      };
    }
    return {
      kind: "fail",
      code: "AUTHORIZE_FAILED",
      detail: authorize.reason,
    };
  }

  const base = (import.meta.env.VITE_APPS_IN_TOSS_PROXY_URL ?? "").replace(/\/$/, "");
  const attemptedUrl = `${base}/login`;
  const hasAuthCode: "yes" | "no" = authorize.data.authorizationCode ? "yes" : "no";

  if (!base) {
    return {
      kind: "unavailable",
      code: "SERVER_ENV_MISSING",
      detail: "VITE_APPS_IN_TOSS_PROXY_URL 미설정 (Cloudflare Worker URL)",
    };
  }

  const fetched = await loginFetch(attemptedUrl, {
    authorizationCode: authorize.data.authorizationCode ?? "",
    referrer: authorize.data.referrer,
  });

  if (fetched.kind === "network_error") {
    const diag: LoginNetworkDiag = {
      build: LOGIN_DIAG_BUILD,
      workerUrl: base || "<empty>",
      attemptedUrl,
      hasAuthCode,
      fetchErrorName: fetched.errorName,
      fetchErrorMessage: fetched.errorMessage,
    };
    const health = await healthProbe(base);
    if (health.kind === "ok") {
      diag.healthStatus = health.status;
      diag.healthOk = health.ok;
      diag.healthBody = health.body;
    } else {
      diag.healthErrorName = health.errorName;
      diag.healthErrorMessage = health.errorMessage;
    }
    return {
      kind: "fail",
      code: "NETWORK_ERROR",
      detail: "worker_fetch_failed",
      networkDiag: diag,
    };
  }

  if (fetched.kind === "http_error") {
    return mapApiErrorToLoginFail(fetched.code, fetched.message);
  }

  const data = fetched.data;
  if (!data.token || !data.user?.userKey) {
    return { kind: "fail", code: "TOKEN_EXCHANGE_FAILED", detail: "missing_token" };
  }

  tokenStore.set(data.token);
  return {
    kind: "ok",
    via: "apps-in-toss",
    userKey: data.user.userKey,
    nickname: data.user.name ?? undefined,
  };
}

type LoginFetchResult =
  | { kind: "ok"; data: LoginResponse }
  | { kind: "http_error"; code: string; message: string; status: number }
  | { kind: "network_error"; errorName: string; errorMessage: string };

async function loginFetch(
  url: string,
  body: { authorizationCode: string; referrer?: string },
): Promise<LoginFetchResult> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl?.signal,
      credentials: "omit",
      mode: "cors",
      cache: "no-store",
    });
    if (timer) clearTimeout(timer);
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      /* non-json */
    }
    if (!res.ok) {
      const e = (parsed as { error?: { code?: string; message?: string } } | null)?.error;
      return {
        kind: "http_error",
        code: e?.code ?? `http_${res.status}`,
        message: e?.message ?? `HTTP ${res.status}`,
        status: res.status,
      };
    }
    let data: LoginResponse;
    if (parsed && typeof parsed === "object" && "ok" in (parsed as object)) {
      const obj = parsed as { ok: boolean } & Record<string, unknown>;
      const { ok: _ok, ...rest } = obj;
      data = rest as unknown as LoginResponse;
    } else {
      data = parsed as LoginResponse;
    }
    return { kind: "ok", data };
  } catch (e) {
    if (timer) clearTimeout(timer);
    return {
      kind: "network_error",
      errorName: e instanceof Error ? e.name : "Error",
      errorMessage: e instanceof Error ? e.message : String(e ?? "fetch failed"),
    };
  }
}

type HealthResult =
  | { kind: "ok"; status: number; ok: boolean; body: string }
  | { kind: "error"; errorName: string; errorMessage: string };

async function healthProbe(base: string): Promise<HealthResult> {
  if (!base) return { kind: "error", errorName: "Error", errorMessage: "no_base" };
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
  try {
    const res = await fetch(`${base}/health`, {
      method: "GET",
      credentials: "omit",
      mode: "cors",
      cache: "no-store",
    });
    if (timer) clearTimeout(timer);
    let body = "";
    try {
      body = (await res.text()).slice(0, 64);
    } catch {
      /* ignore */
    }
    return { kind: "ok", status: res.status, ok: res.ok, body };
  } catch (e) {
    if (timer) clearTimeout(timer);
    return {
      kind: "error",
      errorName: e instanceof Error ? e.name : "Error",
      errorMessage: e instanceof Error ? e.message : String(e ?? "fetch failed"),
    };
  }
}

function mapApiErrorToLoginFail(code: string, message?: string): LoginResult {
  switch (code) {
    case "TOKEN_EXCHANGE_FAILED":
      return { kind: "fail", code: "TOKEN_EXCHANGE_FAILED" };
    case "USERINFO_FAILED":
      return { kind: "fail", code: "USERINFO_FAILED" };
    case "DECRYPT_FAILED":
      return { kind: "fail", code: "DECRYPT_FAILED" };
    case "MTLS_HANDSHAKE_FAILED":
      return { kind: "fail", code: "MTLS_HANDSHAKE_FAILED" };
    case "DB_WRITE_FAILED":
      return { kind: "fail", code: "DB_WRITE_FAILED" };
    case "AUTHORIZE_FAILED":
      return { kind: "fail", code: "AUTHORIZE_FAILED" };
    case "no_api_base":
      return {
        kind: "unavailable",
        code: "SERVER_ENV_MISSING",
        detail: "VITE_APPS_IN_TOSS_PROXY_URL 미설정 (Cloudflare Worker URL)",
      };
    case "network_error":
      // CORS preflight 차단 / fetch TypeError / DNS / TLS / 네트워크 단절.
      // UNKNOWN 으로 가두지 않고 네트워크 실패로 분류한다.
      return {
        kind: "fail",
        code: "NETWORK_ERROR",
        detail: "worker_fetch_failed",
      };
    default:
      // 알 수 없는 응답 코드는 토큰 교환 단계 실패로 분류한다.
      // 메시지가 fetch / cors / network 류를 포함하면 NETWORK_ERROR.
      if (message && /network|fetch|cors|abort/i.test(message)) {
        return { kind: "fail", code: "NETWORK_ERROR", detail: code };
      }
      return { kind: "fail", code: "TOKEN_EXCHANGE_FAILED", detail: code };
  }
}

function humanError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message?: unknown }).message ?? "unknown");
  }
  return String(e ?? "unknown");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const VERIFIED_KEY = "cc.appsInTossLogin.verified";

export const appsInTossLoginSession = {
  isVerified(): boolean {
    return safeSessionStorage.get(VERIFIED_KEY) === "1";
  },
  markVerified(): void {
    safeSessionStorage.set(VERIFIED_KEY, "1");
  },
  clear(): void {
    safeSessionStorage.remove(VERIFIED_KEY);
  },
};
