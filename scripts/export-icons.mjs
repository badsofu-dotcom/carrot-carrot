#!/usr/bin/env node
/**
 * Phase 7.8 — 최종 앱 아이콘 export.
 *
 * 입력: assets/app-icon-source.jpg (1080x1080 — 최종 원본)
 * 출력:
 *   public/icons/app-icon-1024.png        (전체 콘솔 / 제출용)
 *   public/icons/app-icon-600.png         (앱인토스 콘솔 600x600 슬롯)
 *   public/icons/app-icon-512.png         (manifest "any")
 *   public/icons/app-icon-192.png         (manifest)
 *   public/icons/app-icon-180.png         (apple-touch-icon)
 *   public/icons/app-icon-152.png         (older iOS)
 *   public/icons/app-icon-120.png         (older iOS)
 *   public/icons/app-icon-maskable-512.png (manifest "maskable" — 80% safe zone, carrot bg)
 *   public/icons/app-icon-splash-{240,480}.webp (splash/in-app, base-relative)
 *   public/icons/favicon-32.png
 *   public/icons/favicon-16.png
 *   public/icons/favicon.ico              (32+16 multi-resolution)
 *
 * 모든 raster 이미지는 square full-bleed 으로, 둥근 모서리/투명 배경 없이 export.
 * maskable 은 외곽 패딩 (carrot orange #FF9940) 추가해 80% safe-zone 확보.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const SRC = join(ROOT, "assets/app-icon-source.jpg");
const OUT_DIR = join(ROOT, "public/icons");
const CARROT_BG = { r: 0xff, g: 0x99, b: 0x40, alpha: 1 };

if (!existsSync(SRC)) {
  console.error(`✗ source not found: ${SRC}`);
  process.exit(1);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function log(s) {
  process.stdout.write(`▸ ${s}\n`);
}

// 가드 — splash WebP 가 잘못된 원본 (예: 텍스트만 든 임시 파일) 으로 다시
// 생성되어 토끼가 사라지는 회귀를 막는다. JPEG, square, ≥512px 만 통과.
async function validateSource() {
  const meta = await sharp(SRC).metadata();
  const { width, height, format } = meta;
  if (format !== "jpeg" && format !== "jpg") {
    console.error(`✗ source must be JPEG (got ${format}): ${SRC}`);
    process.exit(1);
  }
  if (!width || !height || width !== height) {
    console.error(`✗ source must be square (got ${width}×${height}): ${SRC}`);
    process.exit(1);
  }
  if (width < 512) {
    console.error(`✗ source must be ≥512px (got ${width}): ${SRC}`);
    process.exit(1);
  }
  log(`source ok: ${width}×${height} ${format}`);
}

const FULL_BLEED_SIZES = [
  { name: "app-icon-1024.png", size: 1024 },
  { name: "app-icon-600.png", size: 600 },
  { name: "app-icon-512.png", size: 512 },
  { name: "app-icon-192.png", size: 192 },
  { name: "app-icon-180.png", size: 180 },
  { name: "app-icon-152.png", size: 152 },
  { name: "app-icon-120.png", size: 120 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-16.png", size: 16 },
];

// Phase 7.9.3 — splash 등 in-app 노출용 WebP. PNG 보다 ~80% 가벼워
// LCP / 첫 paint 가 또렷해진다.
// 파일명에 `-splash-` 접두를 둬, 토스 미니앱 deploy 환경에 남아 있는
// 기존 `app-icon-{240,480}.webp` 캐시 (잘못된 절대경로로 받았던 항목) 를 무효화한다.
const WEBP_SIZES = [
  { name: "app-icon-splash-480.webp", size: 480, quality: 82 },
  { name: "app-icon-splash-240.webp", size: 240, quality: 82 },
];

const srcBuffer = readFileSync(SRC);

(async () => {
  await validateSource();
  // 1) Full-bleed PNGs — 정사각, 모서리/투명 없음, JPEG → PNG 단순 리사이즈.
  for (const { name, size } of FULL_BLEED_SIZES) {
    const out = join(OUT_DIR, name);
    await sharp(srcBuffer)
      .resize(size, size, { fit: "cover" })
      .png({ compressionLevel: 9 })
      .toFile(out);
    log(`${name} (${size}×${size})`);
  }

  // 1.5) WebP variants — splash / 인앱 노출용. PNG fallback 은 위에서 이미 생성.
  for (const { name, size, quality } of WEBP_SIZES) {
    const out = join(OUT_DIR, name);
    await sharp(srcBuffer)
      .resize(size, size, { fit: "cover" })
      .webp({ quality, effort: 6 })
      .toFile(out);
    log(`${name} (${size}×${size} webp q${quality})`);
  }

  // 2) Maskable 512 — 중앙 80% 영역에 source 를 그리고, 외곽 10% 는 carrot orange 로 패딩.
  //    Android adaptive icon 규격 (safe zone = inner 80%).
  const inner = Math.round(512 * 0.8); // 410
  const innerBuf = await sharp(srcBuffer)
    .resize(inner, inner, { fit: "cover" })
    .png()
    .toBuffer();
  const maskable = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: CARROT_BG,
    },
  })
    .composite([{ input: innerBuf, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(OUT_DIR, "app-icon-maskable-512.png"), maskable);
  log(`app-icon-maskable-512.png (512×512, 80% safe zone, carrot bg)`);

  // 3) favicon.ico — 32+16 multi-resolution.
  const ico = await pngToIco([
    join(OUT_DIR, "favicon-32.png"),
    join(OUT_DIR, "favicon-16.png"),
  ]);
  writeFileSync(join(OUT_DIR, "favicon.ico"), ico);
  log(`favicon.ico (32+16 multi-res, ${ico.length} B)`);

  log("done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
