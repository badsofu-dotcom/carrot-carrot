/**
 * Haptic feedback helper — 토스 SDK 가 노출하는 진동 API 가 있으면 시도하고,
 * 없으면 Web navigator.vibrate fallback. iOS Safari 는 미지원 → 조용히 무시.
 * 절대 throw 하지 않는다.
 */

export type HapticIntent = "light" | "medium" | "heavy" | "success" | "warning";

const VIBRATE_MAP: Record<HapticIntent, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  success: [10, 40, 10],
  warning: [30, 30, 30],
};

function isReducedMotion() {
  try {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

export function haptic(intent: HapticIntent = "light") {
  try {
    if (isReducedMotion()) return; // 접근성 — 진동 자제
    // Toss SDK hook (Phase 3 에서 실제 SDK 로 교체)
    const toss = (window as unknown as { TossApps?: { haptic?: (i: string) => void } })
      .TossApps;
    if (toss?.haptic) {
      toss.haptic(intent);
      return;
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(VIBRATE_MAP[intent]);
    }
  } catch {
    // 조용히 무시 — unsupported / blocked
  }
}
