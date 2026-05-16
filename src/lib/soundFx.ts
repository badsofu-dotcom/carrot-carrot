/**
 * Tool/event SFX — short one-shot audio cues.
 *
 * Two backends with automatic fallthrough:
 *   1. **mp3** at `${BASE}sounds/sfx_<kind>.mp3` — preferred when the
 *      asset is present. Cached per kind. Volume capped at master×0.45.
 *   2. **procedural** (`src/lib/procSfx.ts`) — Web Audio API synth.
 *      Always available, no asset deps. Used when the mp3 path fails
 *      (404, decode error, or a previous load marked the kind dead).
 *
 * Design constraints:
 *   - **Never autoplay** — every `play()` is reached from a tap handler.
 *   - **Silently degrade** — both backends swallow errors and return.
 *   - **Bundle-safe** — no module-init audio side effects, no
 *     `localStorage`/`indexedDB` access.
 *
 * Kinds (PR-13 extended set):
 *   dig / water / harvest    — tool actions (PR-4)
 *   combo / bunny / levelup / giftbox  — events (PR-13)
 */

import { playProcSfx, type ProcSfxKind } from "./procSfx";

export type SfxKind = ProcSfxKind;

const BASE: string =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

const SFX_URLS: Record<SfxKind, string> = {
  dig: `${BASE}sounds/sfx_dig.mp3`,
  water: `${BASE}sounds/sfx_water.mp3`,
  harvest: `${BASE}sounds/sfx_harvest.mp3`,
  combo: `${BASE}sounds/sfx_combo.mp3`,
  bunny: `${BASE}sounds/sfx_bunny.mp3`,
  levelup: `${BASE}sounds/sfx_levelup.mp3`,
  giftbox: `${BASE}sounds/sfx_giftbox.mp3`,
};

/** Cached audio elements per kind — lazily allocated. */
const cache = new Map<SfxKind, HTMLAudioElement>();
/** Kinds known to have failed mp3 load — skip to procedural directly. */
const mp3Dead = new Set<SfxKind>();

interface PlayOpts {
  /** 0..1, multiplied with the master volume. Default 1.0. */
  gain?: number;
  /** Mute flag (typically `useSoundStore.sfxMuted`). */
  muted?: boolean;
  /** Master volume in [0..100] (typically `useSoundStore.sfxVolume`). */
  masterVolume?: number;
}

export function playSfx(kind: SfxKind, opts: PlayOpts = {}): void {
  if (opts.muted) return;
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    // SSR / unsupported — try procedural anyway (no-op without window).
    playProcSfx(kind, opts);
    return;
  }

  const master = clamp01((opts.masterVolume ?? 100) / 100);
  if (master === 0) return;
  const gain = clamp01(opts.gain ?? 1.0);
  const volume = clamp01(master * gain * 0.45); // SFX always quieter than BGM

  // Skip mp3 path for kinds that previously failed.
  if (mp3Dead.has(kind)) {
    playProcSfx(kind, opts);
    return;
  }

  let el = cache.get(kind);
  if (!el) {
    try {
      el = new Audio(SFX_URLS[kind]);
      el.preload = "auto";
      // If the mp3 fails to load (404 / decode), mark the kind dead so
      // we don't keep stalling on the network round-trip — subsequent
      // plays go straight to procSfx. Guarded so a stub Audio without
      // EventTarget methods (used in unit tests) doesn't throw.
      if (typeof el.addEventListener === "function") {
        el.addEventListener(
          "error",
          () => {
            mp3Dead.add(kind);
          },
          { once: true },
        );
      }
      cache.set(kind, el);
    } catch {
      mp3Dead.add(kind);
      playProcSfx(kind, opts);
      return;
    }
  }
  try {
    el.currentTime = 0;
    el.volume = volume;
    const p = el.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Autoplay block, decode error, or any other reject — mark the
        // kind dead so next time we synth immediately, and *also* synth
        // for this very call so the user still hears something.
        mp3Dead.add(kind);
        playProcSfx(kind, opts);
      });
    }
  } catch {
    mp3Dead.add(kind);
    playProcSfx(kind, opts);
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/** Test seam — clear the audio cache + reset mp3-dead set. */
export function _resetSfxCache(): void {
  cache.clear();
  mp3Dead.clear();
}
