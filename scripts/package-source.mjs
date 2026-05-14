#!/usr/bin/env node
/**
 * Package the repo into a portable source ZIP for handoff to other devs.
 *
 * Why a dedicated script:
 *   Earlier handoff ZIPs were missing `granite.config.ts` and other root-level
 *   AIT config files, which made `npx ait build` fail on Windows with
 *   `Cannot find granite config: ...\\granite.config.ts`. This script
 *   guarantees those files are always present and that heavy build artifacts
 *   / local-only files are always excluded.
 *
 * Usage:
 *   node scripts/package-source.mjs [output.zip]
 *
 * Defaults to ../carrot-carrot-source-latest-fixed.zip (next to the repo).
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DEFAULT_OUT = resolve(ROOT, "..", "carrot-carrot-source-latest-fixed.zip");
const OUT = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUT;

// AIT/Apps-in-Toss config files that MUST be in the zip. If any of these is
// missing on disk, packaging aborts — better to fail loudly than ship another
// broken zip.
const REQUIRED_AIT_FILES = ["granite.config.ts", "package.json", "index.html"];

// Things we never ship in the source zip — either huge, regenerable, or
// machine-local state.
const EXCLUDES = [
  "node_modules/*",
  ".git/*",
  ".git",
  "dist/*",
  "dist",
  "dist-submit/*",
  "dist-submit",
  ".wrangler/*",
  ".wrangler",
  "*/.wrangler/*",
  "*/*/.wrangler/*",
  "*/*/*/.wrangler/*",
  "tmp/*",
  "tmp",
  ".granite/*",
  ".granite",
  "qa-phase8/*",
  "qa-phase8",
  "*/node_modules/*",
  // QA screenshots at repo root (qa_*.png) — visible in zip but huge.
  "qa_*.png",
  // build artifacts
  "*.ait",
  "build-report.json",
  "lighthouse-summary.json",
  // local-only env
  ".env",
  ".env.local",
  ".env.production",
  ".env.*.local",
  // npm/OS noise
  ".DS_Store",
  "*.log",
];

for (const f of REQUIRED_AIT_FILES) {
  if (!existsSync(resolve(ROOT, f))) {
    process.stderr.write(
      `✗ required file missing at repo root: ${f}\n` +
        "  refusing to build a broken source zip.\n",
    );
    process.exit(1);
  }
}

if (existsSync(OUT)) rmSync(OUT);
mkdirSync(dirname(OUT), { recursive: true });

const args = ["-r", OUT, ".", "-x", ...EXCLUDES];
process.stdout.write(`packaging source → ${OUT}\n`);
const r = spawnSync("zip", args, { cwd: ROOT, stdio: "inherit" });
if (r.status !== 0) {
  process.stderr.write(`✗ zip failed (exit ${r.status})\n`);
  process.exit(r.status ?? 1);
}

const size = statSync(OUT).size;
process.stdout.write(
  `✓ packaged ${(size / 1024 / 1024).toFixed(2)} MB → ${OUT}\n`,
);
