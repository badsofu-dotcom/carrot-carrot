#!/usr/bin/env python3
"""
Procedural ambience generation for the carrot-carrot sound catalog.

DESIGN RULES (read before editing):
  * `white.ogg` is THE ONLY track allowed to use a broad white/pink-noise bed.
    Every other ambience MUST be built from character-specific layers (granular
    droplets, transient pops, voice formant grains, mechanical clicks, etc.)
    and must NOT lay a continuous filtered-noise bed underneath. Users hear a
    shared noise bed as "white noise with X on top", which is exactly the
    feedback we are correcting.
  * If a generator needs a low background, prefer SPARSE layered grains or
    sub-100Hz rumble — never wideband filtered noise as a continuous bed.
  * All loops are seamless (head/tail crossfade), 30-40s, encoded to Vorbis
    OGG via ffmpeg. Keep file size under ~400KB.
  * Normalise gently (-3 to -6 dBFS peak) so volume is comfortable at the
    77% default without obvious clipping.

Output: PCM WAV in /tmp/cc-sounds/<id>.wav, then OGG in public/sounds/<id>.ogg.
"""

from __future__ import annotations

import math
import subprocess
import sys
import wave
from pathlib import Path
from typing import Callable

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_SOUNDS = ROOT / "public" / "sounds"
TMP = Path("/tmp/cc-sounds")
TMP.mkdir(parents=True, exist_ok=True)

SR = 44100
RNG = np.random.default_rng(0xCA770700)


# ---------- low-level helpers ----------------------------------------------------

def _lowpass(x: np.ndarray, cutoff_hz: float, sr: int = SR, order: int = 2) -> np.ndarray:
    if cutoff_hz <= 0:
        return x.copy()
    rc = 1.0 / (2.0 * math.pi * cutoff_hz)
    dt = 1.0 / sr
    alpha = dt / (rc + dt)
    y = x.copy()
    for _ in range(order):
        out = np.empty_like(y)
        prev = 0.0
        for i in range(len(y)):
            prev = prev + alpha * (y[i] - prev)
            out[i] = prev
        y = out
    return y


def _highpass(x: np.ndarray, cutoff_hz: float, sr: int = SR) -> np.ndarray:
    if cutoff_hz <= 0:
        return x.copy()
    rc = 1.0 / (2.0 * math.pi * cutoff_hz)
    dt = 1.0 / sr
    alpha = rc / (rc + dt)
    y = np.empty_like(x)
    prev_x = 0.0
    prev_y = 0.0
    for i in range(len(x)):
        prev_y = alpha * (prev_y + x[i] - prev_x)
        prev_x = x[i]
        y[i] = prev_y
    return y


def _normalise(x: np.ndarray, peak_db: float = -3.0) -> np.ndarray:
    peak = float(np.max(np.abs(x))) or 1.0
    target = 10 ** (peak_db / 20.0)
    return x * (target / peak)


def _seamless(x: np.ndarray, tail_s: float = 1.0, sr: int = SR) -> np.ndarray:
    """Make a buffer loop cleanly by crossfading its tail with its head."""
    n = len(x)
    tail = min(int(tail_s * sr), n // 3)
    if tail < 16:
        return x
    fade = np.linspace(0, 1, tail, dtype=np.float32)
    head = x[:tail]
    body = x[tail:n - tail].copy()
    tail_seg = x[n - tail:]
    blended = head * fade + tail_seg * (1.0 - fade)
    return np.concatenate([blended, body])


def _save_wav(path: Path, x: np.ndarray, sr: int = SR) -> None:
    x16 = np.clip(x, -1.0, 1.0)
    x16 = (x16 * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(x16.tobytes())


def _encode_ogg(wav: Path, ogg: Path, quality: str = "3") -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(wav),
            "-c:a", "libvorbis", "-q:a", quality,
            "-ac", "1", "-ar", str(SR),
            str(ogg),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _grain(length: int, low_hz: float, high_hz: float) -> np.ndarray:
    """Bandpassed noise grain — NOT a continuous bed. Used as a building block."""
    seg = RNG.standard_normal(length).astype(np.float32)
    seg = _highpass(seg, low_hz)
    seg = _lowpass(seg, high_hz)
    return seg


# ---------- generators ----------------------------------------------------------
#
# Reminder: only `gen_white` may use a continuous wideband noise bed. All other
# generators must build from grains, transients, oscillators, or sub-100Hz
# rumble — no wideband hiss bed laid under the character-specific elements.


def gen_white(duration_s: float = 32.0) -> np.ndarray:
    """Pink/brown noise — the ONLY track that is allowed to be a noise bed."""
    n = int(duration_s * SR)
    white = RNG.standard_normal(n).astype(np.float32)
    pink = np.cumsum(white) / SR * 6.0
    pink = pink - np.mean(pink)
    pink = _lowpass(pink, 5500.0)
    pink = _highpass(pink, 90.0)
    pink = _seamless(pink, tail_s=2.0)
    return _normalise(pink, -5.0)


def gen_rain(duration_s: float = 36.0) -> np.ndarray:
    """Continuous rain made entirely from droplet/spatter grains.

    No wideband noise bed: the body is a dense field of short bandpassed grains
    so the sound has a rolloff and motion of real rainfall instead of a flat
    hiss carpet.
    """
    n = int(duration_s * SR)
    out = np.zeros(n, dtype=np.float32)

    # Layer 1: dense fine spatter — tens of thousands of very short grains.
    # Each grain is short and bandpassed so there is no continuous broadband bed.
    n_fine = int(duration_s * 1800)  # ~1800/sec, but each grain ~3ms
    for _ in range(n_fine):
        idx = int(RNG.integers(0, n - 200))
        L = int(RNG.integers(60, 160))
        amp = float(RNG.uniform(0.015, 0.06))
        decay = np.exp(-np.arange(L) / RNG.uniform(8.0, 18.0)).astype(np.float32)
        g = RNG.standard_normal(L).astype(np.float32) * decay * amp
        # shape each grain into mid/upper band so combined cloud rolls off
        # naturally instead of feeling like full-spectrum hiss
        if RNG.random() < 0.5:
            g = _highpass(g, 1200.0)
            g = _lowpass(g, 4500.0)
        else:
            g = _highpass(g, 600.0)
            g = _lowpass(g, 2800.0)
        out[idx:idx + L] += g

    # Layer 2: discrete droplet plops — louder, sparser, with audible ping.
    n_drops = int(duration_s * 14)
    for _ in range(n_drops):
        idx = int(RNG.integers(0, n - 600))
        L = 320
        f = float(RNG.uniform(2200.0, 4200.0))
        tt = np.arange(L) / SR
        env = np.exp(-tt * RNG.uniform(35.0, 80.0)).astype(np.float32)
        amp = float(RNG.uniform(0.07, 0.16))
        # plop = quick noise burst + small resonant ping
        burst = RNG.standard_normal(L).astype(np.float32) * env * amp
        ping = (np.sin(2 * math.pi * f * tt) * env * amp * 0.35).astype(np.float32)
        plop = _highpass(burst + ping, 1500.0)
        plop = _lowpass(plop, 6000.0)
        out[idx:idx + L] += plop

    # Layer 3: very low rumble of distant rain (sub-200Hz) — narrow, not wide.
    rumble_seed = RNG.standard_normal(n).astype(np.float32)
    rumble = _lowpass(rumble_seed, 140.0)
    rumble = _highpass(rumble, 40.0) * 0.18
    out = out + rumble

    out = _seamless(out, tail_s=2.0)
    return _normalise(out, -4.5)


def gen_forest(duration_s: float = 36.0) -> np.ndarray:
    """Forest: bird chirps, leaf rustles, occasional air movement.

    No constant wind/hiss bed — the ambience is silence punctuated by
    rustles, chirps, and brief tree-canopy whispers.
    """
    n = int(duration_s * SR)
    out = np.zeros(n, dtype=np.float32)

    # Leaf rustles — short bursts of high-band grain, NOT a continuous bed.
    n_rustles = int(duration_s * 2.2)
    for _ in range(n_rustles):
        idx = int(RNG.integers(0, n - 12000))
        L = int(RNG.integers(3500, 11000))
        seg = _grain(L, low_hz=1500.0, high_hz=5500.0)
        env = np.hanning(L).astype(np.float32) ** 1.4
        amp = float(RNG.uniform(0.18, 0.45))
        out[idx:idx + L] += seg * env * amp

    # Bird chirps — frequency-modulated tones with warble.
    n_chirps = int(duration_s * 0.9)
    for _ in range(n_chirps):
        idx = int(RNG.integers(SR // 2, n - SR))
        L = int(RNG.integers(1500, 4200))
        f0 = float(RNG.uniform(1800.0, 3600.0))
        f1 = f0 + float(RNG.uniform(-500.0, 700.0))
        tt = np.arange(L) / SR
        freq = np.linspace(f0, f1, L)
        phase = 2 * math.pi * np.cumsum(freq) / SR
        env = (np.hanning(L).astype(np.float32) ** 1.2) * float(RNG.uniform(0.14, 0.28))
        warble_rate = float(RNG.uniform(7.0, 16.0))
        chirp = (np.sin(phase) * env).astype(np.float32)
        chirp *= (0.65 + 0.35 * np.sin(2 * math.pi * tt * warble_rate)).astype(np.float32)
        out[idx:idx + L] += chirp

    # Sparse short canopy whispers — very low amplitude, short duration.
    n_whispers = int(duration_s * 0.4)
    for _ in range(n_whispers):
        idx = int(RNG.integers(0, n - 30000))
        L = int(RNG.integers(15000, 28000))
        whisper = _grain(L, low_hz=200.0, high_hz=900.0)
        env = np.hanning(L).astype(np.float32)
        out[idx:idx + L] += whisper * env * 0.10

    out = _seamless(out, tail_s=2.0)
    return _normalise(out, -5.0)


def gen_cafe(duration_s: float = 36.0) -> np.ndarray:
    """Cafe 분위기 — soft room tone + sparse human murmur grains + ceramic clinks.

    Critical: this used to sound like white noise with cafe sprinkles. Rewrite
    avoids any continuous filtered-noise bed. The "room" is built from a very
    low rumble (HVAC suggestion), and human presence is rendered as discrete
    voice-formant grains with realistic envelopes — like overhearing snippets,
    not a hiss.
    """
    n = int(duration_s * SR)
    out = np.zeros(n, dtype=np.float32)

    # 1) Sub-200Hz HVAC/room rumble — narrow, not wide. This is the ONLY
    #    continuous element and it is below the speech band so it doesn't
    #    read as "noise".
    rumble_seed = RNG.standard_normal(n).astype(np.float32)
    rumble = _lowpass(rumble_seed, 120.0)
    rumble = _highpass(rumble, 35.0)
    rumble *= 0.22
    out = out + rumble

    # 2) Voice formant grains — short bandpassed bursts shaped to suggest
    #    speech consonants/vowels in the distance. Each grain has its own
    #    envelope and is gapped by silence.
    n_voice = int(duration_s * 2.4)
    for _ in range(n_voice):
        idx = int(RNG.integers(0, n - 14000))
        L = int(RNG.integers(2800, 9000))
        # Pick a vowel-ish formant pair
        f1 = float(RNG.uniform(450.0, 900.0))
        f2 = float(RNG.uniform(1200.0, 2200.0))
        tt = np.arange(L) / SR
        # Voiced segment: two narrow bands of noise centered near formants
        seed = RNG.standard_normal(L).astype(np.float32)
        band1 = _lowpass(_highpass(seed, f1 * 0.7), f1 * 1.4) * 0.55
        band2 = _lowpass(_highpass(seed, f2 * 0.75), f2 * 1.35) * 0.35
        # gentle pitch wobble suggestion via amplitude modulation
        wobble = (0.7 + 0.3 * np.sin(2 * math.pi * tt * RNG.uniform(3.0, 7.0))).astype(np.float32)
        env = (np.hanning(L).astype(np.float32) ** 1.3) * float(RNG.uniform(0.18, 0.34))
        voice = (band1 + band2) * wobble * env
        out[idx:idx + L] += voice.astype(np.float32)

    # 3) Discrete laughter/syllable bursts — even shorter, slightly louder.
    n_burst = int(duration_s * 0.45)
    for _ in range(n_burst):
        idx = int(RNG.integers(0, n - 8000))
        L = int(RNG.integers(1500, 4500))
        f = float(RNG.uniform(280.0, 520.0))
        tt = np.arange(L) / SR
        # voiced burst — buzzy band around a low formant + harmonics
        seed = RNG.standard_normal(L).astype(np.float32)
        body = _lowpass(_highpass(seed, f * 0.6), f * 2.5)
        env = (np.hanning(L).astype(np.float32) ** 1.4) * float(RNG.uniform(0.22, 0.40))
        out[idx:idx + L] += (body * env).astype(np.float32)

    # 4) Ceramic cup clinks + spoon stirs — sparse and clearly audible.
    n_clink = int(duration_s * 0.35)
    for _ in range(n_clink):
        idx = int(RNG.integers(0, n - 6000))
        L = 4000
        f = float(RNG.uniform(2400.0, 4200.0))
        tt = np.arange(L) / SR
        env = np.exp(-tt * float(RNG.uniform(8.0, 14.0))).astype(np.float32)
        amp = float(RNG.uniform(0.25, 0.45))
        clink = (np.sin(2 * math.pi * f * tt) + 0.42 * np.sin(2 * math.pi * f * 1.74 * tt)
                 + 0.20 * np.sin(2 * math.pi * f * 2.51 * tt)).astype(np.float32)
        clink *= env * amp
        out[idx:idx + L] += clink

    # 5) Very occasional chair/wood movement — sub-band thump.
    n_chair = max(1, int(duration_s / 11))
    for _ in range(n_chair):
        idx = int(RNG.integers(SR, n - SR))
        L = int(RNG.integers(int(0.25 * SR), int(0.55 * SR)))
        seed = RNG.standard_normal(L).astype(np.float32)
        thump = _lowpass(seed, 320.0)
        thump = _highpass(thump, 70.0)
        env = np.exp(-np.arange(L) / (L * 0.35)).astype(np.float32)
        out[idx:idx + L] += thump * env * float(RNG.uniform(0.18, 0.30))

    out = _seamless(out, tail_s=2.0)
    return _normalise(out, -5.0)


def gen_fire(duration_s: float = 36.0) -> np.ndarray:
    """Fireplace: warm sub-band rumble + sharp crackle pops. No hiss bed."""
    n = int(duration_s * SR)
    out = np.zeros(n, dtype=np.float32)

    # Sub-band warmth (narrow rumble, not a wide bed).
    rumble = _lowpass(RNG.standard_normal(n).astype(np.float32), 220.0)
    rumble = _highpass(rumble, 50.0) * 0.45
    # slow amplitude drift
    t = np.arange(n) / SR
    drift = (0.7 + 0.3 * np.sin(2 * math.pi * t / 9.0)).astype(np.float32)
    out = out + (rumble * drift).astype(np.float32)

    # Crackles — many short transients at varied intensities.
    n_pops = int(duration_s * 9)
    for _ in range(n_pops):
        idx = int(RNG.integers(0, n - 700))
        L = int(RNG.integers(120, 600))
        amp = float(RNG.uniform(0.18, 0.65))
        decay = np.exp(-np.arange(L) / float(RNG.uniform(18.0, 75.0))).astype(np.float32)
        c = RNG.standard_normal(L).astype(np.float32) * decay * amp
        c = _highpass(c, 900.0)
        c = _lowpass(c, 5500.0)
        out[idx:idx + L] += c

    # Occasional larger pop with secondary ring.
    n_big = int(duration_s * 0.5)
    for _ in range(n_big):
        idx = int(RNG.integers(0, n - 1800))
        L = int(RNG.integers(800, 1600))
        decay = np.exp(-np.arange(L) / 60.0).astype(np.float32)
        c = RNG.standard_normal(L).astype(np.float32) * decay * float(RNG.uniform(0.45, 0.85))
        c = _highpass(c, 600.0)
        c = _lowpass(c, 4000.0)
        out[idx:idx + L] += c

    out = _seamless(out, tail_s=2.0)
    return _normalise(out, -4.5)


def gen_ocean(duration_s: float = 38.0) -> np.ndarray:
    """Ocean: slow swelling water grains + sub rumble. No continuous hiss."""
    n = int(duration_s * SR)
    out = np.zeros(n, dtype=np.float32)

    # Wave envelope from overlaid sinusoids.
    t = np.arange(n) / SR
    wave_env = np.zeros(n, dtype=np.float32)
    for period, phase, weight in [(8.5, 0.0, 0.55), (12.0, 1.3, 0.4), (5.4, 0.7, 0.3)]:
        wave_env += weight * (0.5 + 0.5 * np.sin(2 * math.pi * t / period + phase)).astype(np.float32)
    wave_env = wave_env / wave_env.max()
    wave_env = (0.18 + 0.82 * wave_env).astype(np.float32)

    # Surf grains — many short bandpassed bursts riding the wave envelope.
    n_grains = int(duration_s * 90)
    for _ in range(n_grains):
        idx = int(RNG.integers(0, n - 4000))
        L = int(RNG.integers(900, 3600))
        seg = _grain(L, low_hz=400.0, high_hz=2200.0)
        env = np.hanning(L).astype(np.float32) * float(RNG.uniform(0.12, 0.24))
        out[idx:idx + L] += (seg * env).astype(np.float32)

    # Apply the slow wave envelope so surf swells in/out.
    out = (out * wave_env).astype(np.float32)

    # Sub-rumble of the deep — narrow band, not wide.
    deep = _lowpass(RNG.standard_normal(n).astype(np.float32), 130.0)
    deep = _highpass(deep, 35.0) * 0.30
    out = out + deep

    out = _seamless(out, tail_s=2.5)
    return _normalise(out, -4.5)


def gen_thunder(duration_s: float = 38.0) -> np.ndarray:
    """Thunder ambience: rain (grain-based) + occasional distant low rumbles."""
    rain_bed = gen_rain(duration_s) * 0.55
    n = len(rain_bed)
    rumbles = np.zeros(n, dtype=np.float32)
    for _ in range(int(duration_s / 8)):
        idx = int(RNG.integers(SR, n - 4 * SR))
        L = int(RNG.uniform(2.0, 3.8) * SR)
        seg = RNG.standard_normal(L).astype(np.float32)
        seg = _lowpass(seg, 200.0)
        seg = _highpass(seg, 30.0)
        env = np.exp(-np.arange(L) / (L * 0.45)).astype(np.float32)
        attack = min(SR // 2, L)
        env[:attack] *= np.linspace(0, 1, attack) ** 1.5
        rumbles[idx:idx + L] += seg * env * float(RNG.uniform(0.55, 1.0))
    out = rain_bed + rumbles
    out = _seamless(out, tail_s=2.0)
    return _normalise(out, -4.0)


def gen_stream(duration_s: float = 36.0) -> np.ndarray:
    """Stream: dense bubble/burble grains. No flat water-noise bed."""
    n = int(duration_s * SR)
    out = np.zeros(n, dtype=np.float32)

    # Bubble pops — thousands of short tonal bubbles in mid band.
    n_bubbles = int(duration_s * 90)
    for _ in range(n_bubbles):
        idx = int(RNG.integers(0, n - 500))
        L = int(RNG.integers(80, 380))
        f = float(RNG.uniform(700.0, 2600.0))
        tt = np.arange(L) / SR
        decay = float(RNG.uniform(30.0, 95.0))
        env = np.exp(-tt * decay).astype(np.float32)
        amp = float(RNG.uniform(0.06, 0.18))
        # bubble = quick rising freq sweep
        f_sweep = np.linspace(f * 0.85, f * 1.15, L)
        phase = 2 * math.pi * np.cumsum(f_sweep) / SR
        b = (np.sin(phase) * env * amp).astype(np.float32)
        out[idx:idx + L] += b

    # Mid burble grains — short noise grains bandpassed.
    n_grains = int(duration_s * 120)
    for _ in range(n_grains):
        idx = int(RNG.integers(0, n - 800))
        L = int(RNG.integers(180, 700))
        seg = _grain(L, low_hz=400.0, high_hz=2400.0)
        env = np.hanning(L).astype(np.float32) * float(RNG.uniform(0.06, 0.13))
        out[idx:idx + L] += (seg * env).astype(np.float32)

    # Sub-rumble of moving water mass — narrow band.
    deep = _lowpass(RNG.standard_normal(n).astype(np.float32), 160.0)
    deep = _highpass(deep, 45.0) * 0.22
    out = out + deep

    out = _seamless(out, tail_s=2.0)
    return _normalise(out, -4.5)


def gen_wind(duration_s: float = 36.0) -> np.ndarray:
    """Wind: gust grains, not a continuous filtered-noise bed.

    Each gust is a swell-envelope on a narrow band of noise, with quiet gaps
    between. Sub-bass settle adds weight without hissing.
    """
    n = int(duration_s * SR)
    out = np.zeros(n, dtype=np.float32)

    # Long gusts (overlapping) — between 3-8s each, tapered envelopes.
    t_cursor = 0
    while t_cursor < n - SR:
        L = int(RNG.uniform(2.5, 7.5) * SR)
        if t_cursor + L > n:
            L = n - t_cursor
        seg = _grain(L, low_hz=80.0, high_hz=520.0)
        # gentle whistle layer (narrow band, low amplitude) with same envelope
        whistle = _grain(L, low_hz=900.0, high_hz=1900.0) * 0.18
        env_shape = np.hanning(L).astype(np.float32) ** 1.5
        amp = float(RNG.uniform(0.45, 0.85))
        out[t_cursor:t_cursor + L] += (seg + whistle) * env_shape * amp
        # advance with overlap so gusts blend, but never produce a flat bed
        t_cursor += int(L * float(RNG.uniform(0.55, 0.85)))

    # Very low settle (sub-100Hz) — narrow, not wide.
    settle = _lowpass(RNG.standard_normal(n).astype(np.float32), 90.0)
    settle = _highpass(settle, 35.0) * 0.18
    out = out + settle

    out = _seamless(out, tail_s=2.0)
    return _normalise(out, -5.0)


def gen_clock(duration_s: float = 32.0) -> np.ndarray:
    """Analog wall clock: alternating tick/tock with subtle mechanism noise.

    Mechanical clicks only — no digital beep, no hiss bed.
    """
    sr = SR
    n = int(duration_s * sr)
    out = np.zeros(n, dtype=np.float32)
    interval = sr // 2  # 0.5s per beat

    def _click(freq: float, length: int = 900, decay: float = 28.0, amp: float = 0.9) -> np.ndarray:
        tt = np.arange(length) / sr
        body = RNG.standard_normal(length).astype(np.float32) * 0.6
        body += (np.sin(2 * math.pi * freq * tt).astype(np.float32) * 0.4)
        env = np.exp(-tt * decay).astype(np.float32)
        env[:24] *= np.linspace(0, 1, 24)
        click = body * env * amp
        click = _highpass(click, 1200.0)
        click = _lowpass(click, 6500.0)
        return click

    tick = _click(2400.0, length=900, decay=28.0, amp=0.95)
    tock = _click(1750.0, length=900, decay=26.0, amp=0.85)
    n_beats = n // interval
    for k in range(n_beats):
        idx = k * interval
        c = tick if (k % 2 == 0) else tock
        L = min(len(c), n - idx)
        out[idx:idx + L] += c[:L]

    # Faint mechanical hum — narrow sub-band only (no broadband hiss).
    hum = _lowpass(RNG.standard_normal(n).astype(np.float32), 130.0) * 0.04
    out = out + hum

    out = _seamless(out, tail_s=0.05)
    return _normalise(out, -4.0)


def gen_keyboard(duration_s: float = 30.0) -> np.ndarray:
    """Mechanical keyboard typing — varied keystrokes at human cadence.

    Click + body resonance + up-stroke. No tone pulses, no hiss bed.
    """
    sr = SR
    n = int(duration_s * sr)
    out = np.zeros(n, dtype=np.float32)

    def _keypress(amp: float = 0.7) -> np.ndarray:
        L_click = int(RNG.integers(180, 320))
        click = RNG.standard_normal(L_click).astype(np.float32)
        env = np.exp(-np.arange(L_click) / float(RNG.uniform(8.0, 20.0))).astype(np.float32)
        click = click * env

        L_body = int(RNG.integers(380, 880))
        f = float(RNG.uniform(180.0, 380.0))
        tt = np.arange(L_body) / sr
        body = (np.sin(2 * math.pi * f * tt) * 0.4
                + np.sin(2 * math.pi * f * 2.1 * tt) * 0.25).astype(np.float32)
        body_env = np.exp(-tt * float(RNG.uniform(35.0, 70.0))).astype(np.float32)
        body = body * body_env * 0.55

        L_up = int(RNG.integers(120, 240))
        up_gap = int(RNG.integers(int(0.04 * sr), int(0.09 * sr)))
        up = RNG.standard_normal(L_up).astype(np.float32)
        up_env = np.exp(-np.arange(L_up) / float(RNG.uniform(10.0, 20.0))).astype(np.float32) * 0.55
        up = up * up_env

        total_len = max(L_click, L_body, up_gap + L_up)
        seg = np.zeros(total_len, dtype=np.float32)
        seg[:L_click] += click * amp
        seg[:L_body] += body * amp * 0.85
        seg[up_gap:up_gap + L_up] += up * amp * 0.7
        seg = _highpass(seg, 600.0)
        seg = _lowpass(seg, 7500.0)
        return seg

    t_cursor = 0
    while t_cursor < n - sr:
        roll = RNG.random()
        if roll < 0.7:
            gap = float(RNG.uniform(0.07, 0.18))
        elif roll < 0.92:
            gap = float(RNG.uniform(0.20, 0.45))
        else:
            gap = float(RNG.uniform(0.6, 1.4))
        t_cursor += int(gap * sr)
        if t_cursor >= n - sr:
            break
        amp = float(RNG.uniform(0.55, 0.95))
        seg = _keypress(amp=amp)
        L = min(len(seg), n - t_cursor)
        out[t_cursor:t_cursor + L] += seg[:L]

    # Sub-band plate resonance — VERY low, narrow. Not a hiss bed.
    plate = _lowpass(RNG.standard_normal(n).astype(np.float32), 150.0) * 0.018
    out = out + plate
    out = _seamless(out, tail_s=0.5)
    return _normalise(out, -4.5)


def gen_air_purifier(duration_s: float = 32.0) -> np.ndarray:
    """Air purifier on low — soft, rounded airflow. No broadband hiss bed.

    Built from three narrow, character-specific layers:
      1) Sub-200Hz motor rumble (narrow band) — the "machine is on" undertone.
      2) A NARROW mid-band airflow texture (≈300-900Hz only) shaped by very
         slow amplitude drift, so it reads as moving air through a filter
         rather than wideband hiss. The band is narrow enough that it does
         NOT sound like a white-noise bed — it is a rounded "whoosh".
      3) A faint sub-bass blade-pulse pumping at ~28Hz, low amplitude, to
         suggest fan blade rotation without becoming pulsing/digital.

    The mid band is intentionally cut at 900Hz to avoid any high-frequency
    hiss; the low edge at 300Hz keeps it from muddying the motor rumble.
    Combined character: clean, gentle, steady — not a noise carpet.
    """
    n = int(duration_s * SR)
    t = np.arange(n) / SR

    # 1) Motor rumble — narrow sub-band, not wide.
    motor_seed = RNG.standard_normal(n).astype(np.float32)
    motor = _lowpass(motor_seed, 180.0)
    motor = _highpass(motor, 55.0)
    # Slow drift so it isn't perfectly static (machines breathe a little).
    motor_drift = (0.85 + 0.15 * np.sin(2 * math.pi * t / 11.0)).astype(np.float32)
    motor = motor * motor_drift * 0.35

    # 2) Narrow airflow band — 300-900Hz only. This is the "rounded air"
    #    layer. Critically narrow so it does not become a white-noise bed.
    air_seed = RNG.standard_normal(n).astype(np.float32)
    air = _highpass(air_seed, 300.0)
    air = _lowpass(air, 900.0)
    # Two more lowpass passes to round it further (extra rolloff above 900Hz)
    # so any residual high content is killed → no hissy character.
    air = _lowpass(air, 1100.0, order=2)
    # Very slow amplitude drift — different period from motor — to suggest
    # gentle airflow modulation without pulsing.
    air_drift = (0.78
                 + 0.12 * np.sin(2 * math.pi * t / 7.3)
                 + 0.06 * np.sin(2 * math.pi * t / 13.7 + 0.9)).astype(np.float32)
    air = air * air_drift * 0.42

    # 3) Sub-bass blade pulse — quiet, slow, rounded. Adds "fan is spinning"
    #    cue without becoming a tone. ~28Hz with a soft second harmonic.
    blade_freq = 28.0
    blade = (np.sin(2 * math.pi * blade_freq * t)
             + 0.25 * np.sin(2 * math.pi * blade_freq * 2.0 * t + 0.6)).astype(np.float32)
    blade = blade * 0.06  # very faint

    out = motor + air + blade

    # Final guard: gentle lowpass at 1.1kHz to ensure no upper-band hiss
    # leaks through anywhere in the mix.
    out = _lowpass(out, 1100.0)

    out = _seamless(out, tail_s=2.0)
    return _normalise(out, -6.0)


def gen_bunny(duration_s: float = 30.0) -> np.ndarray:
    """Bunny: very soft purr-like rhythmic puffs. No hiss bed.

    Each breath uses a narrow low-band grain shaped into a swell envelope, so
    the rhythm reads as breathing/purring rather than band-limited noise.
    """
    sr = SR
    n = int(duration_s * sr)
    out = np.zeros(n, dtype=np.float32)
    period = int(sr * 1.5)
    inhale = int(period * 0.40)
    exhale = int(period * 0.50)
    n_breaths = n // period
    for k in range(n_breaths):
        idx = k * period
        # inhale — short narrow-band grain with sin envelope
        in_seed = RNG.standard_normal(inhale).astype(np.float32)
        in_band = _lowpass(_highpass(in_seed, 250.0), 1200.0)
        in_env = np.sin(np.linspace(0, math.pi, inhale)).astype(np.float32) ** 1.6
        out[idx:idx + inhale] += in_band * in_env * 0.50
        # exhale — slightly warmer, slower
        ex_seed = RNG.standard_normal(exhale).astype(np.float32)
        ex_band = _lowpass(_highpass(ex_seed, 180.0), 950.0)
        ex_env = np.sin(np.linspace(0, math.pi, exhale)).astype(np.float32) ** 1.3
        out[idx + inhale:idx + inhale + exhale] += ex_band * ex_env * 0.60

    out = out[: n_breaths * period]
    out = _seamless(out, tail_s=0.3)
    return _normalise(out, -6.0)


# ---------- driver --------------------------------------------------------------

GENERATORS: dict[str, Callable[[], np.ndarray]] = {
    "rain": gen_rain,
    "white": gen_white,
    "forest": gen_forest,
    "cafe": gen_cafe,
    "fire": gen_fire,
    "ocean": gen_ocean,
    "thunder": gen_thunder,
    "stream": gen_stream,
    "wind": gen_wind,
    "clock": gen_clock,
    "keyboard": gen_keyboard,
    "bunny": gen_bunny,
    "air-purifier": gen_air_purifier,
}


def main(argv: list[str]) -> int:
    targets = argv[1:] or list(GENERATORS.keys())
    for name in targets:
        if name not in GENERATORS:
            print(f"unknown sound: {name}", file=sys.stderr)
            continue
        print(f"[gen] {name} ...", flush=True)
        x = GENERATORS[name]()
        wav = TMP / f"{name}.wav"
        ogg = PUBLIC_SOUNDS / f"{name}.ogg"
        _save_wav(wav, x)
        _encode_ogg(wav, ogg, quality="3")
        size_kb = ogg.stat().st_size // 1024
        print(f"      → {ogg.relative_to(ROOT)}  ({size_kb} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
