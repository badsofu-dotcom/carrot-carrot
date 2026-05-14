#!/usr/bin/env node
/**
 * Phase 7.7 — PNG/JPG → WebP 변환 스크립트.
 *
 * 의도:
 *   - src/assets/characters/*.{png,jpg,jpeg} 원본을 1x + 2x WebP 로 동시 제공.
 *   - sharp 가 설치돼 있을 때만 동작. 없으면 graceful 안내 후 종료.
 *   - 새 UI 라이브러리 추가 금지 정책에 따라 sharp 는 optional devDependency.
 *
 * 사용:
 *   node scripts/convert-webp.mjs
 *
 * 결과:
 *   foo.png → foo.webp (640px), foo@2x.webp (1080px)
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join, extname, basename } from "node:path";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const SRC_DIR = join(ROOT, "src/assets/characters");

const SIZES = [
  { suffix: "", width: 640, quality: 78 }, // 1x
  { suffix: "@2x", width: 1080, quality: 80 }, // 2x
];

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default ?? mod;
  } catch (e) {
    return null;
  }
}

function isSourceImage(name) {
  const ext = extname(name).toLowerCase();
  return ext === ".png" || ext === ".jpg" || ext === ".jpeg";
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`[convert-webp] no asset dir: ${SRC_DIR}`);
    process.exit(0);
  }
  const sharp = await loadSharp();
  if (!sharp) {
    console.warn(
      "[convert-webp] sharp 가 설치돼 있지 않아 — 변환 생략.\n" +
        "  설치: npm install --save-dev sharp\n" +
        "  현재 commit 된 .webp 자산은 그대로 사용 가능.",
    );
    process.exit(0);
  }
  const entries = readdirSync(SRC_DIR).filter(isSourceImage);
  if (entries.length === 0) {
    console.log("[convert-webp] 원본 PNG/JPG 없음 — skip.");
    return;
  }
  console.log(`[convert-webp] ${entries.length}개 원본 이미지 변환 시작`);
  for (const name of entries) {
    const inPath = join(SRC_DIR, name);
    const stem = basename(name, extname(name));
    for (const s of SIZES) {
      const out = join(SRC_DIR, `${stem}${s.suffix}.webp`);
      try {
        await sharp(inPath)
          .resize({ width: s.width, withoutEnlargement: true })
          .webp({ quality: s.quality, effort: 6 })
          .toFile(out);
        const size = statSync(out).size;
        console.log(`  ✓ ${basename(out)} (${(size / 1024).toFixed(1)} KB)`);
      } catch (err) {
        console.error(`  ✗ ${basename(out)}: ${err.message}`);
      }
    }
  }
  console.log("[convert-webp] 완료");
}

main().catch((e) => {
  console.error("[convert-webp] 실패:", e);
  process.exit(1);
});
