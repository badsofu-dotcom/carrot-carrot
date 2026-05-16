/**
 * Test harness — load a `.ts` source file as an ES module via esbuild's
 * synchronous bundle. Lets pure-helper tests run under `node --test`
 * without adding a JS test framework as a dependency.
 *
 * Why `buildSync` (not `transformSync`): some lib/* modules now import
 * sibling files (e.g. `soundFx.ts` → `./procSfx`). transformSync only
 * rewrites a single file; node ESM then chokes on the resolved import
 * because the sibling never landed in the tmpdir. `buildSync` with
 * `bundle: true` inlines the whole reachable graph into one file.
 *
 * Usage:
 *     import { loadTs } from "./_test-helpers.mjs";
 *     const mod = await loadTs("./seasonalBunny.ts", import.meta.url);
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

export async function loadTs(relPath, importMetaUrl) {
  const callerDir = dirname(fileURLToPath(importMetaUrl));
  const tsPath = resolve(callerDir, relPath);
  const dir = mkdtempSync(join(tmpdir(), "tsload-"));
  const out = join(dir, "module.mjs");
  buildSync({
    entryPoints: [tsPath],
    outfile: out,
    bundle: true,
    format: "esm",
    target: "es2020",
    platform: "neutral",
    // Avoid pulling Vite ambient types / `import.meta.env` at compile
    // time — esbuild leaves it as a runtime property access and the
    // module guards `?.env?.BASE_URL` already.
    logLevel: "silent",
  });
  return await import(pathToFileURL(out).href);
}
