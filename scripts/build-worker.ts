#!/usr/bin/env bun
/**
 * Pre-bundle src/workers/save-worker.ts into public/save-worker.js as a single
 * ES module that can be loaded by `new Worker(url, { type: 'module' })`.
 *
 * This intentionally bypasses the bundler used by Next.js (Turbopack) for the
 * worker, because Turbopack with `output: 'export'` does not bundle workers
 * created via `new Worker(new URL(..., import.meta.url))` — it copies the raw
 * `.ts` source into `_next/static/media/`, which the browser can't execute.
 */
import { build } from "bun";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outdir = resolve(root, "public");
mkdirSync(outdir, { recursive: true });

const result = await build({
  entrypoints: [resolve(root, "src/workers/save-worker.ts")],
  outdir,
  naming: "save-worker.js",
  target: "browser",
  format: "esm",
  minify: true,
  sourcemap: "linked",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const out = result.outputs.find((o) => o.path.endsWith("save-worker.js"));
if (!out) {
  console.error("save-worker.js was not produced");
  process.exit(1);
}
console.log(
  `worker → ${out.path.replace(root + "/", "")} (${(out.size / 1024).toFixed(
    1
  )} KB)`
);
