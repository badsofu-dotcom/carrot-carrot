#!/usr/bin/env node
// Phase 8.1 — Licensed field-recording pipeline.
//
// These are real CC0 field recordings sourced from Freesound, NOT generated audio.
// We use Freesound public HQ preview MP3s (no login required) and re-encode to
// app spec: MP3 96kbps, 44.1kHz, mono, ~60s, loudnorm I=-23 LRA=7 TP=-2.
// Short sources are stream-looped to reach 60s.
//
// Loop continuity: NO boundary fade-in/fade-out is baked in — those would make
// the file ramp to silence at start/end and produce an audible ~1s dip every
// loop. The loudnorm true-peak ceiling at -2 dBTP gives enough headroom to
// avoid clicks at the wrap. Playback uses native `audio.loop=true`.
//
// Per-source gain: some sources are perceptually hotter than others even after
// loudnorm (low-frequency content reads quieter on integrated LUFS than its
// perceived loudness). `gainDb` lets us trim those individually so app-level
// volume can stay shared across all tracks.
//
// Usage:  node scripts/process-sounds.mjs
//         node scripts/process-sounds.mjs --skip-download   (re-encode only)

import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, statSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const TMP = join(ROOT, "tmp", "sound-sources");
const OUT = join(ROOT, "public", "sounds");

const SKIP_DOWNLOAD = process.argv.includes("--skip-download");

mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

// Fixed source manifest. Real CC0 field recordings hosted on freesound.org.
// `srcSeconds` from Freesound metadata. `start` is trim offset within source.
const MANIFEST = [
  { id: "rain", url: "https://cdn.freesound.org/previews/200/200273_2322692-hq.mp3", srcSeconds: 95, start: 15, loopShort: false },
  { id: "forest", url: "https://cdn.freesound.org/previews/523/523389_2010973-hq.mp3", srcSeconds: 139, start: 10 },
  { id: "cafe", url: "https://cdn.freesound.org/previews/370/370973_5835751-hq.mp3", srcSeconds: 296, start: 20 },
  { id: "white", url: "https://cdn.freesound.org/previews/165/165058_947433-hq.mp3", srcSeconds: 300, start: 0 },
  { id: "fire", url: "https://cdn.freesound.org/previews/800/800660_5287430-hq.mp3", srcSeconds: 169, start: 8 },
  { id: "ocean", url: "https://cdn.freesound.org/previews/578/578524_5487341-hq.mp3", srcSeconds: 179, start: 10 },
  { id: "thunder", url: "https://cdn.freesound.org/previews/478/478645_1481531-hq.mp3", srcSeconds: 84, start: 5 },
  { id: "stream", url: "https://cdn.freesound.org/previews/446/446019_7241289-hq.mp3", srcSeconds: 63, start: 2 },
  { id: "wind", url: "https://cdn.freesound.org/previews/773/773670_5287430-hq.mp3", srcSeconds: 840, start: 30 },
  { id: "clock", url: "https://cdn.freesound.org/previews/417/417593_8286949-hq.mp3", srcSeconds: 28, start: 0, loopShort: true },
  { id: "keyboard", url: "https://cdn.freesound.org/previews/502/502653_7729311-hq.mp3", srcSeconds: 36, start: 0, loopShort: true },
  { id: "bunny", url: "https://cdn.freesound.org/previews/442/442656_6940680-hq.mp3", srcSeconds: 17, start: 0.5, loopShort: true },
  // pushkin #215293 "01 room tone low frequency hvac.flac" — CC0 low-frequency
  // HVAC room tone, very quiet, no clicks/interruptions; stereo source converted
  // to mono in pipeline. ~34s source stream-looped to 60s.
  // The source recording itself has a baked fade-in (~0–1s) and fade-out
  // (~33–34s). Stream-looping the raw source therefore leaks those fades into
  // every wrap point and into the start/end of the 60s output, which the user
  // perceived as a residual fade at the loop boundary. We clip to the steady
  // body 1.0s–32.0s via `srcEnd` before stream-looping so every wrap and the
  // file's own boundaries land on full-amplitude steady-state samples.
  // -4 dB perceived attenuation: low-frequency-dominated material reads -23 LUFS
  // on the integrated meter but is perceptually louder than other tracks at the
  // same shared app volume; user reported it as too loud.
  { id: "air-purifier", url: "https://cdn.freesound.org/previews/215/215293_336074-lq.mp3", srcSeconds: 34, start: 1.0, srcEnd: 32.0, loopShort: true, gainDb: -4 },
];

const TARGET_SECONDS = 60;

function log(msg) {
  process.stdout.write(`▸ ${msg}\n`);
}

function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 1024) {
    log(`cached  ${dest}`);
    return;
  }
  log(`fetch   ${url}`);
  // Use curl: handles redirects, sane timeouts. -L follow, --fail on 4xx/5xx.
  const r = spawnSync(
    "curl",
    ["-L", "--fail", "--silent", "--show-error", "-o", dest, "-A",
      "Mozilla/5.0 carrot-carrot-build/8.1", url],
    { stdio: "inherit" }
  );
  if (r.status !== 0) throw new Error(`download failed: ${url}`);
  if (!existsSync(dest) || statSync(dest).size < 1024) {
    throw new Error(`downloaded file too small: ${dest}`);
  }
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

function encode(entry) {
  const src = join(TMP, `${entry.id}.src.mp3`);
  const out = join(OUT, `${entry.id}.mp3`);

  // If `srcEnd` is set, extract a clean inner segment first so stream_loop
  // wraps over an interval that has no baked fades from the source recording.
  // Without this step `-stream_loop -1 -ss start -i src` keeps re-reading the
  // entire source on each wrap, including any fade-in/fade-out the recording
  // shipped with — those leak into the 60s output and produce a perceptible
  // dip at every loop boundary.
  let loopInput = src;
  if (typeof entry.srcEnd === "number" && entry.loopShort) {
    const seg = join(TMP, `${entry.id}.seg.wav`);
    ffmpeg([
      "-ss", String(entry.start),
      "-to", String(entry.srcEnd),
      "-i", src,
      "-vn",
      "-c:a", "pcm_s16le",
      "-ar", "44100",
      seg,
    ]);
    loopInput = seg;
  }

  // Build filter chain:
  //  - resample/mono
  //  - loudnorm to -23 LUFS / -2 dBTP
  //  - optional per-source gain trim (e.g. air-purifier -4 dB)
  //  - atrim to exactly TARGET seconds — NO boundary fades; the file is meant
  //    to native-loop seamlessly (audio.loop=true). Boundary fades caused an
  //    audible ~1s dip at every loop point.
  const filterChain = [
    "aresample=44100",
    "pan=mono|c0=0.5*c0+0.5*c1",
    "loudnorm=I=-23:TP=-2:LRA=7",
  ];
  if (typeof entry.gainDb === "number" && entry.gainDb !== 0) {
    filterChain.push(`volume=${entry.gainDb}dB`);
  }
  filterChain.push(`atrim=0:${TARGET_SECONDS}`);
  filterChain.push("asetpts=N/SR/TB");
  const filter = filterChain.join(",");

  // When we already extracted a clean segment, do not re-apply `-ss start`.
  const seekStart = loopInput === src ? entry.start : 0;
  const inputArgs = entry.loopShort
    ? ["-stream_loop", "-1", "-ss", String(seekStart), "-i", loopInput]
    : ["-ss", String(seekStart), "-i", loopInput];

  ffmpeg([
    ...inputArgs,
    "-t", String(TARGET_SECONDS),
    "-vn",
    "-af", filter,
    "-c:a", "libmp3lame",
    "-b:a", "96k",
    "-ar", "44100",
    "-ac", "1",
    "-map_metadata", "-1",
    out,
  ]);

  const sz = statSync(out).size;
  log(`built   ${entry.id}.mp3  (${(sz / 1024).toFixed(1)}KB)`);
  return { id: entry.id, out, size: sz };
}

function main() {
  // 1) Download
  if (!SKIP_DOWNLOAD) {
    for (const e of MANIFEST) {
      download(e.url, join(TMP, `${e.id}.src.mp3`));
    }
  }

  // 2) Encode
  const results = [];
  for (const e of MANIFEST) {
    results.push(encode(e));
  }

  // 3) Summary
  let total = 0;
  for (const r of results) total += r.size;
  log(`done    ${results.length} files, total ${(total / 1024).toFixed(1)}KB`);

  writeFileSync(
    join(TMP, "manifest.json"),
    JSON.stringify({ generated: new Date().toISOString(), files: results }, null, 2)
  );
}

main();
