// 토끼 캐릭터 이미지 매핑 — Phase 2: WebP 1x/2x 자산.
// 원본 JPG (1080×1080, ~380KB each) 를 1x(640px ~25KB) + 2x(1080px ~70KB) WebP 로 변환.
// Vite 의 ?url 임포트로 빌드 해시가 붙은 정적 URL 을 안전하게 받는다.

import bunny_cry_1x from "./bunny_cry.webp?url";
import bunny_cry_2x from "./bunny_cry@2x.webp?url";
import bunny_eat25_1x from "./bunny_eat25.webp?url";
import bunny_eat25_2x from "./bunny_eat25@2x.webp?url";
import bunny_eat50_1x from "./bunny_eat50.webp?url";
import bunny_eat50_2x from "./bunny_eat50@2x.webp?url";
import bunny_eat75_1x from "./bunny_eat75.webp?url";
import bunny_eat75_2x from "./bunny_eat75@2x.webp?url";
import bunny_focus_1x from "./bunny_focus.webp?url";
import bunny_focus_2x from "./bunny_focus@2x.webp?url";
import bunny_idle_1x from "./bunny_idle.webp?url";
import bunny_idle_2x from "./bunny_idle@2x.webp?url";
import bunny_legendary_demon_1x from "./bunny_legendary_demon.webp?url";
import bunny_legendary_demon_2x from "./bunny_legendary_demon@2x.webp?url";
import bunny_rare_king_1x from "./bunny_rare_king.webp?url";
import bunny_rare_king_2x from "./bunny_rare_king@2x.webp?url";
import bunny_rare_ninja_1x from "./bunny_rare_ninja.webp?url";
import bunny_rare_ninja_2x from "./bunny_rare_ninja@2x.webp?url";
import bunny_rare_wizard_1x from "./bunny_rare_wizard.webp?url";
import bunny_rare_wizard_2x from "./bunny_rare_wizard@2x.webp?url";
import bunny_sleep_1x from "./bunny_sleep.webp?url";
import bunny_sleep_2x from "./bunny_sleep@2x.webp?url";
import bunny_success_1x from "./bunny_success.webp?url";
import bunny_success_2x from "./bunny_success@2x.webp?url";

export interface BunnyAsset {
  src: string; // 1x 기본
  srcSet: string; // "1x, 2x" srcset
}

function pair(a: string, b: string): BunnyAsset {
  return { src: a, srcSet: `${a} 1x, ${b} 2x` };
}

export const bunnyImages = {
  cry: pair(bunny_cry_1x, bunny_cry_2x),
  eat25: pair(bunny_eat25_1x, bunny_eat25_2x),
  eat50: pair(bunny_eat50_1x, bunny_eat50_2x),
  eat75: pair(bunny_eat75_1x, bunny_eat75_2x),
  focus: pair(bunny_focus_1x, bunny_focus_2x),
  idle: pair(bunny_idle_1x, bunny_idle_2x),
  legendary_demon: pair(bunny_legendary_demon_1x, bunny_legendary_demon_2x),
  rare_king: pair(bunny_rare_king_1x, bunny_rare_king_2x),
  rare_ninja: pair(bunny_rare_ninja_1x, bunny_rare_ninja_2x),
  rare_wizard: pair(bunny_rare_wizard_1x, bunny_rare_wizard_2x),
  sleep: pair(bunny_sleep_1x, bunny_sleep_2x),
  success: pair(bunny_success_1x, bunny_success_2x),
} as const;

export type BunnyKey = keyof typeof bunnyImages;

// 식사/포커스 진행률에 따른 토끼 그림 선택 (0~100)
export function getEatBunny(progress: number): BunnyKey {
  if (progress >= 100) return "success";
  if (progress >= 75) return "eat75";
  if (progress >= 50) return "eat50";
  if (progress >= 25) return "eat25";
  return "idle";
}

// 도감 — 4종 레어/레전더리 보유, 추가 96종은 lock 상태로 도감에서 생성한다.
export const bunnyCollection = [
  {
    key: "rare_king",
    name: "왕초 토끼",
    grade: "rare",
    quote: "내가 다 가져갈 거야 흐흐흐...",
    obtainedAt: "2024-09-12",
  },
  {
    key: "rare_ninja",
    name: "닌자 토끼",
    grade: "rare",
    quote: "그림자처럼 등장... 킥킥.",
    obtainedAt: "2024-09-18",
  },
  {
    key: "rare_wizard",
    name: "마법사 토끼",
    grade: "sr",
    quote: "수리수리 당근수리, 다 내꺼야!",
    obtainedAt: "2024-10-02",
  },
  {
    key: "legendary_demon",
    name: "악마 토끼",
    grade: "legendary",
    quote: "흐흐... 영혼까지 깨물어줄게.",
    obtainedAt: "2024-10-19",
  },
] as const;

export type BunnyCollectionItem = (typeof bunnyCollection)[number];
export type Rarity = "common" | "rare" | "sr" | "ssr" | "legendary";
