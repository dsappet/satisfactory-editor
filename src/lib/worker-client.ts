"use client";

import * as Comlink from "comlink";
import type { SaveWorkerApi } from "@/workers/save-worker";

/**
 * The save worker is bundled by Next.js (Turbopack) from the source file
 * referenced below. The `new Worker(new URL(..., import.meta.url))` pattern
 * is the bundler-portable way to point at a TS module — it's statically
 * analysable so Turbopack/Webpack can emit a chunk for the worker and
 * rewrite the URL. The browser sees an `.js` file with a hashed name.
 *
 * `type: "module"` lets the worker use ES `import` statements (Comlink,
 * the parser, etc.). The bundler converts CommonJS dependencies (pako, …)
 * into a single self-contained chunk.
 */
let cached: { worker: Worker; api: Comlink.Remote<SaveWorkerApi> } | null = null;

export function getSaveWorker(): {
  worker: Worker;
  api: Comlink.Remote<SaveWorkerApi>;
} {
  if (cached) return cached;
  const worker = new Worker(
    new URL("../workers/save-worker.ts", import.meta.url),
    { type: "module", name: "save-worker" }
  );
  const api = Comlink.wrap<SaveWorkerApi>(worker);
  cached = { worker, api };
  return cached;
}

export function disposeSaveWorker(): void {
  if (!cached) return;
  cached.api[Comlink.releaseProxy]();
  cached.worker.terminate();
  cached = null;
}
