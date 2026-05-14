/**
 * 인증 서비스 — Cloudflare Worker (carrot-carrot-api) 기반.
 *
 * 책임:
 *   - 앱 시작 시 한 번 initAuth() 를 호출해 저장된 JWT 로 /me 를 시도.
 *   - 실패 시 guest 모드로 전환. 절대 throw 하지 않는다.
 *   - loginWithToss() 는 Apps in Toss SDK appLogin() → Worker /login 을 묶어준다.
 *
 * 게스트 모드 정의:
 *   - JWT 없음, user 객체 없음. UI 는 mock stats 로 동작.
 *   - 진짜로 데이터 쓰기 전에 loginWithToss() 한 번은 시도해야 함.
 */

import { apiCallWithRefresh, tokenStore, apiBaseUrl, apiCall } from "../lib/api";
import { MOCK_USER, type TossUser } from "../lib/toss";

export type AuthMode = "loading" | "toss" | "mock" | "guest";

export interface AuthSnapshot {
  mode: AuthMode;
  user: TossUser | null;
  /** Settings 에서 사용. 절대 raw mock id 표시하지 말 것. */
  hint: string;
}

export interface ServerUser {
  user_id: string;
  nickname: string;
  level: number;
  total_carrots: number;
  total_focus_minutes: number;
  streak_days: number;
  longest_focus_minutes: number;
}

interface MeResponse {
  userKey: string;
  name: string | null;
  focusStats: {
    totalSessions: number;
    totalCarrots: number;
    totalFocusMinutes: number;
    longestFocusMinutes: number;
  };
  carrots: number;
  unlockedSounds: string[];
}

interface LoginResponse {
  token: string;
  user: {
    userKey: string;
    name: string | null;
    gender: string | null;
  };
}

function modeHint(mode: AuthMode): string {
  switch (mode) {
    case "toss":
      return "토스로 로그인됨";
    case "mock":
      return "게스트 모드";
    case "guest":
      return "게스트 모드";
    case "loading":
      return "확인 중...";
  }
}

function hasApiBase(): boolean {
  return Boolean(apiBaseUrl());
}

function meToServerUser(me: MeResponse): ServerUser {
  return {
    user_id: me.userKey,
    nickname: me.name ?? MOCK_USER.nickname,
    level: 1,
    total_carrots: me.carrots,
    total_focus_minutes: me.focusStats.totalFocusMinutes,
    streak_days: 0,
    longest_focus_minutes: me.focusStats.longestFocusMinutes,
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

/**
 * 앱 부팅 시 1회.
 * 1) 저장된 JWT 로 /me 시도 → 성공이면 그 사용자.
 * 2) 401 또는 실패면 토큰 비우고 guest.
 */
export async function initAuth(): Promise<AuthSnapshot> {
  if (!hasApiBase()) {
    // 백엔드 미설정 환경. mock 사용자로 채워주되 mode 는 'mock'.
    return { mode: "mock", user: MOCK_USER, hint: modeHint("mock") };
  }
  const access = tokenStore.getAccess();
  if (!access) {
    return { mode: "guest", user: null, hint: modeHint("guest") };
  }
  const me = await apiCallWithRefresh<MeResponse>("/me");
  if (!me.ok || !me.data?.userKey) {
    tokenStore.clear();
    return { mode: "guest", user: null, hint: modeHint("guest") };
  }
  return {
    mode: "toss",
    user: {
      id: me.data.userKey,
      nickname: me.data.name ?? MOCK_USER.nickname,
      isMock: false,
    },
    hint: modeHint("toss"),
  };
}

/**
 * Apps in Toss appLogin() → Worker /login → JWT 저장 → 사용자 반환.
 * 어떤 실패에서도 guest 로 떨어진다.
 */
export async function loginWithToss(): Promise<AuthSnapshot> {
  // 일반 브라우저 / mock 강제 환경 — 서버 호출 없이 mock 통과.
  if (isMockForced()) {
    return {
      mode: "mock",
      user: MOCK_USER,
      hint: modeHint("mock"),
    };
  }
  if (!hasApiBase()) {
    return {
      mode: "mock",
      user: MOCK_USER,
      hint: modeHint("mock"),
    };
  }

  // Apps in Toss SDK 에서 authorizationCode 받아 Worker 로 보냄.
  const { startAppsInTossLogin } = await import("../lib/appsInTossLogin");
  const tossRes = await startAppsInTossLogin();
  if (tossRes.kind === "ok" && tossRes.via === "apps-in-toss") {
    return {
      mode: "toss",
      user: {
        id: tossRes.userKey ?? MOCK_USER.id,
        nickname: tossRes.nickname ?? MOCK_USER.nickname,
        isMock: false,
      },
      hint: modeHint("toss"),
    };
  }
  if (tossRes.kind === "ok" && tossRes.via === "mock") {
    return { mode: "mock", user: MOCK_USER, hint: modeHint("mock") };
  }
  return { mode: "guest", user: null, hint: modeHint("guest") };
}

/**
 * 직접 authorizationCode 를 가진 호출자용 — 거의 startAppsInTossLogin() 와 동일하나
 * 외부 컨텍스트에서 강제로 호출이 필요할 때 사용.
 */
export async function exchangeCodeForJwt(
  authorizationCode: string,
  referrer?: string,
): Promise<AuthSnapshot> {
  const r = await apiCall<LoginResponse>("/login", {
    method: "POST",
    auth: false,
    body: { authorizationCode, referrer },
  });
  if (!r.ok || !r.data.token || !r.data.user?.userKey) {
    return { mode: "guest", user: null, hint: modeHint("guest") };
  }
  tokenStore.set(r.data.token);
  return {
    mode: "toss",
    user: {
      id: r.data.user.userKey,
      nickname: r.data.user.name ?? MOCK_USER.nickname,
      isMock: false,
    },
    hint: modeHint("toss"),
  };
}

export function logout(): AuthSnapshot {
  tokenStore.clear();
  return { mode: "guest", user: null, hint: modeHint("guest") };
}

/**
 * /me 호출 wrapper — 호출자가 mock fallback 을 알아서 결정.
 * Worker 응답을 ServerUser 형태로 정규화해서 반환한다.
 */
export async function fetchMe() {
  const r = await apiCallWithRefresh<MeResponse>("/me");
  if (!r.ok) return r;
  return {
    ok: true as const,
    data: {
      user: meToServerUser(r.data),
      characters: [] as unknown[],
      unlockedSounds: r.data.unlockedSounds,
    },
  };
}
