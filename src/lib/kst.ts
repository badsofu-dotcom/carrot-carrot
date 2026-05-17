/**
 * KST 시간대 helpers — single source of truth (PR-102).
 *
 * 이전: 8 사이트 (dailyMissions / toolStore / itemsStore / FarmDropLayer /
 * HiddenBunnyLayer / HiddenBunnyPeek / dailyCap / AdRewardChannelModal)
 * 가 동일 함수 인라인 복사. TIME_AUDIT.md Round 14 후보 — DRY 통합.
 *
 * 동작:
 *   KST = UTC + 9.
 *   YYYY-MM-DD 형식 (zero-padded).
 *
 * @example
 *   kstDayKey()  // → "2026-05-17"
 *   kstDayKey(new Date("2026-05-16T22:00:00Z"))  // → "2026-05-17" (이미 KST 07:00)
 */
export function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
