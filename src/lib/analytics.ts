/**
 * Lightweight analytics shim (R27 PHASE 3.B).
 *
 * 현재 백엔드 미연동 — DEV 에선 console.info, production 에선 no-op.
 * R28 에서 실제 endpoint (worker /analytics 또는 Toss 콘솔) 와 연동
 * 예정. 호출처가 미리 typed 인터페이스로 잡아두면 마이그레이션 비용 0.
 */

const IS_DEV =
  typeof import.meta !== "undefined" &&
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

export interface FarmhubBuyEvent {
  step: number;
  price: number;
  balance: number;
  ok: boolean;
  reason?: string;
  /** R32 PR-183 — 결제 통화 (carrot|candy|golden). 기본 carrot. */
  currency?: "carrot" | "candy" | "golden";
}

export type FarmhubBuyKind = "attempt" | "success";

export function logFarmhubBuy(
  kind: FarmhubBuyKind,
  payload: FarmhubBuyEvent,
): void {
  if (!IS_DEV) return;
  try {
    // eslint-disable-next-line no-console
    console.info(`[analytics] farmhub_buy_${kind}`, payload);
  } catch {
    /* ignore */
  }
}

/**
 * 일반 이벤트 로깅. payload 는 자유 형식.
 * R28 에서 deduping / batching 추가 예정.
 */
export function logEvent(
  name: string,
  payload?: Record<string, unknown>,
): void {
  if (!IS_DEV) return;
  try {
    // eslint-disable-next-line no-console
    console.info(`[analytics] ${name}`, payload ?? {});
  } catch {
    /* ignore */
  }
}
