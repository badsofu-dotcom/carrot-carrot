/**
 * bgmEngine pure-helper tests — verifies the slot→track mapping. The
 * full engine has DOM/timer side-effects out of scope for node --test;
 * we only assert the routing function.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./bgmEngine.ts", import.meta.url);
const { trackForSlot } = mod;

test("trackForSlot: night-ish slots → night track", () => {
  assert.equal(trackForSlot("bg_night"), "night");
  assert.equal(trackForSlot("sky_dawn"), "night");
});

test("trackForSlot: rainy + snowy → rainy track", () => {
  assert.equal(trackForSlot("bg_rainy"), "rainy");
  assert.equal(trackForSlot("bg_snowy"), "rainy");
});

test("trackForSlot: everything else → day", () => {
  assert.equal(trackForSlot("bg_morning"), "day");
  assert.equal(trackForSlot("bg_day"), "day");
  assert.equal(trackForSlot("bg_evening"), "day");
  assert.equal(trackForSlot("bg_cherry"), "day");
  assert.equal(trackForSlot("bg_autumn"), "day");
});
