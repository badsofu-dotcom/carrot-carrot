/**
 * safeAreaModal (PR-79) — 모달 / 시트 잘림 fix 공통 스타일.
 *
 * PR-68 (InventoryModal) + PR-79 (AdRewardChannelModal) 둘 다 동일
 * 패턴 — safe-area inset + viewport-relative maxHeight 누락으로 작은
 * 화면에서 컨텐츠 잘림. 본 유틸이 한 곳에 정책 집중.
 *
 * 사용 패턴:
 *   <motion.div
 *     style={{
 *       ...safeAreaModalStyle({ maxWidth: 360 }),
 *       background: "#FFF8EE",
 *       borderRadius: 20,
 *       ...
 *     }}
 *   >
 *
 * 보장:
 *   - maxHeight = 100dvh - safe-area top - safe-area bottom - 32px gutter
 *   - padding 에 safe-area-inset-bottom 포함 (bottom 잘림 방지)
 *   - overflowY: auto 로 컨텐츠 많을 때 내부 스크롤
 *   - boxSizing: border-box
 */
import type { CSSProperties } from "react";

interface SafeAreaModalOpts {
  /** 가로 최대값 (override 가능). 기본 360. */
  maxWidth?: number;
  /** 가로 padding 픽셀 (좌우). 기본 22. */
  paddingX?: number;
  /** 상단 padding 픽셀. 기본 20. */
  paddingTop?: number;
  /** 하단 padding 픽셀 — safe-area 추가됨. 기본 16. */
  paddingBottom?: number;
  /** Gutter — viewport 위/아래에 남길 여유 (양쪽 합산). 기본 32px. */
  gutter?: number;
}

export function safeAreaModalStyle(
  opts: SafeAreaModalOpts = {},
): CSSProperties {
  const maxWidth = opts.maxWidth ?? 360;
  const paddingX = opts.paddingX ?? 22;
  const paddingTop = opts.paddingTop ?? 20;
  const paddingBottom = opts.paddingBottom ?? 16;
  const gutter = opts.gutter ?? 32;
  return {
    width: "100%",
    maxWidth,
    boxSizing: "border-box",
    // PR-79 — safe-area-inset-bottom 포함 padding-bottom. iOS notch 디바이스
    // 의 home indicator 영역 위로 컨텐츠가 잘리지 않게.
    padding: `${paddingTop}px ${paddingX}px calc(${paddingBottom}px + env(safe-area-inset-bottom)) ${paddingX}px`,
    // PR-79 — dvh 기반 dynamic viewport 최대 높이. fallback 으로
    // 100vh. gutter 만큼 빼서 화면 끝 닿지 않음 (visual breathing room).
    maxHeight: `calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - ${gutter}px)`,
    // 컨텐츠가 maxHeight 넘으면 내부 스크롤.
    overflowY: "auto",
    // Webkit scrollbar 숨김 — 깔끔한 모바일 시트 느낌. data attribute
    // 로 CSS override 가능하게 두고, inline scrollbarWidth thin 도 적용.
    scrollbarWidth: "thin",
  };
}

/**
 * Outer backdrop (overlay) 의 표준 스타일. flex centering + 4 면 모두
 * safe-area inset + 가운데 child 가 view 잘리지 않도록 padding.
 *
 * PR-82: 이전 (PR-79) 은 좌/우 safe-area 만 포함. notch 디바이스 +
 * floating TabBar 와 함께 사용 시 bottom 영역이 모자랐음. 4 면 모두
 * safe-area 추가해서 모든 viewport 에서 자식 모달이 visible.
 */
export const safeAreaBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.5)",
  padding:
    "calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))",
  boxSizing: "border-box",
};
