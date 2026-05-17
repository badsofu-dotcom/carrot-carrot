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
 *   Node 18.20.2 / 20.12.2 / 21.7.3 부터 CVE-2024-27980 패치로 `.cmd`/`.bat`
 *   파일은 `shell: true` 없이 spawn 하면 EINVAL 로 거부된다 (Node 24 동일).
 *   → Windows 에서 `.cmd` 바이너리 (npm 이 생성한 shim) 를 호출할 때는
 *     `shell: true` 로 spawn 한다. 경로/인자에 공백이 있을 수 있어 명시적
 *     따옴표 처리. POSIX 에서는 직접 spawn (shell 불필요).
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
  // Fallback: use npx so users without a local install still work.
  cmd = IS_WIN ? "npx.cmd" : "npx";
  args = ["--no-install", "ait", "build"];
}

// On Windows, `.cmd` / `.bat` shims must be spawned via the shell — direct
// spawn returns EINVAL since the Node 18.20.2 / 20.12.2 / 21.7.3 CVE patch.
// Quote the binary path and any arg containing whitespace so the shell
// parser doesn't split on spaces in user paths (e.g. C:\Program Files\…).
const isCmdShim = IS_WIN && /\.(cmd|bat)$/i.test(cmd);
const useShell = isCmdShim;
const quote = (s) => (/\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
const spawnCmd = useShell ? quote(cmd) : cmd;
const spawnArgs = useShell ? args.map(quote) : args;

const child = spawn(spawnCmd, spawnArgs, {
  stdio: "inherit",
  env,
  cwd: ROOT,
  shell: useShell,
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
