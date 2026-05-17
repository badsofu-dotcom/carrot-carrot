/**
 * One-off — bg_farmhub_{0,3,8}.png → .jpg (quality 88, mozjpeg).
 *
 * Round 25 PHASE 0.C — 큰 PNG 3장 (950KB / 2.3MB / 2.4MB) 합 5.7MB
 * 가 .ait 크게 부풀림. JPEG q88 mozjpeg 으로 합 ~600KB 이내 예상.
 * 시각 차이 거의 없음 (탑다운 인테리어 배경, 알파 미사용).
 *
 * 실행: node scripts/convert-farmhub-bgs.mjs
 * 성공 시 원본 PNG 삭제.
 */
import sharp from "sharp";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync, unlinkSync } from "node:fs";

const ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const BG_DIR = resolve(ROOT, "public/assets/decor/farmhub/bg");

const TARGETS = ["bg_farmhub_0", "bg_farmhub_3", "bg_farmhub_8"];

for (const name of TARGETS) {
  const inp = resolve(BG_DIR, `${name}.png`);
  const out = resolve(BG_DIR, `${name}.jpg`);
  const before = statSync(inp).size;

  await sharp(inp)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(out);

  const after = statSync(out).size;
  console.log(
    `${name}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`,
  );
  unlinkSync(inp);
}

console.log("✓ 3 PNG → JPEG converted, originals removed");
