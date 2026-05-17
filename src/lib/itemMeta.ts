/**
 * Item display metadata — extended copy for the InventoryModal's
 * bottom-sticky description panel (PR-41).
 *
 * Each entry has *display-only* strings (no store/runtime semantics).
 * The canonical `effect` / `acquisition` shortform stays in
 * `itemsStore.ITEMS` for the grid title; this module supplies the
 * fuller description shown when an item is tapped.
 *
 * Why a separate file: keeps long-form copy out of `itemsStore.ts`
 * (which is hot during build / typecheck) and lets translation /
 * editorial passes touch only one file.
 */
import type { ItemCode } from "../features/collection/itemsStore";

export interface ItemMeta {
  /** 1–2 line description shown in the bottom panel. */
  longDescription: string;
  /** Fallback emoji when the PNG fails to load (grid cell + panel). */
  emoji: string;
}

export const ITEM_META: Record<ItemCode, ItemMeta> = {
  carrot: {
    longDescription:
      "수확 시 자동 적립. 토스포인트로 1 P. 5분 이상 집중하면 작물이 자라 수확할 수 있어요.",
    emoji: "🥕",
  },
  candy: {
    // PR-105 — 단순화: 토스포인트 환산 중심. 확률/버프 detail 은 버프 / 도구
    // / 도감 description 에 위임.
    longDescription:
      "5 토스포인트로 환산되는 보너스 당근. 수확 시 일정 확률로 등장.",
    emoji: "🍬",
  },
  golden: {
    // PR-105 — 동일 패턴.
    longDescription:
      "10 토스포인트로 환산되는 희귀 당근. 수확 시 낮은 확률로 등장.",
    emoji: "✨",
  },
  // PR-109 — seed entry 제거 (씨앗 자원 폐기).
  carrot_coin: {
    longDescription:
      "광고 보상으로 받는 토큰. 50개 사용 → 캔디 당근 1개. 향후 토끼 만나기 비용 예정.",
    emoji: "🪙",
  },
  hourglass: {
    longDescription:
      "심은 작물 한 단계 즉시 성장. 빠른 수확이 필요할 때 사용. 주간 보물상자 또는 농장 드랍.",
    emoji: "⏳",
  },
  bolt: {
    longDescription:
      "물뿌리개 +3 충전. 광고 보상 또는 농장 드랍에서 획득.",
    emoji: "⚡",
  },
  juice: {
    longDescription:
      "다음 수확 한 번 동안 캔디 당근 확률 +5 %p. 콤보 / 배치 보너스와 가산 스택.",
    emoji: "🥤",
  },
  soup: {
    // PR-92 — 재설계: 다음 수확 황금당근 +5%p (당근주스의 황금 버전).
    longDescription:
      "다음 수확 한 번 동안 황금당근 확률 +5%p. 콤보 / 배치 보너스와 가산 스택.",
    emoji: "🍲",
  },
  cake: {
    // PR-92 — 재설계: 다음 포커스 완료 시 모든 농장 보상 1.5배.
    longDescription:
      "다음 포커스 완료 시 작물 성장 1.5배. 5분 미만 세션은 효과 소비 안 함.",
    emoji: "🍰",
  },
  star: {
    longDescription:
      "수확 보너스 / 보물상자에서 적립. 100개 모으면 전설 토끼 1마리 직접 해제.",
    emoji: "⭐",
  },
  gem: {
    longDescription:
      "오늘의 선물상자 2 % 드랍. 5개로 즉시 효과 (캔디당근 / 작물 성장 / 세션 완료 등) 구매.",
    emoji: "💎",
  },
  heart: {
    longDescription:
      "광고 시청 토큰. 매일 자정 3개로 리필, 친구에게 인사 시 +1 (최대 5).",
    emoji: "🩷",
  },
};
