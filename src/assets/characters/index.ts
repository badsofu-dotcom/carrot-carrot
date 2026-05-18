// 토끼 캐릭터 이미지 매핑 — Phase 2: WebP 1x/2x 자산.
// 원본 JPG (1080×1080, ~380KB each) 를 1x(640px ~25KB) + 2x(1080px ~70KB) WebP 로 변환.
// Vite 의 ?url 임포트로 빌드 해시가 붙은 정적 URL 을 안전하게 받는다.
//
// Round 17.5 — 누끼 (transparent) 변형 추가. ./transparent/ 디렉토리에
// 35종 RGBA webp (256/512). 도감의 12 캐릭터는 BUNNY_TRANSPARENT 로
// 매핑돼 VisitorBunny 가 농장 카드 위에 단색 배경 없이 떠 있게 한다.
// 도감/온보딩 등 다른 화면은 기존 단색-bg bunnyImages 그대로 사용.

import { transparentBunnyImages } from "./transparent";

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
  // R34 PR-205 — 23 신규 도감 entry. 기존 transparent set (Round 17.5
  // 에서 import 됨) 의 unmapped 항목을 dogam 카드용으로 노출. 단색 bg
  // 없이 cutout 으로 렌더되지만 도감 그리드 시각 일관성 큰 문제 없음.
  // 가챠 풀에 자동 포함 (pickPool 이 CHARACTERS 순회).
  v2_happy: transparentBunnyImages.happy,
  v2_sleepy: transparentBunnyImages.sleepy,
  v2_shy: transparentBunnyImages.shy,
  v2_cool: transparentBunnyImages.cool,
  v2_scared: transparentBunnyImages.scared,
  v2_surprised: transparentBunnyImages.surprised,
  v2_tired: transparentBunnyImages.tired,
  v2_confused: transparentBunnyImages.confused,
  v2_wink: transparentBunnyImages.wink,
  v2_stretching: transparentBunnyImages.stretching,
  v2_watering: transparentBunnyImages.watering,
  v2_planting: transparentBunnyImages.planting,
  v2_love: transparentBunnyImages.love,
  v2_laugh: transparentBunnyImages.laugh,
  v2_excited: transparentBunnyImages.excited,
  v2_digging: transparentBunnyImages.digging,
  v2_farming_sweat: transparentBunnyImages.farming_sweat,
  v2_detective: transparentBunnyImages.detective,
  v2_samurai: transparentBunnyImages.samurai,
  v2_angry: transparentBunnyImages.angry,
  v2_astronaut: transparentBunnyImages.astronaut,
  v2_angel: transparentBunnyImages.angel,
  v2_santa: transparentBunnyImages.santa,
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

/**
 * Round 17.5 — dogam character → transparent (cutout) bunny mapping.
 *
 * Keyed by BunnyKey (underscore form) so it lines up with `bunnyImages`
 * and the existing `<Bunny variant>` API. The 12 mapped keys cover the
 * full dogam roster from collectionData CHARACTERS:
 *
 *   idle/focus/eat25/eat50/eat75/cry/sleep/success (common+rare)
 *   rare_ninja / rare_king                          (rare)
 *   rare_wizard                                     (SR tier in dogam — id "sr-wizard")
 *   legendary_demon                                 (legendary)
 *
 * The remaining 23 transparent variants in ./transparent/ stay unmapped
 * for now (Round 18+ dogam expansion candidates: santa, samurai, angel,
 * astronaut, detective, etc.).
 */
export const BUNNY_TRANSPARENT: Partial<Record<BunnyKey, BunnyAsset>> = {
  idle: transparentBunnyImages.waving,
  focus: transparentBunnyImages.thinking,
  eat25: transparentBunnyImages.carrying,
  eat50: transparentBunnyImages.harvesting,
  eat75: transparentBunnyImages.chef,
  cry: transparentBunnyImages.sulk,
  sleep: transparentBunnyImages.sleeping_in_field,
  success: transparentBunnyImages.proud,
  rare_ninja: transparentBunnyImages.ninja,
  rare_king: transparentBunnyImages.pirate,
  rare_wizard: transparentBunnyImages.scientist,
  legendary_demon: transparentBunnyImages.vampire,
  // R34 PR-205 — 23 신규 도감 entry 의 transparent 매핑 (VisitorBunny
  // 등 cutout 사용 사이트에서 동일하게 표시).
  v2_happy: transparentBunnyImages.happy,
  v2_sleepy: transparentBunnyImages.sleepy,
  v2_shy: transparentBunnyImages.shy,
  v2_cool: transparentBunnyImages.cool,
  v2_scared: transparentBunnyImages.scared,
  v2_surprised: transparentBunnyImages.surprised,
  v2_tired: transparentBunnyImages.tired,
  v2_confused: transparentBunnyImages.confused,
  v2_wink: transparentBunnyImages.wink,
  v2_stretching: transparentBunnyImages.stretching,
  v2_watering: transparentBunnyImages.watering,
  v2_planting: transparentBunnyImages.planting,
  v2_love: transparentBunnyImages.love,
  v2_laugh: transparentBunnyImages.laugh,
  v2_excited: transparentBunnyImages.excited,
  v2_digging: transparentBunnyImages.digging,
  v2_farming_sweat: transparentBunnyImages.farming_sweat,
  v2_detective: transparentBunnyImages.detective,
  v2_samurai: transparentBunnyImages.samurai,
  v2_angry: transparentBunnyImages.angry,
  v2_astronaut: transparentBunnyImages.astronaut,
  v2_angel: transparentBunnyImages.angel,
  v2_santa: transparentBunnyImages.santa,
};
