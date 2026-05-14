#!/usr/bin/env node
/**
 * `ait build` wrapper — `.env.production` 의 변수를 process.env 에 주입한 뒤
 * `ait build` 를 실행한다.
 *
 * 이유:
 *   granite.config.ts 가 `process.env.APPS_IN_TOSS_BRAND_ICON_URL` 을 읽는데
 *   `ait` CLI 는 .env.production 을 자동 로드하지 않는다. 인라인 환경변수로
 *   넘기지 않으면 콘솔 등록 아이콘과 다른 placeholder 가 ait 에 박혀 심사
 *   거부 사고가 재발한다 — 이 래퍼가 그 사고를 막는다.
 *
 * 인라인으로 이미 값이 들어와 있으면 (process.env 우선) 그대로 사용한다.
 *
 * Windows 호환:
 *   `shell: true` 로 spawn 하면 Node 가 ComSpec(cmd.exe) 을 PATH 와 별개로
 *   resolve 하는데, 일부 Windows 환경에서 ComSpec 이 비어 있거나 경로가
 *   깨져 있어 `spawn C:\Windows\System32\cmd.exe ENOENT` 가 발생한다.
 *   대신 `node_modules/.bin/ait.cmd`(또는 POSIX 의 `ait`) 을 직접 resolve
 *   해 shell 없이 spawn 한다.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, ".env.production");
const IS_WIN = process.platform === "win32";

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

function resolveAitBin() {
  const binDir = resolve(ROOT, "node_modules", ".bin");
  const candidates = IS_WIN
    ? ["ait.cmd", "ait.CMD", "ait.exe", "ait"]
    : ["ait"];
  for (const name of candidates) {
    const p = resolve(binDir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

const fromFile = loadDotEnv(ENV_PATH);
const env = { ...fromFile, ...process.env };

const aitBin = resolveAitBin();

let cmd;
let args;
if (aitBin) {
  cmd = aitBin;
  args = ["build"];
} else {
  // Fallback: use npx so users without a local install still work. On
  // Windows, npm publishes `npx.cmd`; spawning bare `npx` without
  // `shell: true` fails with ENOENT.
  cmd = IS_WIN ? "npx.cmd" : "npx";
  args = ["--no-install", "ait", "build"];
}

const child = spawn(cmd, args, {
  stdio: "inherit",
  env,
  cwd: ROOT,
  // shell:false on every platform — avoids the Windows cmd.exe ENOENT path.
  shell: false,
  windowsHide: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  process.stderr.write(`✗ failed to spawn ait: ${err.message}\n`);
  process.stderr.write(
    `  attempted: ${cmd} ${args.join(" ")}\n` +
      `  cwd: ${ROOT}\n` +
      "  hint: run `npm install` first so node_modules/.bin/ait exists.\n",
  );
  process.exit(1);
});
