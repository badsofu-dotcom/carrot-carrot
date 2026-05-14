#!/usr/bin/env node
/**
 * Phase 7.9.2 — 자동 자산 최적화 파이프라인.
 *
 * 의도:
 *   - 미래에 새로 업로드되는 토끼 캐릭터/앱 아이콘 원본을 일관된 규격의
 *     bounded-size WebP 로 변환해 src/assets · public/icons 에 떨어뜨린다.
 *   - 기존 art (이미 commit 된 .webp) 는 절대 덮어쓰지 않는다 — 원본이 따로 제공된
 *     character-source 폴더의 항목만 처리. 원본 파일이 없으면 silent skip.
 *
 * 입력 폴더:
 *   - assets/characters-source/<stem>.{png,jpg,jpeg}     ← 새 토끼 원본 자리
 *   - assets/app-icon-source.jpg                          ← 기존 앱 아이콘 원본
 *
 * 출력:
 *   - src/assets/characters/<stem>.webp        (640px, q78)
 *   - src/assets/characters/<stem>@2x.webp     (1080px, q80)
 *   - public/icons/app-icon-{1024,600,512,...}.png + maskable + favicons
 *   - public/icons/app-icon-splash-{240,480}.webp     (splash/inapp, base-relative)
 *
 * 사용:
 *   npm run assets:optimize
 *   npm run assets:optimize -- --force   # 기존 .webp 있어도 다시 생성
 *
 * 새 라이브러리 추가 없음 — devDependency `sharp` (이미 phase 7.8 부터 보유) 사용.
 */

import { readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join, extname, basename } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const CHAR_SRC_DIR = join(ROOT, "assets/characters-source");
const CHAR_OUT_DIR = join(ROOT, "src/assets/characters");
const APP_ICON_SRC = join(ROOT, "assets/app-icon-source.jpg");

const ARGS = new Set(process.argv.slice(2));
const FORCE = ARGS.has("--force");

const SIZES = [
  { suffix: "", width: 640, quality: 78 },
  { suffix: "@2x", width: 1080, quality: 80 },
];

function log(s) {
  process.stdout.write(`▸ ${s}\n`);
}

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function isSourceImage(name) {
  const ext = extname(name).toLowerCase();
  return ext === ".png" || ext === ".jpg" || ext === ".jpeg";
}

async function optimizeCharacters(sharp) {
  if (!existsSync(CHAR_SRC_DIR)) {
    log(`character source dir 없음 — skip (${CHAR_SRC_DIR})`);
    return;
  }
  if (!existsSync(CHAR_OUT_DIR)) mkdirSync(CHAR_OUT_DIR, { recursive: true });
  const entries = readdirSync(CHAR_SRC_DIR).filter(isSourceImage);
  if (entries.length === 0) {
    log("새 토끼 원본 없음 — skip");
    return;
  }
  log(`character: ${entries.length}개 원본 처리 (force=${FORCE})`);
  for (const name of entries) {
    const inPath = join(CHAR_SRC_DIR, name);
    const stem = basename(name, extname(name));
    for (const s of SIZES) {
      const out = join(CHAR_OUT_DIR, `${stem}${s.suffix}.webp`);
      if (!FORCE && existsSync(out)) {
        log(`  ↷ skip ${basename(out)} (이미 있음 — --force 로 덮어쓰기)`);
        continue;
      }
      try {
        await sharp(inPath)
          .resize({ width: s.width, withoutEnlargement: true })
          .webp({ quality: s.quality, effort: 6 })
          .toFile(out);
        const size = statSync(out).size;
        log(`  ✓ ${basename(out)} (${(size / 1024).toFixed(1)} KB)`);
      } catch (err) {
        log(`  ✗ ${basename(out)}: ${err.message}`);
      }
    }
  }
}

function optimizeAppIcon() {
  // 의도적으로 silent skip 하지 않는다 — 원본이 사라진 채로 splash WebP 가
  // 부정확하게 남는 회귀가 있어, 부재 시 빌드를 멈춘다.
  if (!existsSync(APP_ICON_SRC)) {
    console.error(
      `✗ app icon source 누락: ${APP_ICON_SRC}\n` +
        `  splash 아이콘 (public/icons/app-icon-splash-{240,480}.webp) 은 이 원본에서만 만든다.\n` +
        `  파일을 복원하거나 export-icons.mjs 의 SRC 를 명시적으로 갱신해줘.`,
    );
    process.exit(1);
  }
  // export-icons.mjs 가 이미 PNG + WebP variants 를 모두 만든다.
  log("app icon: scripts/export-icons.mjs 위임");
  execSync("node scripts/export-icons.mjs", { stdio: "inherit", cwd: ROOT });
}

(async () => {
  const sharp = await loadSharp();
  if (!sharp) {
    log("sharp 가 설치되어 있지 않음 — npm install --save-dev sharp 먼저 실행");
    process.exit(0); // 빌드를 막지 않음
  }
  await optimizeCharacters(sharp);
  optimizeAppIcon();
  log("완료");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
