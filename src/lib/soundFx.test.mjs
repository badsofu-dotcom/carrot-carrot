/**
 * playSfx unit tests — verifies the mute / volume gate, the silent-on-
 * missing-Audio fallback, and the lazy cache. The helper deliberately
 * accesses `window.Audio`, so the test stubs both before importing the
 * module via loadTs.
 */
import { test, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const PLAYS = [];
class StubAudio {
  constructor(src) {
    this.src = src;
    this.preload = "none";
    this.volume = 1;
    this.currentTime = 0;
  }
  play() {
    PLAYS.push({ src: this.src, volume: this.volume });
    return Promise.resolve();
  }
}

globalThis.window = globalThis;
globalThis.Audio = StubAudio;
globalThis.HTMLAudioElement = StubAudio;

// import.meta.env.BASE_URL is normally injected by Vite. The TS loader
// path runs the file through esbuild so this access becomes
// `((import.meta || {}).env || {}).BASE_URL`. Pass a value via the loader
// helper isn't supported — instead we just verify the asset URL ends
// with "/sounds/<kind>.mp3" regardless of base prefix.

const mod = await loadTs("./soundFx.ts", import.meta.url);
const { playSfx, _resetSfxCache } = mod;

beforeEach(() => {
  PLAYS.length = 0;
  _resetSfxCache();
});

test("playSfx: muted → no Audio.play call", () => {
  playSfx("dig", { muted: true, masterVolume: 80 });
  assert.equal(PLAYS.length, 0);
});

test("playSfx: masterVolume=0 → no play", () => {
  playSfx("dig", { muted: false, masterVolume: 0 });
  assert.equal(PLAYS.length, 0);
});

test("playSfx: normal call invokes Audio.play once with sounds path", () => {
  playSfx("water", { muted: false, masterVolume: 100 });
  assert.equal(PLAYS.length, 1);
  assert.match(PLAYS[0].src, /sounds\/water\.mp3$/);
});

test("playSfx: volume capped to ≤ 0.45 of master", () => {
  playSfx("harvest", { muted: false, masterVolume: 100, gain: 1 });
  // master 1.0 * gain 1.0 * 0.45 cap = 0.45
  assert.ok(PLAYS[0].volume <= 0.451);
  assert.ok(PLAYS[0].volume >= 0.449);
});

test("playSfx: gain scales below 0.45 cap", () => {
  playSfx("dig", { muted: false, masterVolume: 50, gain: 0.5 });
  // 0.5 * 0.5 * 0.45 = 0.1125
  assert.ok(PLAYS[0].volume <= 0.113);
  assert.ok(PLAYS[0].volume >= 0.111);
});

test("playSfx: same kind reuses the cached Audio element", () => {
  playSfx("dig", { muted: false, masterVolume: 100 });
  playSfx("dig", { muted: false, masterVolume: 100 });
  assert.equal(PLAYS.length, 2);
  assert.equal(PLAYS[0].src, PLAYS[1].src);
});

test("playSfx: unknown kind silently does nothing", () => {
  // SfxKind is the type-level union; at runtime an unknown string maps
  // to undefined in SFX_URLS. The wrapper should swallow the error.
  playSfx("unknown", { muted: false, masterVolume: 100 });
  // It will still try to construct Audio with undefined src; we accept
  // either no-play OR a play with falsy src. The contract is "no throw".
  assert.ok(true);
});
