/**
 * Farm BGM player (PR-13).
 *
 * One global `HTMLAudioElement` looping the current track, swapped via
 * a manual 2-second crossfade when the active sky slot changes. The
 * engine is **mp3-only**: drop `bgm_day.mp3` / `bgm_night.mp3` /
 * `bgm_rainy.mp3` into `public/sounds/` to enable. With no files, the
 * engine silently keeps trying — UI controls work but nothing plays.
 *
 * Why this isn't generated procedurally like SFX: a looping pad needs
 * minutes of varied content to feel non-grating; Web Audio API synth
 * produces robotic, fatiguing loops. mp3 is the right tool here. The
 * curated CC0 URL list lives in `public/sounds/README.md`.
 *
 * Lifecycle expectations:
 *   - `start(cfg)` should be called from a user-gesture handler so the
 *     browser allows `audio.play()`. Idempotent — multiple calls past
 *     the first are no-ops (except resume from `setEnabled`).
 *   - `setEnabled` / `setVolume` are safe to call any time.
 *   - `destroy()` releases the audio element + timers for unit-test
 *     teardown; production never calls it.
 */

import { pickFarmBackgroundSlot, type FarmBgSlot } from "./farmBackground";

export type BgmTrack = "day" | "night" | "rainy";

const BASE: string =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

const TRACK_URLS: Record<BgmTrack, string> = {
  day: `${BASE}sounds/bgm_day.mp3`,
  night: `${BASE}sounds/bgm_night.mp3`,
  rainy: `${BASE}sounds/bgm_rainy.mp3`,
};

export function trackForSlot(slot: FarmBgSlot): BgmTrack {
  if (slot === "bg_night" || slot === "sky_dawn") return "night";
  if (slot === "bg_rainy" || slot === "bg_snowy") return "rainy";
  return "day";
}

interface BgmConfig {
  enabled: boolean;
  /** 0..100; rendered at `(volume / 100) * 0.5` so BGM never overpowers SFX. */
  volume: number;
}

let audio: HTMLAudioElement | null = null;
let currentTrack: BgmTrack | null = null;
let started = false;
let cfg: BgmConfig = { enabled: true, volume: 50 };
let crossfadeTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHandlerInstalled = false;
const mp3Dead = new Set<BgmTrack>();

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function targetVolume(): number {
  // BGM tops out at half the slider so a maxed slider doesn't drown SFX.
  return clamp01(cfg.volume / 100) * 0.5;
}

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return null;
  }
  if (!audio) {
    try {
      audio = new Audio();
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
    } catch {
      return null;
    }
  }
  return audio;
}

function installVisibilityHandler() {
  if (visibilityHandlerInstalled || typeof document === "undefined") return;
  visibilityHandlerInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (!audio) return;
    if (document.hidden) {
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
    } else if (cfg.enabled && started) {
      try {
        const p = audio.play();
        if (p && typeof p.catch === "function") p.catch(() => undefined);
      } catch {
        /* ignore */
      }
    }
  });
}

function startFade(target: number, durMs: number) {
  if (!audio) return;
  if (crossfadeTimer) clearInterval(crossfadeTimer);
  const start = audio.volume;
  const startTime = Date.now();
  crossfadeTimer = setInterval(() => {
    if (!audio) {
      if (crossfadeTimer) clearInterval(crossfadeTimer);
      crossfadeTimer = null;
      return;
    }
    const t = Math.min(1, (Date.now() - startTime) / Math.max(1, durMs));
    audio.volume = clamp01(start + (target - start) * t);
    if (t >= 1) {
      if (crossfadeTimer) clearInterval(crossfadeTimer);
      crossfadeTimer = null;
    }
  }, 50);
}

function crossfadeTo(track: BgmTrack) {
  const el = ensureAudio();
  if (!el) return;
  if (mp3Dead.has(track)) return;
  if (currentTrack === track) return;
  currentTrack = track;
  el.src = TRACK_URLS[track];
  el.addEventListener(
    "error",
    () => {
      mp3Dead.add(track);
    },
    { once: true },
  );
  el.volume = 0;
  try {
    const p = el.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Autoplay still blocked. The next user gesture (which will
        // call start() again or trigger setEnabled) provides another
        // chance to resume.
      });
    }
  } catch {
    /* ignore */
  }
  startFade(targetVolume(), 2000);
}

function pickTrack(): BgmTrack {
  return trackForSlot(pickFarmBackgroundSlot());
}

export const bgmEngine = {
  /**
   * Initialize on first user gesture. Idempotent — subsequent calls
   * just check that audio is still flowing (helps after the browser
   * suspends an autoplay-blocked element).
   */
  start(initialCfg: BgmConfig): void {
    cfg = { ...initialCfg };
    if (started) {
      // Already running. If currently paused (autoplay block earlier),
      // a fresh user gesture may now resume it.
      if (audio && cfg.enabled && audio.paused) {
        try {
          const p = audio.play();
          if (p && typeof p.catch === "function") p.catch(() => undefined);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (!cfg.enabled) {
      started = true;
      return;
    }
    started = true;
    installVisibilityHandler();
    crossfadeTo(pickTrack());
    if (typeof window !== "undefined") {
      pollTimer = setInterval(
        () => {
          if (!cfg.enabled || !started) return;
          const next = pickTrack();
          if (next !== currentTrack) crossfadeTo(next);
        },
        5 * 60 * 1000,
      );
    }
  },

  setEnabled(v: boolean): void {
    cfg.enabled = v;
    if (!v) {
      if (audio) {
        startFade(0, 500);
        setTimeout(() => {
          try {
            audio?.pause();
          } catch {
            /* ignore */
          }
        }, 550);
      }
      return;
    }
    if (!started) return; // wait for first-gesture start()
    if (audio) {
      try {
        const p = audio.play();
        if (p && typeof p.catch === "function") p.catch(() => undefined);
      } catch {
        /* ignore */
      }
      if (!currentTrack) crossfadeTo(pickTrack());
      else startFade(targetVolume(), 1000);
    } else {
      crossfadeTo(pickTrack());
    }
  },

  setVolume(v: number): void {
    cfg.volume = Math.max(0, Math.min(100, Math.round(v)));
    if (audio && cfg.enabled && !audio.paused) {
      startFade(targetVolume(), 200);
    }
  },

  /** Inspect for tests; not part of the runtime contract. */
  _peek(): {
    started: boolean;
    enabled: boolean;
    volume: number;
    currentTrack: BgmTrack | null;
  } {
    return {
      started,
      enabled: cfg.enabled,
      volume: cfg.volume,
      currentTrack,
    };
  },

  destroy(): void {
    started = false;
    if (crossfadeTimer) clearInterval(crossfadeTimer);
    crossfadeTimer = null;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    if (audio) {
      try {
        audio.pause();
        audio.src = "";
      } catch {
        /* ignore */
      }
    }
    audio = null;
    currentTrack = null;
    mp3Dead.clear();
  },
};
