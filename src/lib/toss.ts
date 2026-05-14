/**
 * Toss 미니앱 어댑터 — Phase 3.
 *
 * 책임:
 *   - 실제 토스 WebView 안에서만 `@apps-in-toss/web-framework` 의 appLogin()
 *     을 호출하고, 일반 브라우저/Vite dev / iframe 에서는 절대 깨지지 않게 한다.
 *   - 어떤 실패도 throw 하지 않고 `TossLoginResult` 의 `kind` 로 표현한다.
 *
 * 정책:
 *   - VITE_MOCK_AUTH=true 또는 VITE_USE_MOCK_LOGIN!=='false' 이면 즉시 mock.
 *   - 토스 환경 휴리스틱(UA / window.TossApps) 으로 외부 SDK 호출 여부 결정.
 *   - SDK 가 없거나 호출 실패해도 mock fallback. UI 가 깨지면 안 된다.
 */

export type TossLoginResult =
  | {
      kind: "toss";
      authorizationCode: string;
      referrer?: string;
    }
  | {
      kind: "mock";
      authorizationCode: string; // 결정적 mock code
      referrer: "mock";
    }
  | {
      kind: "unavailable";
      reason: string;
    };

export interface TossUser {
  id: string;
  nickname: string;
  isMock: boolean;
}

const MOCK_USER: TossUser = {
  id: "mock-user-0001",
  nickname: "토끼 친구",
  isMock: true,
};

function envMockOn(): boolean {
  // VITE_MOCK_AUTH 가 명시적으로 'false' 일 때만 mock 비활성.
  const m = import.meta.env.VITE_MOCK_AUTH;
  if (typeof m === "string") return m !== "false";
  // 구버전 호환
  const legacy = import.meta.env.VITE_USE_MOCK_LOGIN;
  if (typeof legacy === "string") return legacy !== "false";
  // 기본값: 개발/일반 브라우저는 mock
  return true;
}

function isInTossApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ua = navigator.userAgent || "";
    if (/toss/i.test(ua)) return true;
    if ((window as unknown as { TossApps?: unknown }).TossApps) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * 토스 자동 로그인 시도. 절대 throw 하지 않는다.
 */
export async function appLoginRequest(): Promise<TossLoginResult> {
  if (envMockOn()) {
    return {
      kind: "mock",
      authorizationCode: "mock_code_dev",
      referrer: "mock",
    };
  }
  if (!isInTossApp()) {
    return {
      kind: "mock",
      authorizationCode: "mock_code_browser",
      referrer: "mock",
    };
  }
  try {
    type AppLoginFn = (opts?: Record<string, unknown>) => Promise<{
      authorizationCode?: string;
      referrer?: string;
    }>;
    const mod = (await import("@apps-in-toss/web-framework").catch(
      () => null,
    )) as { appLogin?: AppLoginFn } | null;
    if (!mod || typeof mod.appLogin !== "function") {
      return { kind: "unavailable", reason: "sdk_missing" };
    }
    const res = await mod.appLogin({});
    if (!res || !res.authorizationCode) {
      return { kind: "unavailable", reason: "no_auth_code" };
    }
    return {
      kind: "toss",
      authorizationCode: res.authorizationCode,
      referrer: res.referrer,
    };
  } catch (e) {
    return {
      kind: "unavailable",
      reason: e instanceof Error ? e.message : "unknown",
    };
  }
}

/**
 * 옛날 시그니처 호환. 일부 페이지가 직접 부르고 있어 유지.
 * Phase 3 부터는 authService.initAuth() 사용 권장.
 */
export async function appLogin(): Promise<TossUser> {
  return MOCK_USER;
}

export const tossMock = { user: MOCK_USER };
export { MOCK_USER };
