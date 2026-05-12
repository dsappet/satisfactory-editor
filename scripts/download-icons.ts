#!/usr/bin/env bun
/**
 * Mirror all icons referenced by src/data/game-data.json into public/icons/.
 *
 * Why: SCIM's CDN blocks browser hotlinking via CORS. Serving the same files
 * from /public/icons sidesteps that and removes the runtime dependency on a
 * third-party host.
 *
 * Idempotent — skips files already present. Re-run after `bun run build:docs`
 * if a new patch introduced new items.
 *
 *   bun run download:icons
 */
import { mkdirSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

const gameData = (await import(
  resolve(root, "src/data/game-data.json"),
  { with: { type: "json" } } as { with: { type: string } }
)).default as {
  items: Record<string, { icon: string }>;
  schematics: Record<string, { icon: string }>;
};

// SCIM only hosts the _256 variant; normalize the size suffix.
const normalize = (basename: string): string =>
  basename.replace(/_(?:32|64|128|512)$/, "_256");

const collect = (): string[] => {
  const set = new Set<string>();
  for (const v of Object.values(gameData.items)) {
    if (v.icon) set.add(normalize(v.icon));
  }
  for (const v of Object.values(gameData.schematics)) {
    if (v.icon) set.add(normalize(v.icon));
  }
  return [...set].sort();
};

const targets = collect();
const SCIM_BASE = "https://static.satisfactory-calculator.com/img/gameStable1.0";
const CONCURRENCY = 8;

const existing = new Set(readdirSync(outDir));
const todo = targets.filter((basename) => !existing.has(`${basename}.png`));

console.log(
  `${targets.length} icons referenced, ${existing.size} already on disk, ${todo.length} to download.`
);

if (todo.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

let ok = 0;
let missing = 0;
const fails: string[] = [];

const downloadOne = async (basename: string): Promise<void> => {
  const url = `${SCIM_BASE}/${basename}.png`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "satisfactory-editor-build/1.0" },
    });
    if (!res.ok) {
      missing += 1;
      fails.push(`${basename} (HTTP ${res.status})`);
      return;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 32) {
      missing += 1;
      fails.push(`${basename} (empty body, ${bytes.length} bytes)`);
      return;
    }
    writeFileSync(resolve(outDir, `${basename}.png`), bytes);
    ok += 1;
  } catch (err) {
    missing += 1;
    fails.push(
      `${basename} (${err instanceof Error ? err.message : "unknown error"})`
    );
  }
};

// Simple bounded-concurrency loop. Pulls from the queue until empty.
const queue = todo.slice();
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length > 0) {
    const basename = queue.shift();
    if (!basename) break;
    await downloadOne(basename);
    if ((ok + missing) % 25 === 0) {
      console.log(`  …${ok + missing}/${todo.length}`);
    }
  }
});

await Promise.all(workers);

console.log(`\ndownloaded: ${ok}`);
console.log(`missing/errors: ${missing}`);
if (fails.length > 0) {
  console.log("\nFailed:");
  for (const f of fails.slice(0, 20)) console.log(`  ${f}`);
  if (fails.length > 20) console.log(`  …and ${fails.length - 20} more`);
}
