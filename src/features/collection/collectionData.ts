/**
 * Phase 5 — 도감 데이터 정의.
 *
 * 100칸 도감 = 12개 지정 캐릭터 (이미지 매핑) + 88개 placeholder 슬롯.
 *
 * 지정 캐릭터별:
 *  - id: 안정 식별자 (저장에 사용).
 *  - bunnyKey: 그림 자산 키.
 *  - rarity: common/rare/sr/ssr/legendary.
 *  - name: 도감 이름.
 *  - quotes: 모달에서 cycling 되는 3~5개 대사.
 *  - unlockHint: 어떻게 얻는지 한 줄.
 *  - unlockKind: 자동 평가 규칙 종류 (collectionStore.evaluateUnlocks 가 사용).
 *  - threshold: 규칙별 임계값.
 *
 * placeholder 슬롯은 id="slot-XX", bunnyKey 없음, name="???".
 */

import type { BunnyKey } from "../../assets/characters";

export type Rarity = "common" | "rare" | "sr" | "ssr" | "legendary";

export type UnlockKind =
  | "carrots-cumulative" // 누적 당근 N개에 도달하면 해제
  | "streak-days" // 연속 N일에 도달하면 해제
  | "first-50min" // 첫 50분 세션 완료
  | "manual"; // 수동으로만 해제 (e.g. 데모/이벤트)

export interface CharacterDef {
  /** 안정 식별자 — store 에 owned 로 저장됨. */
  id: string;
  bunnyKey: BunnyKey;
  rarity: Rarity;
  name: string;
  quotes: string[];
  unlockKind: UnlockKind;
  /** carrots-cumulative / streak-days 에 사용. */
  threshold?: number;
  /** 도감 카드에 표시될 짧은 조건 설명. */
  unlockHint: string;
}

export interface SlotDef {
  /** 안정 식별자 — placeholder 는 "slot-23" 같은 형태. */
  id: string;
  rarity: Rarity;
  /** 캐릭터 정의가 있으면 owned 가능. 없으면 영원히 placeholder. */
  character: CharacterDef | null;
}

/* ----------------------- 12 designated characters ----------------------- */

export const CHARACTERS: CharacterDef[] = [
  // 일상 토끼 (common) — 누적 당근으로 천천히 풀린다.
  {
    id: "idle",
    bunnyKey: "idle",
    rarity: "common",
    name: "기본 토끼",
    quotes: [
      "흐흐 어서와, 친구.",
      "한 판만 같이 가자, 응?",
      "오늘은 또 누구 당근이지...",
    ],
    unlockKind: "carrots-cumulative",
    threshold: 1,
    unlockHint: "당근 1개를 모으면 해제",
  },
  {
    id: "focus",
    bunnyKey: "focus",
    rarity: "common",
    name: "집중 토끼",
    quotes: [
      "쉿, 지금 야금야금 중이야.",
      "딴 데 보지 마, 나 보지 마, 화면만 봐.",
      "조용히... 한 입만 더...",
    ],
    unlockKind: "carrots-cumulative",
    threshold: 3,
    unlockHint: "당근 3개를 모으면 해제",
  },
  {
    id: "eat25",
    bunnyKey: "eat25",
    rarity: "common",
    name: "한 입 토끼",
    quotes: [
      "음... 네 시간 살짝 베어물었어.",
      "딱 한 입만 했는데 흐흐.",
      "이거 맛있다, 더 먹어도 돼?",
    ],
    unlockKind: "carrots-cumulative",
    threshold: 5,
    unlockHint: "당근 5개를 모으면 해제",
  },
  {
    id: "eat50",
    bunnyKey: "eat50",
    rarity: "common",
    name: "절반 토끼",
    quotes: [
      "반이나 갉아먹었네 킥킥.",
      "이대로면 내 위장 터져.",
      "절반 왔어, 절반 남았어. 평등하잖아?",
    ],
    unlockKind: "carrots-cumulative",
    threshold: 8,
    unlockHint: "당근 8개를 모으면 해제",
  },
  {
    id: "eat75",
    bunnyKey: "eat75",
    rarity: "common",
    name: "야금야금 토끼",
    quotes: [
      "거의 다 먹었어, 거의.",
      "마지막 한 입 남겨놨어. 너 줄게.",
      "흐흐, 곧 잡아.",
    ],
    unlockKind: "carrots-cumulative",
    threshold: 12,
    unlockHint: "당근 12개를 모으면 해제",
  },
  {
    id: "cry",
    bunnyKey: "cry",
    rarity: "common",
    name: "찔찔이 토끼",
    quotes: [
      "흐ㅣㅣ... 또 포기야?",
      "괜찮아, 다음 판은 잡을 수 있어.",
      "내 눈물 닦아줘 흑.",
    ],
    unlockKind: "manual",
    unlockHint: "한 번 포기하면 만나",
  },
  {
    id: "sleep",
    bunnyKey: "sleep",
    rarity: "common",
    name: "꿈꾸는 토끼",
    quotes: [
      "쉿... 자는 중이야...",
      "당근 꿈 꾸는 중. 깨우지 마.",
      "흠냐... 한 입만 더...",
    ],
    unlockKind: "manual",
    unlockHint: "밤 10시 이후 첫 만남",
  },
  {
    id: "success",
    bunnyKey: "success",
    rarity: "rare",
    name: "잡았다 토끼",
    quotes: [
      "잡았다! 이번 판은 내꺼!",
      "한 판 더 가자, 응? 응?",
      "흐흐 잘하고 있어, 진짜로.",
    ],
    unlockKind: "carrots-cumulative",
    threshold: 10,
    unlockHint: "당근 10개를 모으면 해제",
  },

  // rare — streak 기반
  {
    id: "rare-ninja",
    bunnyKey: "rare_ninja",
    rarity: "rare",
    name: "닌자 토끼",
    quotes: [
      "그림자처럼 등장... 킥킥.",
      "알람도 못 듣게 조용히 갉아먹지.",
      "5일 연속? 이건 닌자급이야.",
      "스슥... 너 뒤에 있다.",
    ],
    unlockKind: "streak-days",
    threshold: 5,
    unlockHint: "5일 연속 집중 성공",
  },
  {
    id: "rare-king",
    bunnyKey: "rare_king",
    rarity: "rare",
    name: "왕초 토끼",
    quotes: [
      "내가 다 가져갈 거야 흐흐흐...",
      "10일을 견디다니, 충성을 인정한다.",
      "이 왕국의 당근은 다 내꺼.",
      "음, 너도 신하로 임명한다.",
    ],
    unlockKind: "streak-days",
    threshold: 10,
    unlockHint: "10일 연속 집중 성공",
  },
  // SR — 첫 50분 완주
  {
    id: "sr-wizard",
    bunnyKey: "rare_wizard",
    rarity: "sr",
    name: "마법사 토끼",
    quotes: [
      "수리수리 당근수리, 다 내꺼야!",
      "50분이라니, 마법 부린 줄 알았어.",
      "지팡이로 너의 집중 부여 마법.",
      "아브라카당근! 한 판 더?",
    ],
    unlockKind: "first-50min",
    unlockHint: "50분 한 판 첫 완주",
  },
  // legendary — 7일 연속
  {
    id: "legendary-demon",
    bunnyKey: "legendary_demon",
    rarity: "legendary",
    name: "악마 토끼",
    quotes: [
      "흐흐... 영혼까지 깨물어줄게.",
      "7일 연속? 너 미친거야 아니면 내 친구야?",
      "어둠 속에서 너의 당근을 노렸다.",
      "악마의 계약이지. 이제 매일 한 판 약속해.",
      "내가 본 인간 중 제일 끈질기네 킥킥.",
    ],
    unlockKind: "streak-days",
    threshold: 7,
    unlockHint: "7일 연속 집중 성공",
  },
];

/**
 * PR-71 — 실제 unlock 가능한 캐릭터 총수. dogam medal 임계
 * (dogam_25 / dogam_50 / dogam_75 / dogam_100) 와 passive 임계
 * (dogamPassives.ts) 모두 이 값에 비례. 캐릭터 추가 시 자동 반영.
 */
export const DOGAM_TOTAL = CHARACTERS.length;

/* ----------------------- 100-slot map ----------------------- */

export const TOTAL_SLOTS = 100;

/**
 * 12개 캐릭터를 도감의 의도된 위치에 박고, 88개 placeholder 를 채운다.
 * placeholder 의 rarity 분포는 도감이 너무 균일해 보이지 않도록 다양하게.
 */
export const SLOTS: SlotDef[] = (() => {
  const list: SlotDef[] = [];

  // placeholder rarity 패턴 — 슬롯 인덱스 → rarity.
  // 앞쪽은 common 위주, 뒤로 갈수록 희귀.
  function rarityForIndex(i: number): Rarity {
    if (i < 50) return "common";
    if (i < 75) return "rare";
    if (i < 90) return "sr";
    if (i < 97) return "ssr";
    return "legendary";
  }

  // 캐릭터 → 고정 슬롯 인덱스 매핑.
  // 의도: 처음 8칸은 일상 토끼, 중간 두 칸은 rare, 90번째 sr, 99번째 legendary.
  const placement: Record<number, CharacterDef> = {};
  const byId = (id: string) => CHARACTERS.find((c) => c.id === id)!;
  placement[0] = byId("idle");
  placement[1] = byId("focus");
  placement[2] = byId("eat25");
  placement[3] = byId("eat50");
  placement[4] = byId("eat75");
  placement[5] = byId("success");
  placement[6] = byId("cry");
  placement[7] = byId("sleep");
  placement[55] = byId("rare-ninja");
  placement[60] = byId("rare-king");
  placement[80] = byId("sr-wizard");
  placement[99] = byId("legendary-demon");

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const c = placement[i];
    if (c) {
      list.push({
        id: c.id,
        rarity: c.rarity,
        character: c,
      });
    } else {
      list.push({
        id: `slot-${String(i).padStart(2, "0")}`,
        rarity: rarityForIndex(i),
        character: null,
      });
    }
  }
  return list;
})();

/** id → CharacterDef 빠른 조회. */
export const CHARACTER_BY_ID: Record<string, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "일반",
  rare: "레어",
  sr: "SR",
  ssr: "SSR",
  legendary: "전설",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "var(--rarity-common)",
  rare: "var(--rarity-rare)",
  sr: "var(--rarity-sr)",
  ssr: "var(--rarity-ssr)",
  legendary: "var(--rarity-legendary)",
};

/** 뽑아낼 일별 진행 상황 (store 가 dailyHistory 로 보관). */
export interface DailyEntry {
  date: string; // YYYY-MM-DD (local)
  carrots: number;
  focusMinutes: number;
}

export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function yesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
