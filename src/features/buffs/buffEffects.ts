/**
 * Buff effects SoT (PR-59).
 *
 * BuffChip / BuffInfoPopover / buffsStore 가 공유하는 메타데이터.
 * 효과 자체 (trigger 시점, consume 시 동작) 는 기존 trigger 사이트
 * (FarmHub harvest / refillFromAd / HomePage focus complete) 가
 * 처리. 본 파일은 display 카피 + duration + color 만.
 *
 * Duration 도입 (PR-59 신규):
 *   기존 buffs 는 boolean active/inactive 만. PR-59 가 expiresAt
 *   추가 — 사용자가 활성 후 trigger 안 일어나면 expire 자동 clear.
 *   각 효과의 trigger 평균 간격을 고려해 default duration 정의.
 */

import type { BuffKind } from "../collection/buffsStore";

export interface BuffMeta {
  /** 화면 표시 이름 (PR-59 "버프" suffix). */
  displayName: string;
  /** 1줄 효과 설명. BuffInfoPopover 가 보여줌. */
  description: string;
  /** 트리거 조건 — "다음 X 때". */
  trigger: string;
  /** Emoji fallback / accent. */
  emoji: string;
  /** Progress bar fill color (Round 7 spec). */
  color: string;
  /** Active duration in ms — expire 자동 clear. */
  durationMs: number;
}

export const BUFF_META: Record<BuffKind, BuffMeta> = {
  juice: {
    displayName: "주스 버프",
    description: "다음 수확 한 번 캔디 당근 확률 +5%p",
    trigger: "다음 수확 시 자동 발동",
    emoji: "🥤",
    color: "#FFE26E",
    durationMs: 15 * 60_000,
  },
  soup: {
    displayName: "수프 버프",
    description: "다음 물뿌리개 충전 시 +1 차지 (한도 일시적 +1)",
    trigger: "다음 광고 충전 시 자동 발동",
    emoji: "🍲",
    color: "#FFB266",
    durationMs: 30 * 60_000,
  },
  cake: {
    displayName: "케이크 버프",
    description: "다음 포커스 완료 시 씨앗 +1 (5분 미만은 소비 안 함)",
    trigger: "다음 유효 집중 완료 시 자동 발동",
    emoji: "🍰",
    color: "#FF99CC",
    durationMs: 30 * 60_000,
  },
};

/** mm:ss 라벨. 음수면 "00:00". */
export function formatRemaining(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSec = Math.floor(safe / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 만료 직전 5초 안인지. */
export function isFinalCountdown(remainingMs: number): boolean {
  return remainingMs > 0 && remainingMs <= 5_000;
}
