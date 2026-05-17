/**
 * itemsStore copy lint (PR-77) — 사용자 노출 텍스트에서 영어 식별자
 * 잔여 확인. PR-73 이 render-time translateAcquisition() 으로 해결
 * 했지만 소스 자체도 한국어로 유지 (cognitive load 감소 + 향후 token
 * 시스템 의존 최소화).
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/collection/itemsStore.ts",
  import.meta.url,
);
const { ITEMS } = mod;

// 검사 대상: acquisition / effect 둘 다 사용자 노출.
const BANNED_TOKENS = [
  "daily-gift",
  "focus-tier",
  "weekly-treasure",
  "ad-watch",
  "farm-drop",
  "(rare)",
  "(max ", // "max 5" 처럼 영어 모달리티
  " sink", // "sink 예정" 같은 내부 용어
];

test("ITEMS: acquisition 에 영어 식별자 잔여 없음", () => {
  for (const item of ITEMS) {
    for (const token of BANNED_TOKENS) {
      assert.ok(
        !item.acquisition.includes(token),
        `item.code=${item.code} acquisition 에 ${token} 잔여`,
      );
    }
  }
});

test("ITEMS: effect 에 영어 식별자 잔여 없음", () => {
  for (const item of ITEMS) {
    for (const token of BANNED_TOKENS) {
      assert.ok(
        !item.effect.includes(token),
        `item.code=${item.code} effect 에 ${token} 잔여`,
      );
    }
  }
});

test("ITEMS: 12개 item 정의됨 (PR-109 seed 제거)", () => {
  assert.equal(ITEMS.length, 12);
});

test("ITEMS: ko 라벨 한글 (영어 단독 없음)", () => {
  for (const item of ITEMS) {
    // ko 는 한국어 표시명. 코드 (carrot 등) 와 다름.
    // 단순 검증: ko 에 한글 음절 포함 OR 짧은 영어 product 명만 허용 (없음).
    const hasHangul = /[가-힣]/.test(item.ko);
    assert.ok(hasHangul, `item.code=${item.code} ko 에 한글 없음: "${item.ko}"`);
  }
});
