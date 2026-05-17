/**
 * One-off — convert 35 transparent-bg bunny PNGs from
 * /mnt/c/dev/bunny_characters/ to webp @1x (256×256) + @2x (512×512)
 * at quality 80 / alphaQuality 90. Outputs into
 * src/assets/characters/transparent/.
 *
 * Run once from the project root:
 *   node scripts/convert-transparent-bunnies.mjs
 *
 * Re-runnable — overwrites existing output. Logs per-file sizes + total.
 */
import sharp from "sharp";
import { readdirSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";

const SRC = "/mnt/c/dev/bunny_characters";
const OUT = resolve(
  new URL("..", import.meta.url).pathname,
  "src/assets/characters/transparent",
);
const Q = 80;
const ALPHA_Q = 90;

mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC)
  .filter((f) => f.endsWith(".png"))
  .sort();

console.log(`Converting ${files.length} PNGs → webp (q${Q}/aq${ALPHA_Q})...`);
console.log("");

let totalBytes = 0;
const results = [];

for (const f of files) {
  const name = basename(f, ".png"); // bunny_<name>
  const inPath = resolve(SRC, f);
  const out1x = resolve(OUT, `${name}.webp`);
  const out2x = resolve(OUT, `${name}@2x.webp`);

  const transparentBg = { r: 0, g: 0, b: 0, alpha: 0 };

  await sharp(inPath)
    .resize(256, 256, { fit: "contain", background: transparentBg })
    .webp({ quality: Q, alphaQuality: ALPHA_Q })
    .toFile(out1x);

  await sharp(inPath)
    .resize(512, 512, { fit: "contain", background: transparentBg })
    .webp({ quality: Q, alphaQuality: ALPHA_Q })
    .toFile(out2x);

  const { size: s1 } = await sharp(out1x).metadata().then(() => import("node:fs").then((m) => m.statSync(out1x)));
  const { size: s2 } = await sharp(out2x).metadata().then(() => import("node:fs").then((m) => m.statSync(out2x)));

  totalBytes += s1 + s2;
  results.push({ name, s1, s2 });
}

console.log("file                            @1x       @2x");
console.log("-".repeat(56));
for (const r of results) {
  console.log(
    `${r.name.padEnd(32)} ${String(r.s1).padStart(7)}  ${String(r.s2).padStart(7)}`,
  );
}
console.log("-".repeat(56));
console.log(
  `TOTAL: ${(totalBytes / 1024 / 1024).toFixed(2)} MB across ${results.length * 2} files`,
);
