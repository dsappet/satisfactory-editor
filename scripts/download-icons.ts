#!/usr/bin/env bun
/**
 * Mirror all icons referenced by src/data/game-data.json into public/icons/.
 *
 * !!! MANUAL-ONLY. DO NOT RUN FROM CI / AUTOMATION. !!!
 *
 * Rationale: this script reaches out to a third-party host
 * (static.satisfactory-calculator.com) and writes the bytes into the repo.
 * If that host were ever compromised the bytes could be poisoned PNGs. The
 * mitigations are (a) a human reviews the resulting `public/icons/` diff in
 * a PR before it lands, and (b) the icons are checked into the repo so the
 * runtime app never depends on this script. Running it from CI would defeat
 * (a) — never wire this into a build/release pipeline.
 *
 * To refresh icons:
 *   1. `bun run build:docs`           (regenerates src/data/game-data.json)
 *   2. `bun run download:icons`       (manual; this script)
 *   3. Review the `public/icons/` diff visually before committing.
 *
 * Idempotent — skips files already present. PNG magic bytes are validated
 * on each downloaded file as a basic sanity check (does not protect against
 * a determined attacker who serves valid-but-malicious PNGs).
 */
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// Refuse to run unattended. CI environments universally set CI=true; the
// other common ones (GitHub Actions, GitLab, CircleCI, etc.) set their own
// flags too. If you're hitting this by mistake locally, unset CI.
const CI_ENV_FLAGS = [
  "CI",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "CIRCLECI",
  "BUILDKITE",
  "JENKINS_URL",
  "TF_BUILD",
];
const ciHit = CI_ENV_FLAGS.find((k) => process.env[k]);
if (ciHit) {
  console.error(
    `Refusing to run: ${ciHit} is set. download-icons is a manual-only ` +
      `script — the committed files under public/icons/ are the runtime ` +
      `source of truth. See the comment at the top of this file.`
  );
  process.exit(1);
}

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

// PNG magic header: 89 50 4E 47 0D 0A 1A 0A. Cheap sanity check that the
// server didn't return an HTML error page or a stub.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (bytes: Uint8Array): boolean => {
  if (bytes.length < PNG_MAGIC.length) return false;
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
};

// Defensive basename guard. Inputs come from our own game-data.json, but
// keep this paranoid — any "/" or ".." would let a poisoned data file write
// outside public/icons/.
const isSafeBasename = (basename: string): boolean =>
  /^[A-Za-z0-9_-]+$/.test(basename);

const downloadOne = async (basename: string): Promise<void> => {
  if (!isSafeBasename(basename)) {
    missing += 1;
    fails.push(`${basename} (rejected: unsafe characters in basename)`);
    return;
  }
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
    if (!isPng(bytes)) {
      missing += 1;
      fails.push(
        `${basename} (not a PNG — first bytes: ${[...bytes.slice(0, 8)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ")})`
      );
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
