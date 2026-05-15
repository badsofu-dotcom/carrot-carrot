/**
 * Tool action SFX — short one-shot audio cues for plant / water / harvest.
 *
 * Design constraints:
 *   - **Never autoplay**: Apps-in-Toss WebView blocks audio that fires
 *     before a user gesture. Every `play()` here is called from a tap
 *     handler, so the policy is honored by construction.
 *   - **Silently degrade**: a missing mp3 (file 404) or an autoplay
 *     rejection must not throw, log loudly, or surface a toast. Tool
 *     actions still complete; sound is purely additive.
 *   - **Respect mute**: `useSoundStore.sfxMuted` and the global
 *     `volume` slider gate every play. Master volume is the same one
 *     the BGM player uses, so muting BGM via the volume slider also
 *     dampens SFX.
 *   - **Bundle-safe**: lazy `HTMLAudioElement` allocation on first
 *     play — no preload, no module-init audio side effects, no
 *     `localStorage`/`indexedDB` access (those would fail the
 *     forbidden-token scrub on `dist-preview/`).
 *
 * Asset paths are resolved via `import.meta.env.BASE_URL` so nested-
 * proxy hosting (Perplexity preview iframe, granite sub-path) keeps
 * working. Missing mp3s are listed in `assets-missing.md`.
 */

export type SfxKind = "dig" | "water" | "harvest";

// `import.meta.env` is undefined under `node --test` (no Vite). Guard
// the access so the helper loads cleanly in both runtimes.
const BASE: string =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

const SFX_URLS: Record<SfxKind, string> = {
  dig: `${BASE}sounds/dig.mp3`,
  water: `${BASE}sounds/water.mp3`,
  harvest: `${BASE}sounds/harvest.mp3`,
};

/** Cached audio elements per kind — lazily allocated. */
const cache = new Map<SfxKind, HTMLAudioElement>();

interface PlayOpts {
  /** 0..1, multiplied with the master volume. Default 1.0. */
  gain?: number;
  /** Mute flag (typically `useSoundStore.sfxMuted`). */
  muted?: boolean;
  /** Master volume in [0..100] (typically `useSoundStore.volume`). */
  masterVolume?: number;
}

export function playSfx(kind: SfxKind, opts: PlayOpts = {}): void {
  if (opts.muted) return;
  if (typeof window === "undefined" || typeof Audio === "undefined") return;

  const master = clamp01((opts.masterVolume ?? 100) / 100);
  if (master === 0) return;
  const gain = clamp01(opts.gain ?? 1.0);
  const volume = clamp01(master * gain * 0.45); // SFX always quieter than BGM

  let el = cache.get(kind);
  if (!el) {
    try {
      el = new Audio(SFX_URLS[kind]);
      el.preload = "auto";
      cache.set(kind, el);
    } catch {
      return;
    }
  }
  try {
    el.currentTime = 0;
    el.volume = volume;
    const p = el.play();
    // `Audio.play()` returns a Promise in modern browsers. Swallow
    // rejection (autoplay block / decode error) — the action is over,
    // user already got the haptic.
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  } catch {
    /* silent fallback */
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/** Test seam — clear the audio cache. Not used by production code. */
export function _resetSfxCache(): void {
  cache.clear();
}
