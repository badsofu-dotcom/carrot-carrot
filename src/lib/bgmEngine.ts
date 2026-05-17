/**
 * Farm BGM player — 4-track context-aware (Round 24, PR-149).
 *
 * History:
 *   R18 — 6 tracks
 *   R21 — kerning 호출 제거 (브래스 의심), pickTrackForContext 단순화
 *   R23 — BGM_DISABLED_PENDING_AUDIT (사용자 검수 대기)
 *   R24 — 검수 결과 focus / henesys 영구 제거. 4 트랙만 유지.
 *
 * 활성 트랙:
 *   dawn      — default (이전 henesys 의 역할 흡수) + 첫 진입
 *   skyview   — SkyView open
 *   ellinia   — 모든 작물 성장 중 (사용자 검수 OK)
 *   kerning   — 3+ ripe (검수 OK)
 *
 * Single global `HTMLAudioElement` looping the active track. Track
 * swaps are a 500 ms volume crossfade.
 *
 * mp3 files live in `public/audio/farm-bgm-*.mp3`. focus / henesys
 * 는 R24 에서 영구 제거 — banlist 테스트가 회귀 차단.
 *
 * Lifecycle:
 *   - `start(cfg)` from a user-gesture handler (browsers block autoplay).
 *     Idempotent — subsequent calls may attempt to resume after an
 *     autoplay block.
 *   - `setEnabled` / `setVolume` safe to call any time.
 *   - `setContext(ctx)` recomputes the active track + crossfades on
 *     change.
 *   - `pause()` explicit silence (e.g. HomePage START).
 *   - `destroy()` for unit-test teardown.
 *
 * Pure-helper `pickTrackForContext` is exported separately so the
 * routing rules are unit-testable without DOM.
 */

import { safeStorage } from "./safeStorage";

export type BgmTrack = "dawn" | "ellinia" | "kerning" | "skyview";

const BASE: string =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

const TRACK_URLS: Record<BgmTrack, string> = {
  dawn: `${BASE}audio/farm-bgm-dawn.mp3`,
  ellinia: `${BASE}audio/farm-bgm-ellinia.mp3`,
  kerning: `${BASE}audio/farm-bgm-kerning.mp3`,
  skyview: `${BASE}audio/farm-bgm-skyview.mp3`,
};

/** Exposed for banlist tests + future allowlist gating. */
export const ACTIVE_BGM_TRACKS: readonly BgmTrack[] = [
  "dawn",
  "ellinia",
  "kerning",
  "skyview",
];

const FIRST_VISIT_KEY = "cc.farm.firstVisit.v1";

export interface BgmContext {
  /** True only on the very first farm mount (we set storage to flip false). */
  firstVisit: boolean;
  /** SkyView overlay open. */
  skyOpen: boolean;
  /** Focus timer in FOCUSING state. */
  focusActive: boolean;
  /** Crops at stage 4 (ripe / harvestable). */
  readyCrops: number;
  /** Crops at stages 1–3 (growing). */
  growingCrops: number;
}

/**
 * Pure routing — Round 24 (PR-149). 사용자 검수 결과 4트랙으로 축소
 * (focus / henesys 시끄러움 → 영구 제거). default = dawn 으로 이전.
 *
 *   firstVisit  → dawn       (첫 방문)
 *   skyOpen     → skyview    (하늘 보기)
 *   readyCrops≥3 → kerning   (수확 풍년)
 *   growingCrops>0 && readyCrops===0 → ellinia (모두 성장 중)
 *   else        → dawn       (기본)
 *
 * R21 의 "한 트랙으로 쭉" 단순화는 사용자 의도였지만 6→4 로 줄어든
 * 지금은 다양성을 살려도 모두 잔잔 (검수 통과). 4트랙 균형 사용.
 */
export function pickTrackForContext(ctx: BgmContext): BgmTrack {
  if (ctx.firstVisit) return "dawn";
  if (ctx.skyOpen) return "skyview";
  if (ctx.readyCrops >= 3) return "kerning";
  if (ctx.growingCrops > 0 && ctx.readyCrops === 0) return "ellinia";
  return "dawn";
}

/** Resolve + mark the per-device first-visit flag. Idempotent. */
export function consumeFirstVisit(): boolean {
  const seen = safeStorage.get(FIRST_VISIT_KEY);
  if (seen === "1") return false;
  safeStorage.set(FIRST_VISIT_KEY, "1");
  return true;
}

interface BgmConfig {
  enabled: boolean;
  /** 0..100; rendered at `(volume / 100) * 0.5` so BGM never overpowers SFX. */
  volume: number;
}

const CROSSFADE_MS = 500;
const FADE_STEP_MS = 50;

/**
 * R23 의 `BGM_DISABLED_PENDING_AUDIT` 잠금은 R24 에서 사용자 검수
 * 결과 (focus/henesys 제거, dawn/ellinia/kerning/skyview OK) 반영
 * 후 해제. const 자체 제거 — 다시 잠그려면 새 플래그로 시작.
 */

let audio: HTMLAudioElement | null = null;
let currentTrack: BgmTrack | null = null;
let started = false;
let cfg: BgmConfig = { enabled: true, volume: 50 };
let lastContext: BgmContext = {
  firstVisit: false,
  skyOpen: false,
  focusActive: false,
  readyCrops: 0,
  growingCrops: 0,
};
let crossfadeTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHandlerInstalled = false;
const trackDead = new Set<BgmTrack>();

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function targetVolume(): number {
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
      // metadata-only by default; the browser caches the full body
      // after first play() so context-switch latency is bounded to
      // first-fetch only.
      audio.preload = "metadata";
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
  const startVol = audio.volume;
  const startTime = Date.now();
  crossfadeTimer = setInterval(() => {
    if (!audio) {
      if (crossfadeTimer) clearInterval(crossfadeTimer);
      crossfadeTimer = null;
      return;
    }
    const t = Math.min(1, (Date.now() - startTime) / Math.max(1, durMs));
    audio.volume = clamp01(startVol + (target - startVol) * t);
    if (t >= 1) {
      if (crossfadeTimer) clearInterval(crossfadeTimer);
      crossfadeTimer = null;
    }
  }, FADE_STEP_MS);
}

function crossfadeTo(track: BgmTrack) {
  const el = ensureAudio();
  if (!el) return;
  if (trackDead.has(track)) return;
  if (currentTrack === track) return;
  currentTrack = track;
  el.src = TRACK_URLS[track];
  el.preload = "auto";
  el.addEventListener(
    "error",
    () => {
      trackDead.add(track);
    },
    { once: true },
  );
  el.volume = 0;
  try {
    const p = el.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Autoplay still blocked. The next user gesture provides another
        // chance via start().
      });
    }
  } catch {
    /* ignore */
  }
  startFade(targetVolume(), CROSSFADE_MS);
}

export const bgmEngine = {
  /**
   * Initialize on first user gesture. Idempotent — subsequent calls
   * just check that audio is still flowing.
   */
  start(initialCfg: BgmConfig, ctx?: BgmContext): void {
    cfg = { ...initialCfg };
    if (ctx) lastContext = { ...ctx };
    if (started) {
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
    crossfadeTo(pickTrackForContext(lastContext));
  },

  setEnabled(v: boolean): void {
    cfg.enabled = v;
    if (!v) {
      if (audio) {
        startFade(0, CROSSFADE_MS);
        setTimeout(() => {
          try {
            audio?.pause();
          } catch {
            /* ignore */
          }
        }, CROSSFADE_MS + 50);
      }
      return;
    }
    if (!started) return;
    if (audio) {
      try {
        const p = audio.play();
        if (p && typeof p.catch === "function") p.catch(() => undefined);
      } catch {
        /* ignore */
      }
      if (!currentTrack) crossfadeTo(pickTrackForContext(lastContext));
      else startFade(targetVolume(), CROSSFADE_MS);
    } else {
      crossfadeTo(pickTrackForContext(lastContext));
    }
  },

  setVolume(v: number): void {
    cfg.volume = Math.max(0, Math.min(100, Math.round(v)));
    if (audio && cfg.enabled && !audio.paused) {
      startFade(targetVolume(), 200);
    }
  },

  /**
   * Push the current gameplay context. Engine recomputes the right
   * track and crossfades if it differs from `currentTrack`.
   */
  setContext(ctx: BgmContext): void {
    lastContext = { ...ctx };
    if (!started || !cfg.enabled) return;
    const next = pickTrackForContext(lastContext);
    if (next !== currentTrack) crossfadeTo(next);
  },

  /** Explicit silence (e.g. HomePage START). Does not change `enabled`. */
  pause(): void {
    if (!audio) return;
    startFade(0, 200);
    setTimeout(() => {
      try {
        audio?.pause();
      } catch {
        /* ignore */
      }
    }, 250);
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
    trackDead.clear();
  },
};
