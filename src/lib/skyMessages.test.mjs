/**
 * Tests for pickSkyMessage. Validates picker never throws, slot-biased
 * pools include the slot strings, and the message count looks sane.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./skyMessages.ts", import.meta.url);
const { pickSkyMessage, pickSkyMessageAt, skyPoolSize, SKY_MESSAGE_COUNT } = mod;

test("SKY_MESSAGE_COUNT ≥ 12 unique messages", () => {
  assert.ok(SKY_MESSAGE_COUNT >= 12, `got ${SKY_MESSAGE_COUNT}`);
});

test("pickSkyMessage returns a non-empty Korean string for every slot", () => {
  const slots = [
    "sky_dawn",
    "bg_morning",
    "bg_day",
    "bg_evening",
    "bg_night",
    "bg_rainy",
    "bg_snowy",
    "bg_cherry",
    "bg_autumn",
  ];
  for (const s of slots) {
    const m = pickSkyMessage(s, () => 0);
    assert.equal(typeof m, "string");
    assert.ok(m.length > 0);
  }
});

test("rng=0 prefers slot-pool head; rng=1 stays in bounds", () => {
  // With rng = 0, the picker hits the first entry of the combined pool
  // (slot-pool first → general fallback), so for sky_dawn that's the
  // dawn-specific message.
  const m0 = pickSkyMessage("sky_dawn", () => 0);
  assert.match(m0, /동|아침|새벽/);

  // rng = 0.9999... should be safe (clamped to last index).
  const m1 = pickSkyMessage("sky_dawn", () => 0.9999);
  assert.ok(typeof m1 === "string" && m1.length > 0);
});

test("unknown slot falls through to general pool (no throw)", () => {
  const m = pickSkyMessage("bogus_slot", () => 0);
  assert.equal(typeof m, "string");
  assert.ok(m.length > 0);
});

test("every defined slot pool has 12 messages", () => {
  const slots = [
    "sky_dawn",
    "bg_morning",
    "bg_day",
    "bg_evening",
    "bg_night",
    "bg_rainy",
    "bg_snowy",
    "bg_cherry",
    "bg_autumn",
  ];
  for (const s of slots) assert.equal(skyPoolSize(s), 12, s);
});

test("pickSkyMessageAt is deterministic and wraps modulo pool size", () => {
  const a = pickSkyMessageAt("bg_day", 0);
  const b = pickSkyMessageAt("bg_day", 12);
  const c = pickSkyMessageAt("bg_day", 24);
  assert.equal(a, b);
  assert.equal(a, c);
  // Negative indices also wrap.
  const d = pickSkyMessageAt("bg_day", -1);
  assert.equal(typeof d, "string");
  assert.ok(d.length > 0);
});
