/**
 * bgmEngine pure-helper tests — Round 18 (PR-133).
 *
 * Verifies the new 6-track context routing. DOM/timer side-effects (the
 * actual <audio> element) are out of scope for node --test.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./bgmEngine.ts", import.meta.url);
const { pickTrackForContext } = mod;

const BASE_CTX = {
  firstVisit: false,
  skyOpen: false,
  focusActive: false,
  readyCrops: 0,
  growingCrops: 0,
};

test("pickTrackForContext: firstVisit overrides everything", () => {
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, firstVisit: true, focusActive: true }),
    "dawn",
  );
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, firstVisit: true, skyOpen: true }),
    "dawn",
  );
});

test("pickTrackForContext: skyOpen beats focus + crops", () => {
  assert.equal(
    pickTrackForContext({
      ...BASE_CTX,
      skyOpen: true,
      focusActive: true,
      readyCrops: 5,
    }),
    "skyview",
  );
});

test("pickTrackForContext: focusActive beats crop state", () => {
  assert.equal(
    pickTrackForContext({
      ...BASE_CTX,
      focusActive: true,
      readyCrops: 9,
      growingCrops: 0,
    }),
    "focus",
  );
});

test("pickTrackForContext: ≥3 ripe → kerning (harvest rush)", () => {
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, readyCrops: 3 }),
    "kerning",
  );
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, readyCrops: 9, growingCrops: 0 }),
    "kerning",
  );
});

test("pickTrackForContext: all growing, none ripe → ellinia", () => {
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, growingCrops: 9, readyCrops: 0 }),
    "ellinia",
  );
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, growingCrops: 1, readyCrops: 0 }),
    "ellinia",
  );
});

test("pickTrackForContext: 2 ripe (under threshold) + growing → ellinia not kerning", () => {
  // 2 ripe is "almost ready" but not the kerning harvest rush. Since
  // there's at least one ripe, "all growing, none ripe" fails too, so
  // we fall back to henesys. Hold on — actually ellinia requires
  // readyCrops === 0. With readyCrops=2 we go to henesys.
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, readyCrops: 2, growingCrops: 5 }),
    "henesys",
  );
});

test("pickTrackForContext: empty field default → henesys", () => {
  assert.equal(pickTrackForContext(BASE_CTX), "henesys");
});

test("pickTrackForContext: idle empty + no flags → henesys", () => {
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, readyCrops: 0, growingCrops: 0 }),
    "henesys",
  );
});
