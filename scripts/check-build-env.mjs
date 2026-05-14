#!/usr/bin/env node
/**
 * Production build 환경변수 게이트.
 *
 * `npm run build:submit` / `npm run build:ait` 실행 전, Vite 가 클라이언트 번들에
 * 박을 VITE_* 변수가 실제로 채워졌는지 검사한다. 비어 있으면 빌드를 중단한다.
 *
 * 과거에 .env.production 없이 build:ait 가 통과되어 콘솔 업로드 후 런타임에서
 * `SERVER_ENV_MISSING: VITE_APPS_IN_TOSS_PROXY_URL 미설정` 으로 로그인이 깨진
 * 사고가 있었다. 이 가드로 같은 사고를 막는다.
 *
 * 필요하면 인라인으로 넘길 수 있다:
 *   VITE_APPS_IN_TOSS_PROXY_URL=https://carrot-carrot-api.<acct>.workers.dev \
 *     npm run build:ait
 *
 * 또는 .env.production 에 채운다 (gitignore 됨).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// granite.config.ts 가 콘솔 등록 CDN URL 을 기본값으로 박아두므로 더 이상
// APPS_IN_TOSS_BRAND_ICON_URL 환경변수를 강제하지 않는다. 단, 누군가가
// override 로 값을 넘겼다면 그 값이 placeholder/비-https 가 아닌지만 검증한다.
const REQUIRED = ["VITE_APPS_IN_TOSS_PROXY_URL"];
const BRAND_ICON_PLACEHOLDER = "REPLACE_WITH_CONSOLE_ICON_URL";
const isAitBuild =
  process.argv.includes("--ait") ||
  /\bait\b/.test(process.env.npm_lifecycle_event ?? "");

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const fromFile = loadDotEnv(resolve(ROOT, ".env.production"));
const merged = { ...fromFile, ...process.env };

const missing = REQUIRED.filter((k) => !merged[k] || merged[k].trim() === "");

// brand icon 은 granite.config.ts 의 default 가 있으므로 비어 있는 건 OK.
// override 가 들어왔다면 그 값이 잘못되지 않았는지만 검증한다 (AIT 빌드만).
const brandIconOverride = (merged.APPS_IN_TOSS_BRAND_ICON_URL ?? "").trim();
const brandIconBad =
  isAitBuild &&
  brandIconOverride !== "" &&
  (brandIconOverride === BRAND_ICON_PLACEHOLDER ||
    !/^https:\/\//.test(brandIconOverride));

if (missing.length || brandIconBad) {
  process.stderr.write(
    [
      "✗ production build 환경변수 누락 / 잘못됨:",
      ...missing.map((k) => `  - ${k} (비어있음)`),
      ...(brandIconBad
        ? [
            `  - APPS_IN_TOSS_BRAND_ICON_URL override 값이 placeholder/비-https — 비워두면 granite.config.ts 의 콘솔 등록 기본값을 사용합니다.`,
          ]
        : []),
      "",
      "해결:",
      "  1) .env.production 파일에 채우거나 (.env.production.example 참고)",
      "  2) 인라인으로 빌드:",
      "     VITE_APPS_IN_TOSS_PROXY_URL=https://carrot-carrot-api.<acct>.workers.dev \\",
      "       npm run build:ait",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const reportedKeys = [...REQUIRED];
if (isAitBuild && brandIconOverride) {
  reportedKeys.push("APPS_IN_TOSS_BRAND_ICON_URL");
}
process.stdout.write(
  `▸ build env ok: ${reportedKeys.map((k) => `${k}=${merged[k]}`).join(", ")}${
    isAitBuild && !brandIconOverride
      ? " (brand icon: granite.config.ts default)"
      : ""
  }\n`,
);
