/**
 * Procedural SFX engine — Web Audio API synthesis.
 *
 * Used as the always-available fallback (and the only path when the
 * mp3 assets in `public/sounds/` are not shipped). Each `SfxKind`
 * builds a small oscillator/noise + envelope graph and is auto-cleaned
 * when the source finishes.
 *
 * Design constraints (mirrors `src/lib/soundFx.ts`):
 *   - Never autoplay before a user gesture — `AudioContext` is
 *     lazy-created on the first `play()` call and explicitly resumed.
 *   - Silently degrade — `try/catch` around every WebAudio call;
 *     missing API (older browsers / SSR) returns instantly.
 *   - No `localStorage`/`indexedDB` access (forbidden tokens).
 *
 * Why procedural: ships zero binary assets, works offline, deterministic
 * across browsers/devices, no licensing surface. The trade-off is the
 * sounds are synthetic — for "polished" audio users should drop mp3
 * files into `public/sounds/` per the README and the wrapper in
 * `soundFx.ts` will prefer them.
 */

export type ProcSfxKind =
  | "dig"
  | "water"
  | "harvest"
  | "combo"
  | "bunny"
  | "levelup"
  | "giftbox";

interface PlayOpts {
  /** 0..1 multiplier on top of the per-effect gain. Default 1. */
  gain?: number;
  /** Master volume (0..100). Default 100. */
  masterVolume?: number;
  /** Mute flag — short-circuits to no-op. */
  muted?: boolean;
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/** Builds a short white-noise buffer (mono). */
function noiseBuf(ac: AudioContext, durSec: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ac.sampleRate * durSec));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playNoise(
  ac: AudioContext,
  t0: number,
  durSec: number,
  filterType: BiquadFilterType,
  filterFreq: number,
  filterFreqEnd: number,
  peakGain: number,
): void {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf(ac, durSec);
  const filter = ac.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, t0);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(20, filterFreqEnd),
    t0 + durSec,
  );
  filter.Q.setValueAtTime(1.5, t0);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + durSec + 0.05);
}

function playTone(
  ac: AudioContext,
  t0: number,
  freq: number,
  freqEnd: number,
  durSec: number,
  peakGain: number,
  type: OscillatorType = "sine",
): void {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== freq) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, freqEnd),
      t0 + durSec,
    );
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.05);
}

const GENERATORS: Record<
  ProcSfxKind,
  (ac: AudioContext, t0: number, peak: number) => void
> = {
  // dig — short low-frequency noise burst (digging dirt).
  dig: (ac, t0, peak) => {
    playNoise(ac, t0, 0.2, "lowpass", 1200, 200, peak * 0.5);
  },

  // water — softer noise sweep with bandpass (water pouring).
  water: (ac, t0, peak) => {
    playNoise(ac, t0, 0.6, "bandpass", 1400, 700, peak * 0.45);
    playNoise(ac, t0 + 0.05, 0.4, "highpass", 2400, 1800, peak * 0.18);
  },

  // harvest — bright pluck (C5 → E5 quick chirp + bell tail).
  harvest: (ac, t0, peak) => {
    playTone(ac, t0, 523.25, 659.25, 0.18, peak * 0.5, "triangle"); // C5→E5
    playTone(ac, t0 + 0.05, 1046.5, 1046.5, 0.4, peak * 0.25, "sine"); // C6 bell
  },

  // combo — ascending arpeggio C major (C5-E5-G5-C6).
  combo: (ac, t0, peak) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      playTone(ac, t0 + i * 0.12, f, f, 0.22, peak * 0.4, "triangle");
    });
  },

  // bunny — twinkle (two sine pings, high register).
  bunny: (ac, t0, peak) => {
    playTone(ac, t0, 1318.51, 1318.51, 0.18, peak * 0.35, "sine"); // E6
    playTone(ac, t0 + 0.1, 1975.53, 1975.53, 0.3, peak * 0.3, "sine"); // B6
  },

  // levelup — fanfare (perfect fifth + octave overlay).
  levelup: (ac, t0, peak) => {
    // C5-G5-C6 quick + sustained C6
    playTone(ac, t0 + 0.0, 523.25, 523.25, 0.18, peak * 0.4, "square");
    playTone(ac, t0 + 0.15, 783.99, 783.99, 0.18, peak * 0.4, "square");
    playTone(ac, t0 + 0.3, 1046.5, 1046.5, 0.5, peak * 0.5, "triangle");
    playTone(ac, t0 + 0.3, 1318.51, 1318.51, 0.7, peak * 0.25, "sine"); // shimmer E6
  },

  // giftbox — magic shimmer (noise pop + ascending sine cluster).
  giftbox: (ac, t0, peak) => {
    playNoise(ac, t0, 0.18, "highpass", 4000, 2500, peak * 0.3);
    playTone(ac, t0 + 0.05, 1046.5, 1567.98, 0.35, peak * 0.35, "sine");
    playTone(ac, t0 + 0.12, 2093.0, 2637.02, 0.4, peak * 0.2, "sine");
  },
};

export function playProcSfx(kind: ProcSfxKind, opts: PlayOpts = {}): boolean {
  if (opts.muted) return false;
  const ac = getCtx();
  if (!ac) return false;
  // Some browsers leave the context suspended until a user gesture
  // event resumes it. Calling resume() inside a tap handler is safe.
  if (ac.state === "suspended") {
    try {
      void ac.resume();
    } catch {
      /* ignore */
    }
  }
  const master = clamp01((opts.masterVolume ?? 100) / 100);
  if (master === 0) return false;
  const gain = clamp01(opts.gain ?? 1.0);
  // SFX cap at 0.35 like the mp3 path keeps to (was 0.45 there;
  // procedural waves have higher peak energy so we cap a touch lower).
  const peak = clamp01(master * gain * 0.35);
  try {
    const gen = GENERATORS[kind];
    if (!gen) return false;
    gen(ac, ac.currentTime, peak);
    return true;
  } catch {
    return false;
  }
}

/** Test seam — close + null the shared AudioContext. */
export function _resetProcSfx(): void {
  try {
    ctx?.close();
  } catch {
    /* ignore */
  }
  ctx = null;
}
