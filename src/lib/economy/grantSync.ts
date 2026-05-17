/**
 * grantSync (PR-116) — fire-and-forget client → worker P grant.
 *
 * 클라이언트 cap (dailyCap.ts) 은 localStorage 기반 → tamper 가능.
 * Server 가 권위 있는 quota (daily_caps.reward_points_total) 관리.
 *
 * 호출 패턴:
 *   addPoints("source", N) 가 client cap 통과 시 grantOnServer 호출.
 *   worker `/economy/grant` 가 server cap 검증 + 실 grant.
 *   응답 무시 (fire-and-forget) — 클라 게임 흐름 막지 않음.
 *
 * Guest / 게스트 / API 미설정 시 no-op (apiCall 의 canHitServer).
 */
import { apiCall, apiBaseUrl, tokenStore } from "../api";

function canCallServer(): boolean {
  try {
    if (!apiBaseUrl()) return false;
    if (!tokenStore.getAccess()) return false;
    return true;
  } catch {
    // Node test env / SSR — import.meta.env / safeStorage 미정의 가능.
    return false;
  }
}

/**
 * Fire-and-forget P grant. Returns immediately; server response logged
 * on completion.
 *
 * Safe in Node test env — canCallServer 가 throw 시 silent return.
 */
export function grantOnServer(source: string, points: number): void {
  if (!Number.isFinite(points) || points <= 0) return;
  if (!canCallServer()) return;
  // Detached promise — 의도적 await 안 함. 클라 흐름 차단 X.
  try {
    void apiCall<{ granted: number; totalToday: number; cap: number; capReached: boolean }>(
      "/economy/grant",
      {
        method: "POST",
        body: { source, points: Math.floor(points) },
      },
    );
  } catch {
    /* ignore — fire-and-forget */
  }
}
