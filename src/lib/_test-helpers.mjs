/**
 * Test harness — load a `.ts` source file as an ES module via esbuild's
 * synchronous transform. Lets pure-helper tests run under `node --test`
 * without adding a JS test framework as a dependency.
 *
 * Usage:
 *     import { loadTs } from "./_test-helpers.mjs";
 *     const mod = await loadTs("./seasonalBunny.ts");
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

export async function loadTs(relPath, importMetaUrl) {
  const callerDir = dirname(fileURLToPath(importMetaUrl));
  const tsPath = resolve(callerDir, relPath);
  const src = readFileSync(tsPath, "utf8");
  const { code } = transformSync(src, {
    loader: "ts",
    format: "esm",
    target: "es2020",
  });
  const dir = mkdtempSync(join(tmpdir(), "tsload-"));
  const out = join(dir, "module.mjs");
  writeFileSync(out, code);
  return await import(pathToFileURL(out).href);
}
