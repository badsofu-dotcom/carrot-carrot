/**
 * focusGate (PR-74) — pushSuppressed / consume / format pure helpers.
 *
 * isFocusBlackout() 는 window.location.hash + useTimerStore 에 의존 →
 * jsdom 환경 없이는 본 단위테스트에서 검증 어려움. 본 파일은 큐 동작
 * + 메시지 포맷 만 검증.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

// safeStorage in-memory fallback 으로 동작 (Node 환경에 window 없음).
const mod = await loadTs("./notify/focusGate.ts", import.meta.url);
const {
  pushSuppressedDrop,
  consumeSuppressedDrops,
  formatSuppressedMessage,
} = mod;

test("초기 consume — 빈 dict", () => {
  // 이전 테스트 영향 없는 fresh state 가정. consume 으로 어떤 상태든 clear.
  consumeSuppressedDrops();
  const c = consumeSuppressedDrops();
  assert.deepEqual(c, {});
});

test("pushSuppressedDrop: 같은 kind 카운터 증가", () => {
  consumeSuppressedDrops();
  pushSuppressedDrop("gem");
  pushSuppressedDrop("gem");
  pushSuppressedDrop("gem");
  const c = consumeSuppressedDrops();
  assert.equal(c.gem, 3);
});

test("pushSuppressedDrop: 다른 kind 별도 카운터", () => {
  consumeSuppressedDrops();
  pushSuppressedDrop("gem", 3);
  pushSuppressedDrop("heart", 2);
  pushSuppressedDrop("seed");
  const c = consumeSuppressedDrops();
  assert.equal(c.gem, 3);
  assert.equal(c.heart, 2);
  assert.equal(c.seed, 1);
});

test("consumeSuppressedDrops: 호출 후 큐 비워짐", () => {
  consumeSuppressedDrops();
  pushSuppressedDrop("bolt", 5);
  const c1 = consumeSuppressedDrops();
  assert.equal(c1.bolt, 5);
  const c2 = consumeSuppressedDrops();
  assert.deepEqual(c2, {});
});

test("pushSuppressedDrop: count <= 0 은 no-op", () => {
  consumeSuppressedDrops();
  pushSuppressedDrop("gem", 0);
  pushSuppressedDrop("gem", -3);
  const c = consumeSuppressedDrops();
  assert.deepEqual(c, {});
});

test("formatSuppressedMessage: 빈 dict → null", () => {
  assert.equal(formatSuppressedMessage({}), null);
  assert.equal(formatSuppressedMessage({ gem: 0 }), null);
});

test("formatSuppressedMessage: 단일 kind", () => {
  assert.equal(
    formatSuppressedMessage({ gem: 3 }),
    "🎁 집중하는 동안 보석 3개 떨어졌어요",
  );
});

test("formatSuppressedMessage: 다중 kind 콤마 구분", () => {
  const msg = formatSuppressedMessage({ gem: 3, heart: 2, seed: 1 });
  assert.match(msg, /보석 3개/);
  assert.match(msg, /하트 2개/);
  assert.match(msg, /씨앗 1개/);
  assert.match(msg, /, /);
});

test("formatSuppressedMessage: 알려진 라벨", () => {
  const msg = formatSuppressedMessage({
    gem: 1,
    bolt: 1,
    heart: 1,
    hourglass: 1,
    juice: 1,
    soup: 1,
    cake: 1,
    seed: 1,
    golden: 1,
    hidden_bunny: 1,
  });
  for (const label of [
    "보석",
    "번개",
    "하트",
    "모래시계",
    "주스",
    "수프",
    "케이크",
    "씨앗",
    "황금당근",
    "히든 토끼",
  ]) {
    assert.match(msg, new RegExp(label));
  }
});

// 마지막에 큐 비워두기 (테스트간 격리).
consumeSuppressedDrops();
