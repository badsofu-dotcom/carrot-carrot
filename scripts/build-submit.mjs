#!/usr/bin/env node
/**
 * Phase 7 — 앱인토스 제출용 zip 번들러.
 *
 * 단계:
 *   1) typecheck (tsc -b --noEmit)
 *   2) production build (tsc -b && vite build → dist/)
 *   3) bundle metrics 계산: gzip(main.js), gzip(vendor*.js), images total
 *   4) zip 생성: dist/, DEPLOY.md, cloudflare/workers/carrot-carrot-api/(src,migrations,wrangler.toml,package.json,tsconfig.json),
 *               public/icons/*, submission/screenshots/*
 *   5) lighthouse-summary.json 또는 build-report.json 생성/갱신
 *
 * 의도적으로 zip util 은 Node 의 `zlib` 만 쓰기보단 외부 의존 없는
 * minimal `store + deflate` ZIP writer 를 직접 구현했다 (devDependency 없음).
 */

import { execSync } from "node:child_process";
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  createWriteStream,
} from "node:fs";
import { gzipSync, deflateRawSync } from "node:zlib";
import { resolve, join, relative, basename } from "node:path";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const DIST = join(ROOT, "dist");
const SUBMIT_DIR = join(ROOT, "dist-submit");
const ZIP_PATH = join(SUBMIT_DIR, "carrot-carrot-submit.zip");
const REPORT_PATH = join(ROOT, "build-report.json");

function log(s) {
  process.stdout.write(`▸ ${s}\n`);
}

function run(cmd) {
  log(cmd);
  execSync(cmd, { stdio: "inherit", cwd: ROOT });
}

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function bytesFmt(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/* -------------------- ZIP writer (no deps) -------------------- */

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function dosTime(d) {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((d.getSeconds() / 2) & 0x1f);
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0xf) << 5) |
    (d.getDate() & 0x1f);
  return { time, date };
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function makeZip(entries, outPath) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const { time, date } = dosTime(now);

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const compressed = data.length === 0 ? data : deflateRawSync(data);
    const useDeflate = compressed.length < data.length;
    const finalData = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0;

    // Local file header
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800), // utf8 flag
      u16(method),
      u16(time),
      u16(date),
      u32(crc),
      u32(finalData.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      finalData,
    ]);
    chunks.push(local);

    // Central directory entry
    central.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(method),
        u16(time),
        u16(date),
        u32(crc),
        u32(finalData.length),
        u32(data.length),
        u16(nameBuf.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBuf,
      ]),
    );
    offset += local.length;
  }
  const cdStart = offset;
  const cdBuf = Buffer.concat(central);
  const cdSize = cdBuf.length;
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(cdSize),
    u32(cdStart),
    u16(0),
  ]);
  const final = Buffer.concat([...chunks, cdBuf, eocd]);
  writeFileSync(outPath, final);
  return final.length;
}

/* -------------------- main -------------------- */

(async () => {
  // 0) icons — Phase 7.8 부터 항상 최신 PNG 가 dist 에 포함되도록 강제.
  run("npm run icons");

  // 1) typecheck (별도 스텝—build 가 어차피 같은 일을 하지만 명시).
  run("npm run typecheck");

  // 2) build
  run("npm run build");

  // 3) metrics
  const distFiles = walk(DIST);
  const metrics = {
    gzipMainKb: 0,
    gzipVendorKb: 0,
    imageTotalKb: 0,
    totalKb: 0,
    files: [],
  };
  for (const f of distFiles) {
    const rel = relative(DIST, f);
    const data = readFileSync(f);
    const gz = gzipSync(data);
    metrics.totalKb += data.length / 1024;
    const lower = rel.toLowerCase();
    if (lower.endsWith(".js")) {
      const isVendor = /vendor|chunk|node_modules/i.test(rel) || /[\w-]+-\w{8,}\.js$/.test(rel);
      if (rel.includes("index-") || rel === "assets/index.js") {
        metrics.gzipMainKb += gz.length / 1024;
      } else if (isVendor) {
        metrics.gzipVendorKb += gz.length / 1024;
      } else {
        metrics.gzipMainKb += gz.length / 1024;
      }
    }
    if (/\.(png|jpe?g|webp|svg|avif)$/i.test(lower)) {
      metrics.imageTotalKb += data.length / 1024;
    }
    metrics.files.push({
      path: rel,
      bytes: data.length,
      gzip: gz.length,
    });
  }

  metrics.gzipMainKb = +metrics.gzipMainKb.toFixed(1);
  metrics.gzipVendorKb = +metrics.gzipVendorKb.toFixed(1);
  metrics.imageTotalKb = +metrics.imageTotalKb.toFixed(1);
  metrics.totalKb = +metrics.totalKb.toFixed(1);

  log(
    `bundle: main ${metrics.gzipMainKb} KB gz · vendor ${metrics.gzipVendorKb} KB gz · images ${metrics.imageTotalKb} KB`,
  );

  // 4) zip
  if (!existsSync(SUBMIT_DIR)) mkdirSync(SUBMIT_DIR, { recursive: true });

  const entries = [];
  function pushFile(absPath, archiveName) {
    if (!existsSync(absPath)) return;
    const st = statSync(absPath);
    if (!st.isFile()) return;
    entries.push({
      name: archiveName,
      data: readFileSync(absPath),
    });
  }
  function pushDir(absDir, archivePrefix) {
    if (!existsSync(absDir)) return;
    for (const f of walk(absDir)) {
      const rel = relative(absDir, f).replace(/\\/g, "/");
      pushFile(f, `${archivePrefix}/${rel}`);
    }
  }

  pushDir(DIST, "dist");
  pushFile(join(ROOT, "DEPLOY.md"), "DEPLOY.md");
  pushFile(join(ROOT, "README.md"), "README.md");
  pushFile(join(ROOT, "package.json"), "package.json");
  // Cloudflare Worker (carrot-carrot-api) 소스 + D1 마이그레이션 + wrangler.toml
  pushDir(
    join(ROOT, "cloudflare/workers/carrot-carrot-api/src"),
    "cloudflare/workers/carrot-carrot-api/src",
  );
  pushDir(
    join(ROOT, "cloudflare/workers/carrot-carrot-api/migrations"),
    "cloudflare/workers/carrot-carrot-api/migrations",
  );
  pushFile(
    join(ROOT, "cloudflare/workers/carrot-carrot-api/wrangler.toml"),
    "cloudflare/workers/carrot-carrot-api/wrangler.toml",
  );
  pushFile(
    join(ROOT, "cloudflare/workers/carrot-carrot-api/package.json"),
    "cloudflare/workers/carrot-carrot-api/package.json",
  );
  pushFile(
    join(ROOT, "cloudflare/workers/carrot-carrot-api/tsconfig.json"),
    "cloudflare/workers/carrot-carrot-api/tsconfig.json",
  );
  pushDir(join(ROOT, "public/icons"), "icons");
  // Phase 7.8 — 최종 아이콘 1종 (앱인토스 콘솔 업로드용 1024 + 600).
  pushFile(
    join(ROOT, "public/icons/app-icon-1024.png"),
    "submission/icons/app-icon-1024.png",
  );
  pushFile(
    join(ROOT, "public/icons/app-icon-600.png"),
    "submission/icons/app-icon-600.png",
  );
  // 콘솔 아이콘 슬롯 업로드용 원본 (granite.config.ts brand.icon 과 같은 파일).
  pushFile(
    join(ROOT, "assets/app-icon-console-600.jpg"),
    "submission/icons/app-icon-console-600.jpg",
  );
  pushDir(join(ROOT, "submission/screenshots"), "screenshots");

  const zipSize = makeZip(entries, ZIP_PATH);
  log(`zip → ${relative(ROOT, ZIP_PATH)} (${bytesFmt(zipSize)}, ${entries.length} files)`);

  // 5) report
  const report = {
    ranAt: new Date().toISOString(),
    bundle: {
      gzipMainKb: metrics.gzipMainKb,
      gzipVendorKb: metrics.gzipVendorKb,
      imageTotalKb: metrics.imageTotalKb,
      totalKb: metrics.totalKb,
    },
    zip: {
      path: relative(ROOT, ZIP_PATH),
      bytes: zipSize,
      entries: entries.length,
    },
    note:
      "Lighthouse 는 sandbox 환경에서 chrome headless 가 제한적이라 정확한 점수 측정 불가. " +
      "대체로 vite build size + manual mobile QA + dist 정적 분석을 사용.",
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  log(`report → ${relative(ROOT, REPORT_PATH)}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
