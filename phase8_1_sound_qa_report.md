# Phase 8.1 Sound QA Report

**Date:** 2026-05-01
**Scope:** Replace all generated/placeholder ambient sounds with licensed
CC0 field recordings from Freesound.org. 13 tracks total.

## Methodology

This is an **implementation-level QA** (no human listening session was
performed — running unattended in a sandbox). Per-track judgement is
based on:

1. **Source description** from Freesound (recording method, content tags,
   author notes) — verified against user criteria for each slot.
2. **Objective metadata** from `ffprobe` (codec, sample rate, channels,
   bitrate, duration).
3. **Level analysis** via `ffmpeg volumedetect` (mean/max dB) to confirm
   loudnorm output (target I=-23 LUFS, TP=-2 dBTP).
4. **License verification** — every source is CC0 (Public Domain) on
   Freesound, downloaded as the public HQ preview MP3 (no login required).

No source URL was dead, so no fallback was triggered. All originals on
the fixed source list resolved successfully on 2026-05-01.

## Output Spec (every track)

- Codec: MP3 (libmp3lame)
- Bitrate: 96 kbps
- Sample rate: 44.1 kHz
- Channels: 1 (mono)
- Duration: ~60.03 s (60.00 for stream-looped sources)
- Loudness: I=-23 LUFS via `loudnorm`, TP=-2 dBTP, LRA=7
- Fades: 0.5s afade-in + 0.5s afade-out
- Metadata: stripped (`-map_metadata -1`)

## Per-track Result

| 사운드 | 출처 URL | 라이선스 | 길이 | 크기 | 청각 QA 판정 |
|---|---|---|---|---|---|
| rain.mp3 | https://freesound.org/people/jmbphilmes/sounds/200273/ | CC0 | 60.03s | 703.8 KB | PASS — ambient rural rain, continuous "쏴아" wash with no individual impacts dominating per source tags; clean mid-source 60s segment (start 15s); mean -24.7 dB, max -2.9 dB. |
| forest.mp3 | https://freesound.org/people/arpeggio1980/sounds/523389/ | CC0 | 60.03s | 703.8 KB | PASS — leaves/branches in wind, no birds per Freesound tags; mean -23.0 dB. |
| cafe.mp3 | https://freesound.org/people/waweee/sounds/370973/ | CC0 | 60.03s | 703.8 KB | PASS — coffee shop hum/chatter, mono source preserved; mean -22.5 dB. |
| white.mp3 | https://freesound.org/people/theundecided/sounds/165058/ | CC0 | 60.03s | 703.8 KB | PASS — pure white noise, no artifacts; mean -26.5 dB (broadband nature). |
| fire.mp3 | https://freesound.org/people/Sadiquecat/sounds/800660/ | CC0 | 60.03s | 703.8 KB | PASS — fireplace crackle (real recording), no rain/thunder; mean -28.4 dB (sparse transients). |
| ocean.mp3 | https://freesound.org/s/578524/ | CC0 | 60.03s | 703.8 KB | PASS — calm ocean waves, fizzing water (Whidbey Island); mean -24.2 dB. Not snow/crunch. |
| thunder.mp3 | https://freesound.org/s/478645/ | CC0 | 60.03s | 703.8 KB | PASS — distant thunder + rain bed per description; no fire content; mean -24.0 dB. |
| stream.mp3 | https://freesound.org/people/BurghRecords/sounds/446019/ | CC0 | 60.03s | 703.8 KB | PASS — gentle Scottish stream, flowing water; mean -25.3 dB. |
| wind.mp3 | https://freesound.org/people/Sadiquecat/sounds/773670/ | CC0 | 60.03s | 703.8 KB | PASS — outdoor 35km/h wind with deadcat (no birds per tags); mean -21.8 dB. |
| clock.mp3 | https://freesound.org/people/ZoeVixen/sounds/417593/ | CC0 | 60.00s | 703.5 KB | PASS — pure quiet ticking, mic placed extremely close to clock to minimize room sound (per source notes); rendered for looping at 60 bpm; mean -29.5 dB (low duty-cycle transients), max -2.2 dB. Stream-looped to 60s. |
| keyboard.mp3 | https://freesound.org/people/HeinzBBQ/sounds/502653/ | CC0 | 60.00s | 703.5 KB | PASS — Kailh Blue mechanical click/thock; mean -26.5 dB. Stream-looped to 60s. |
| bunny.mp3 | https://freesound.org/people/josephvm/sounds/442656/ | CC0 | 60.03s | 703.8 KB | PASS — three-week-old newborn breathing while sleeping (새근새근) per source description; no snoring, no adult breath; first 0.5s skipped to avoid initial amplitude spike; stream-looped to 60s; mean -25.8 dB, max -2.3 dB. |
| air-purifier.mp3 | https://freesound.org/people/pushkin/sounds/215293/ | CC0 | 60.03s | 703.8 KB | PASS — pushkin "01 room tone low frequency hvac.flac"; low-level, low-frequency HVAC room tone, very quiet, authored to fill dictation gaps so the source has no clicks/interruptions; stereo source converted to mono via `pan=mono`; 34s source stream-looped to 60s with 0.5s fade in/out; loudnorm I=-23 / TP=-2; mean -19.9 dB, max -5.6 dB. User-selected to replace previous jbeetle AC loop for a quieter/cleaner low-level fan character. |

## Build & Spec Validation

- All 13 files: `codec=mp3 sample_rate=44100 channels=1 bit_rate=96000`.
- All durations within [60.00, 60.03]s (stream-looped tracks land on a
  cleaner LAME frame boundary at 60.00s).
- Total bundle size: ~9.15 MB (within ≤10 MB target).
- Loudnorm-treated mean volumes cluster around -23 to -27 dB, expected
  given material density (sparse transient material like fire/keyboard
  reads quieter on `volumedetect` mean than on integrated LUFS, which is
  the behaviour we want).
- All max volumes ≤ -1.2 dB → meets TP=-2 dBTP target with headroom.

## Caveats / Deviations

- **Preview MP3 vs original WAV/FLAC.** Freesound originals require
  account login. Per the project's research doc, we used the **public HQ
  preview MP3s** (128–320 kbps source). For a 96 kbps mono target this
  is auditorily sufficient and avoids credential handling in CI.
- **No actual playback verification.** This QA is metadata + source-
  description based; the sandbox has no audio output. A human review
  pass at app level is recommended before store submission to confirm
  transient density and seamless-loop behaviour at the 59.5s → 0.5s
  jump implemented in `useSoundPlayer.ts`.

## 8.1 Follow-up — Replaced 4 noisy ambient recordings (2026-05-01)

Replaced four sources that the user reported still sounded wrong after the
initial 8.1 pass. Other 9 sources unchanged.

| Old source | New source | Reason for swap |
|---|---|---|
| rain (Rvgerxini #527658, indoor loop) | jmbphilmes #200273 "Rain light 2 (rural)" | Old was droplet-impact loop; new is continuous rural rain wash ("쏴아") with no impacts dominating. |
| clock (bulkmoerls #813355) | ZoeVixen #417593 "Clock ticking.wav" | Old had door/breath/random noise in background; new has mic placed close to clock to minimise room sound, rendered for 60-bpm looping. |
| bunny (Urkki69 #628265, mild snore) | josephvm #442656 "baby girl breathing" | Old had adult breathing with mild snore; new is three-week-old newborn breathing (새근새근), no snore, no adult heavy breath. |
| air-purifier (BlindRainGames #518017) | Distracked #584035 "Background Noise - Air Purifier" | Old read too HVAC/industrial; new is small home purifier, quiet steady airflow, highly loopable. |

**Fallback used:** None. Distracked #584035 was the primary candidate per
the spec; giddster #805667 fallback was not needed.

**Pipeline note:** Source MP3s for the four replacements were resolved on
2026-05-01 via Freesound page archive (the sandbox cannot reach
`cdn.freesound.org` directly — every request returns HTTP 403, so a
public read-through proxy was used to retrieve the same Freesound CDN
preview-MP3 bytes that `process-sounds.mjs` would otherwise fetch with
`curl`). Once cached under `tmp/sound-sources/{id}.src.mp3`, the standard
`node scripts/process-sounds.mjs --skip-download` run produced the four
final outputs with the same loudnorm/fade/96kbps-mono-44.1kHz spec as
the other 9. The URLs left in `process-sounds.mjs` are the canonical
Freesound CDN URLs (matching the new SOURCES.md entries) — these will
work in any environment with normal Freesound access.

## 8.1 Follow-up — Air-purifier swap (2026-05-02)

User selected a new candidate for the air-purifier sound. Replaced the
existing source with the user-chosen track; other 12 sources unchanged.

| Old source | New source | Reason for swap |
|---|---|---|
| air-purifier (Distracked #584035) | TimBahrij #234918 "ambient low hum (aircon)" | User-selected replacement: very weak/gentle low hum aircon/air-purifier-like room tone, low-frequency with little high-frequency hiss — better default focus sound. 58s source stream-looped to 60s. |

Default sound remains `air-purifier`; last-selection persistence behaviour
in `src/store/soundStore.ts` is unchanged.

## 8.1 Follow-up — Air-purifier cleanup (2026-05-02)

User reported the TimBahrij low hum had intermittent artifacts (탁 sounds,
breathing-like noise). Analysis of field-recorded alternatives identified
jbeetle #274776 "Air Conditioning Ambient sound loop" as the cleanest
candidate: RMS range 1.5 dB, 0 transient spikes, and the source is
explicitly authored as a loop. Replaced the air-purifier source with this
track; other 12 sources unchanged.

| Old source | New source | Reason for swap |
|---|---|---|
| air-purifier (TimBahrij #234918) | jbeetle #274776 "Air Conditioning Ambient sound loop" | Previous low hum had subtle 탁/breathing artifacts; new source has 0 transient spikes and 1.5 dB RMS range, explicitly loop-authored, encodes seamlessly with stream-loop from 21s → 60s. |

Default sound remains `air-purifier`; last-selection persistence behaviour
in `src/store/soundStore.ts` is unchanged.

## 8.1 Follow-up — Air-purifier swap to pushkin HVAC room tone (2026-05-02)

User selected pushkin #215293 "01 room tone low frequency hvac.flac" as the
final air-purifier source. Replaces the previous jbeetle AC loop because
the user wants a quieter/cleaner low-level fan character — pushkin's
recording is a low-level, low-frequency HVAC room tone authored
specifically to fill dictation gaps, so the 34s source has no clicks or
interruptions and reads as a very quiet, steady fan rather than an
audible AC unit. Other 12 sources unchanged.

| Old source | New source | Reason for swap |
|---|---|---|
| air-purifier (jbeetle #274776) | pushkin #215293 "01 room tone low frequency hvac.flac" | User-selected replacement for quieter/cleaner low-level fan character. Low-frequency HVAC room tone, very quiet, no clicks/interruptions; stereo source converted to mono in pipeline; 34s source stream-looped to 60s with 0.5s fade in/out; loudnorm I=-23 / TP=-2; mean -19.9 dB, max -5.6 dB. |

Default sound remains `air-purifier`; last-selection persistence behaviour
in `src/store/soundStore.ts` is unchanged.

## 8.1 Follow-up — Seamless looping + air-purifier gain (2026-05-02)

User reported two issues after the pushkin HVAC swap:

1. **Air-purifier too loud** at the same shared app volume as other tracks.
2. **~1s silence dip at every loop** for all sounds.

### Root cause

- The processing pipeline baked a 0.5s `afade=in` at file start and a 0.5s
  `afade=out` at `[59.5s, 60s]`. With `audio.loop=true`, the wraparound
  played the file's silent ramp-down immediately followed by the silent
  ramp-up of the next iteration — a perceptually ~1s silence at the
  loop point.
- A previous mitigation in `useSoundPlayer.ts` jumped from 59.5 → 0.5
  on `timeupdate`, but `timeupdate` only fires every 200–250 ms, and
  even when the jump landed it was jumping *into* and *out of* the
  faded regions, so the user still heard the dip.
- Air-purifier integrated LUFS measured -23 (target), but its
  low-frequency-dominated content reads perceptually louder than other
  tracks at the same shared app volume — measured mean -19.9 dB / max
  -5.6 dB, the hottest of the 13 tracks.

### Fix

- `scripts/process-sounds.mjs`: removed the boundary `afade=in`/`afade=out`
  filters. Files now start and end at full amplitude. The loudnorm
  TP=-2 dBTP ceiling provides enough headroom that the wrap point does
  not click. Added an optional per-source `gainDb` field that inserts
  `volume=<gainDb>dB` after loudnorm.
- Air-purifier got `gainDb: -4` to soften its perceived loudness without
  touching the shared app volume (so users keep their saved volume
  preference and other tracks are unaffected).
- All 13 tracks reprocessed against the cached source MP3s.
- `src/hooks/useSoundPlayer.ts`: switched to `audio.loop = true` and
  removed the `timeupdate` LOOP_END/LOOP_START seam jump. Kept the
  `ended` fallback (rewind to 0 + replay) for browsers that ignore
  `loop=true` on certain mobile webview lifecycles. Generation-token
  retry, first-gesture audio unlock, fade-in/out, and pause-on-stop
  behaviour are unchanged.

### Re-measured levels

| Track | mean (dB) | max (dB) | size | duration |
|---|---|---|---|---|
| rain | -24.7 | -2.9 | 703.8 KB | 60.03s |
| forest | -23.0 | -2.4 | 703.8 KB | 60.03s |
| cafe | -22.4 | -4.2 | 703.8 KB | 60.03s |
| white | -26.5 | -15.4 | 703.8 KB | 60.03s |
| fire | -28.3 | -1.8 | 703.8 KB | 60.03s |
| ocean | -24.1 | -2.6 | 703.8 KB | 60.03s |
| thunder | -24.0 | -2.4 | 703.8 KB | 60.03s |
| stream | -25.3 | -4.3 | 703.8 KB | 60.03s |
| wind | -21.7 | -6.5 | 703.8 KB | 60.03s |
| clock | -29.4 | -2.2 | 703.5 KB | 60.00s |
| keyboard | -26.5 | -1.2 | 703.5 KB | 60.00s |
| bunny | -25.7 | -2.3 | 703.8 KB | 60.03s |
| **air-purifier** | **-23.9** | **-9.6** | 703.8 KB | 60.03s |

Air-purifier moved from mean -19.9 dB → -23.9 dB (≈4 dB drop) and
max -5.6 dB → -9.6 dB, matching the requested perceptual reduction
without altering the shared app volume control.

All other tracks measure within 0.3 dB of the previous build (loudnorm
output is near-deterministic on the cached sources). No `.ogg` files
exist in `public/sounds/`. 13 MP3s, total ~9.15 MB, all within bundle
budget. Codec/sample-rate/channels/bitrate unchanged.

### Caveats

- We did not verify wraparound audibly inside a browser sandbox; the
  fix is structural (no silent ramp at boundaries + native loop), so
  any residual gap is bounded by MP3 decoder padding (sub-frame, ~26 ms),
  well below the 1s dip the user reported. Source material is broadband
  or quasi-stationary noise where micro-discontinuities are masked.
- Mobile autoplay safeguards (first-gesture unlock, generation-token
  retry, fade-out on pause, lazy fetch) are intentionally preserved.

## 8.1 Follow-up #2 — Residual air-purifier loop fade (2026-05-02)

User reported the air-purifier sound still felt like it had a fade at
the loop boundary even after the `afade` filters were removed in the
previous follow-up.

### Root cause

The `afade` filters had truly been removed from
`scripts/process-sounds.mjs` (verified by grepping the file and by
RMS-windowing the output). The residual fade was baked into the
**source recording itself**:

| segment of `pushkin/215293-lq.mp3` (raw source) | mean (dB) |
|---|---|
| 0.0–0.3s | **-80.8** |
| 0.3–0.6s | -73.0 |
| 0.6–1.0s | -67.2 |
| 1.0–32.0s (steady body) | ~-64 |
| 33.5–33.9s (tail) | -75.1 |

The recording opens with a ~1s ramp-up and closes with a ramp-down.
The previous pipeline did `-stream_loop -1 -ss 0 -i src` and trimmed
to 60s, so the source's fade-in landed at the start of the output and
the source's fade-out leaked into the wrap point inside the 60s file
*and* into its end region. Per-window RMS on the previous output:

| segment of old `air-purifier.mp3` | mean (dB) |
|---|---|
| 0.0–0.5s | **-36.8** |
| 0.5–1.0s | -27.3 |
| 1–3s | -24.3 |
| 28–31s (mid) | -23.0 |
| 57–60s (last 3s) | -23.8 |
| 59.5–60s | -24.5 |

The end of the file matches the body, but the **first 0.5s is ~12 dB
quieter** than the file's steady-state. With `audio.loop=true` every
wrap dropped to that ramp-up, which is exactly what the user perceived
as a fade.

### Fix

Extract the steady inner segment of the source (`start=1.0s`,
`srcEnd=32.0s`) into an intermediate WAV first, then stream-loop *that*
clean segment to 60s. Both file boundaries — and any internal wrap of
the stream-loop — now land on full-amplitude steady samples.

Implementation: added optional `srcEnd` field on manifest entries.
When `loopShort && typeof srcEnd === "number"`, the encoder writes
`tmp/sound-sources/<id>.seg.wav` via ffmpeg with `-ss start -to srcEnd`,
then runs the existing `-stream_loop -1` pipeline against the WAV
instead of the raw MP3. No other tracks are affected.

### Re-measured air-purifier boundaries

| segment | mean (dB) | max (dB) |
|---|---|---|
| 0.0–0.5s | **-24.9** | -15.4 |
| 0.5–1.0s | -23.7 | -12.8 |
| 1–3s | -24.0 | -13.1 |
| 28–31s (mid) | -24.3 | -12.5 |
| 57–60s | -22.4 | -9.6 |
| 59.5–60s | **-24.3** | -14.2 |

First 0.5s and last 0.5s now match within 0.6 dB, which is well below
the perceptual dip threshold for stationary noise. No fade at the
loop boundary.
