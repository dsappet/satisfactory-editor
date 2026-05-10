"use client";

import * as Comlink from "comlink";
import type { SaveWorkerApi } from "@/workers/save-worker";

/**
 * The save worker is pre-bundled at build time (see `scripts/build-worker.ts`)
 * to `public/save-worker.js`. We deliberately avoid the
 * `new Worker(new URL(..., import.meta.url))` pattern because Turbopack with
 * static export emits the raw `.ts` file as a static asset rather than
 * bundling it for the browser. Pre-bundling sidesteps that entirely and gives
 * us a portable worker that works under any host/reverse-proxy.
 *
 * The worker is loaded as `type: 'module'` so it can use ES module imports.
 * The bundler converts CommonJS dependencies (pako, etc.) into a single
 * self-contained module.
 */
let cached: { worker: Worker; api: Comlink.Remote<SaveWorkerApi> } | null = null;

export function getSaveWorker(): {
  worker: Worker;
  api: Comlink.Remote<SaveWorkerApi>;
} {
  if (cached) return cached;
  // Resolve relative to the served base path so it works behind a reverse proxy.
  const base =
    typeof document !== "undefined"
      ? new URL(document.baseURI).pathname
      : "/";
  const url = `${base.replace(/\/$/, "")}/save-worker.js`;
  const worker = new Worker(url, { type: "module", name: "save-worker" });
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
