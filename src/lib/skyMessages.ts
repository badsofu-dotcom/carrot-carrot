/**
 * Cozy sky-view messages. Korean, Animal-Crossing tone.
 *
 * Each slot pool now holds 12 messages so tapping the sky cycles
 * through a comfortable variety. `pickSkyMessage(slot, rng)` picks
 * one at random; `pickSkyMessageAt(slot, index)` is the deterministic
 * cycle-by-index used by SkyView's tap handler.
 */

import type { FarmBgSlot } from "./farmBackground";

const SLOT_POOLS: Record<FarmBgSlot, readonly string[]> = {
  sky_dawn: [
    "동이 트는 시간, 첫 숨을 길게 내쉬어보세요",
    "아침 해가 인사해요",
    "새벽 공기는 작물에게도, 너에게도 좋아요",
    "하루의 첫 페이지를 천천히 넘겨요",
    "조용한 산이 멀리서 깨어나요",
    "오늘은 어떤 색일까, 한 번 기대해봐요",
    "햇살이 손끝까지 닿을 때쯤이면",
    "물기 머금은 잎사귀가 빛나요",
    "잠시 멈춰 서서 숨을 들이켜요",
    "안개가 갈라지는 모양을 봐요",
    "조금 일찍 일어난 토끼가 인사해요",
    "오늘 하루도 천천히, 그러나 꾸준히",
  ],
  bg_morning: [
    "아침 햇살이 작물을 깨워요",
    "오늘 첫 집중을 시작해볼까요?",
    "기지개 한 번 — 새 하루의 시작",
    "새들이 농장을 한 바퀴 돌아요",
    "잘 자고 일어난 작물처럼, 깨끗한 마음",
    "한 잔의 따뜻한 물이 어울려요",
    "아침엔 작은 일부터 시작해요",
    "오늘 할 일 하나만 정해볼까요?",
    "햇살이 머리카락에 스며들어요",
    "하늘은 오늘도 새 그림이에요",
    "이슬방울이 작물 끝에 매달려 있어요",
    "한 발짝, 또 한 발짝씩",
  ],
  bg_day: [
    "구름이 떠다니는 한낮, 농장도 한가해요",
    "햇볕 아래 작물이 잘 익어가요",
    "잠깐 숨 고르고, 다음 한 칸으로",
    "그늘에 잠시 앉아도 좋아요",
    "물 한 잔 마시고 가요",
    "고양이도 낮잠 자는 시간이에요",
    "지금 이 순간이 가장 평범하고 좋은 때",
    "잘 자란 작물처럼 너도 천천히 자라요",
    "하늘은 오늘도 친절해요",
    "바람이 살짝 작물을 흔들어요",
    "한낮의 농장은 조금 졸리네요",
    "구름이 모자처럼 산에 걸려 있어요",
  ],
  bg_evening: [
    "노을이 작물을 따뜻하게 감싸요",
    "오늘 잘 했어요, 곧 저녁이에요",
    "주황빛 하늘, 마음도 한 톤 부드럽게",
    "긴 그림자가 작물 사이에 누워요",
    "오늘 일어난 일들을 하나씩 떠올려봐요",
    "마지막 해가 산 너머로 미끄러져요",
    "농장에도 저녁 식사 시간이 와요",
    "노을은 매일 다른 모양이에요",
    "한숨 깊게 내쉬고, 잠시 멍해도 돼요",
    "오늘 가장 좋았던 한 순간을 꼽아봐요",
    "주황빛 구름이 천천히 식어가요",
    "어제보다 한 뼘 큰 나, 안녕",
  ],
  bg_night: [
    "별이 작물 위로 내려앉아요",
    "조용한 밤, 농장도 잠시 쉬어요",
    "달빛이 곧 이슬이 될 거예요",
    "하루 끝, 별 하나 보고 푹 자요",
    "벌레 소리도 작은 음악이에요",
    "내일은 천천히 시작해도 괜찮아요",
    "달이 농장을 부드럽게 비춰요",
    "별 하나, 소원 하나, 그리고 또 별",
    "이불 속처럼 포근한 밤이에요",
    "꿈에서 만나요, 토끼야",
    "은하수가 산 위에 천천히 흘러요",
    "오늘의 마지막 숨을 길게",
  ],
  bg_rainy: [
    "비 오는 농장은 작물에게 작은 축복",
    "지붕에 떨어지는 빗소리를 들어볼까요?",
    "물뿌리개가 잠깐 쉬어가는 날",
    "우산 위에서 비가 통통 굴러가요",
    "잎사귀가 빗방울을 안고 빛나요",
    "비 냄새가 농장에 가득해요",
    "구름이 잠시 농장을 안아줘요",
    "흙이 깊게 숨을 들이켜는 날",
    "젖은 바람이 차분하게 머리를 식혀줘요",
    "비 오는 날엔 조용한 음악이 어울려요",
    "빗방울 하나가 작은 호수를 만들어요",
    "오늘은 잠시 안에 머물러도 좋아요",
  ],
  bg_snowy: [
    "눈송이가 천천히 내려요",
    "조용한 눈밭, 마음도 잠시 흰색",
    "흰 눈 위에 발자국 하나 남겨볼까요?",
    "눈이 농장을 폭신하게 감싸요",
    "차가운 공기 속에 따뜻한 입김",
    "토끼 발자국이 농장에 점선을 그려요",
    "굴뚝 연기가 천천히 올라가요",
    "오늘은 따뜻한 음료가 어울려요",
    "눈이 가지 위에 살짝 쌓여요",
    "발자국 따라 걷는 즐거움",
    "세상이 조금 더 조용해진 날",
    "오늘은 한 호흡 더 깊게",
  ],
  bg_autumn: [
    "단풍이 농장 위로 떨어져요",
    "낙엽 한 장 — 시간이 흐르는 모양",
    "선선한 바람에 작물도 키가 자라요",
    "노란 잎과 빨간 잎이 같이 춤춰요",
    "가을 햇살은 부드러워요",
    "낙엽을 밟는 소리가 좋아요",
    "도토리 한 알, 다람쥐의 보물",
    "스카프가 어울리는 날씨",
    "농장에 가을 향기가 깊어져요",
    "잎이 떨어지는 데도 이유가 있어요",
    "하늘이 더 높아 보여요",
    "오늘은 천천히 걷고 싶은 날",
  ],
  bg_cherry: [
    "벚꽃이 천천히 흩날려요",
    "분홍빛 하늘, 새 계절이 도착했어요",
    "봄, 모든 게 다시 시작이에요",
    "꽃잎이 머리 위로 사뿐히 내려와요",
    "벚꽃나무 아래에서 한 컷",
    "봄 바람은 다정해요",
    "작은 새가 가지 사이를 오가요",
    "꽃잎이 농장 흙 위에 점을 찍어요",
    "올해 첫 봄, 어떤 일을 시작할까요?",
    "분홍 구름이 산 위에 걸려 있어요",
    "벚꽃은 짧기에 더 아름다워요",
    "오늘 농장은 분홍빛 향기",
  ],
};

const GENERAL: readonly string[] = [
  "오늘도 잘 자라고 있어요",
  "잠깐 멈춰서 하늘 한 번",
  "지금 이 순간은 다시 오지 않아요",
  "토끼는 항상 너를 기다려요",
  "한 박자 쉬어가도 괜찮아요",
];

function poolFor(slot: FarmBgSlot): readonly string[] {
  const pool = SLOT_POOLS[slot];
  return pool && pool.length > 0 ? pool : GENERAL;
}

export function pickSkyMessage(
  slot: FarmBgSlot,
  rng: () => number = Math.random,
): string {
  const pool = poolFor(slot);
  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(idx, pool.length - 1)] ?? GENERAL[0];
}

/** Deterministic cycle picker — tap-to-cycle uses this. Mods by pool length. */
export function pickSkyMessageAt(slot: FarmBgSlot, index: number): string {
  const pool = poolFor(slot);
  if (pool.length === 0) return GENERAL[0];
  const i = ((Math.floor(index) % pool.length) + pool.length) % pool.length;
  return pool[i]!;
}

export const SKY_MESSAGE_COUNT = (() => {
  const all = new Set<string>(GENERAL);
  for (const pool of Object.values(SLOT_POOLS)) for (const m of pool) all.add(m);
  return all.size;
})();

/** Pool size for the given slot — useful for tests + report. */
export function skyPoolSize(slot: FarmBgSlot): number {
  return poolFor(slot).length;
}
