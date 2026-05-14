<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# About this project

A fully client-side editor for **Satisfactory 1.2** save files, hosted at
[satisfactory-editor.com](https://satisfactory-editor.com). Users drop in a
`.sav`, the app parses it in a Web Worker, surfaces a few targeted edit
tabs, and serializes a new `.sav` they can download. **No backend.** The
save bytes never leave the browser.

For the user-facing pitch see [README.md](./README.md). For local-dev
setup, data pipeline, scripts, and deploy notes see
[DEVELOPMENT.md](./DEVELOPMENT.md). This file is for AI agents working in
the repo.

## What is Satisfactory?

Satisfactory is a first-person factory-builder by **Coffee Stain Studios**
(Stockholm). You play a FICSIT pioneer dropped on an alien planet to
strip-mine its resources and ship them off to a megacorp. The fun is
building escalating tiers of automated factories — miners → smelters →
constructors → assemblers → manufacturers → quantum-tier weirdness — wired
up with belts, pipes, trains, drones, and far too many splitters.

**Version 1.2** is the current stable release line (post-1.0 launch in
September 2024). Save format is stable across 1.x patches but **not**
compatible with pre-1.0 saves (the old `Docs.json` → `en-US.json` rename
was the headline change). This editor targets 1.2 saves specifically.

### Vocabulary cheat-sheet

When you see these in code or save data, this is what they mean in-game:

| Term | What it is |
|---|---|
| **MAM** | Molecular Analysis Machine. Where you research alien/exotic materials by feeding it samples. Each research is an `EST_MAM` schematic. |
| **Hard Drive** | Drops from crashed pods. Researched at the **MAM** (despite the name) to unlock **alternate recipes** — `EST_Alternate` schematics. |
| **Schematic** | Anything you can "research" or "unlock." Milestones, MAM research, alternates, awesome-shop purchases — they're all schematics. |
| **Tier / Phase** | Tier = milestone group (HUB upgrade). Phase = the Space Elevator project tier (Phase 1 → Phase 5). Different fields in the save. |
| **Node** | A resource deposit (iron, copper, oil, …) with one of three **purities**: Impure / Normal / Pure. |
| **AWESOME Sink / Shop** | Sink consumes items for coupons; shop spends coupons. Out of scope today but lives near the unlock subsystem. |

### Reference info

External resources worth consulting when adding new edits:

- **Official wiki:** [satisfactory.wiki.gg](https://satisfactory.wiki.gg/) —
  best for in-game terminology, schematic names, and tier/phase structure.
- **SCIM** (satisfactory-calculator.com) — community calculator, map, and
  save viewer. **Their save tool is the de-facto reference** for what each
  property in a save actually does, and we mirror their icon basenames into
  `public/icons/`. If you're unsure what a field controls, opening the same
  save in SCIM and toggling things is often the fastest way to find out.
- **[`@etothepii/satisfactory-file-parser`](https://github.com/etothepii42/satisfactory-file-parser)** —
  the parser/serializer we use. Source is your authoritative reference for
  property types (`StructProperty`, `ArrayProperty<...>`, `ObjectProperty`,
  `SoftObjectProperty`, …) and how the chunked save format is framed.
- **[GreyHak/sat_sav_parse](https://github.com/GreyHak/sat_sav_parse)** —
  Python reference parser. Useful as a cross-check when the JS parser
  surfaces something ambiguous: GreyHak's code tends to spell out the
  meaning of obscure fields with comments and named structs, even where the
  binary format is the same.
- **Coffee Stain's `en-US.json`** — ships in every install at
  `CommunityResources/Docs/en-US.json`. This is the source of truth for
  item / schematic / recipe class names. We parse it into
  `src/data/game-data.json` via `bun run build:docs`.

## Tech stack

- **Next.js 16.2** (App Router) + React 19. Turbopack for dev and build.
  Re-read the warning at the top of this file — this Next is not the one
  you were trained on. Always check `node_modules/next/dist/docs/` for the
  API you're about to use.
- **TypeScript 5**, strict.
- **shadcn/ui** in the New York style (see `components.json`) over Radix
  primitives. UI primitives live in `src/components/ui/`; feature
  components live in `src/components/`. **Prefer adding shadcn primitives
  over hand-rolling Radix usage** — keep the design system coherent.
- **Tailwind CSS v4** (no `tailwind.config.*` — config is in
  `src/app/globals.css` via `@theme`). `--ficsit-orange`, `--ficsit-teal`,
  etc. are CSS vars defined there.
- **lucide-react** for icons.
- **Zustand** for the single save store (`src/store/save-store.ts`).
- **Comlink** for the Worker bridge (`src/lib/worker-client.ts`).
- **Jest 30** + **@swc/jest** + **jsdom** for unit tests. Tests are
  co-located with the code they cover (`src/lib/edits/*.test.ts`).
- **Bun** is the package manager and script runner (`bun.lock` is the
  lockfile of record).

## Repo layout

```
src/
  app/                  Next.js App Router. layout.tsx wires fonts (Geist + Oxanium).
    api/health/         Liveness endpoint
    page.tsx            Single-page UI: Hero → FilePicker → Tabs → PendingChanges
  components/
    ui/                 shadcn/ui primitives — generated, edit sparingly
    *-tab.tsx           One feature per tab (purity / inventory / mam-research / hard-drive)
    file-picker.tsx     Drop target + file input → save-worker
    save-summary.tsx    Read-only header info on the loaded save
    pending-changes.tsx Diff panel + Apply / Download bar
    hero.tsx            Self-contained inline-SVG hero (no external assets)
  data/game-data.json   Parsed items/schematics/recipes for 1.2 (committed)
  lib/
    parser/{load,save,types}.ts  Thin wrappers around @etothepii's parser
    edits/{purity,inventory,research}.ts  Pure edit functions + co-located tests
    game-data.ts        Typed accessors over the bundled game data
    worker-client.ts    Comlink proxy + Worker construction
    utils.ts            cn() and small helpers
  store/save-store.ts   Zustand store: summary, pending edits, dirty flag
  workers/save-worker.ts  Web Worker entry — re-exports load/save/edit fns over Comlink
scripts/                build-docs, download-icons, dump-*, test-*-roundtrip
public/icons/           339 item/schematic PNGs mirrored from SCIM (committed)
data/                   Local-only raw game docs (gitignored)
test/                   Local-only real .sav fixtures (gitignored)
```

## Architecture conventions

- **Edits are pure functions.** Each edit module in `src/lib/edits/`
  exports a function that takes a parsed save + edit input and returns a
  mutated save (or a fresh copy — see existing patterns). Side effects
  (file IO, worker messaging) belong in the Worker entry or the store.
- **The store is the only writable state.** Components read from
  `useSaveStore` and dispatch via its actions; they do not call the worker
  directly.
- **The Worker is the only place that holds the parsed save.** Heavy save
  objects don't cross the Comlink boundary except for the small `summary`
  projection. When you need to apply an edit, dispatch a typed message to
  the worker; the worker mutates its in-memory save and returns a fresh
  summary + diff.
- **New edits get a Jest lock-down test.** `src/lib/edits/*.test.ts`
  exercises the pure function against a synthetic save object. For
  format-level confidence against real saves, add or extend a script in
  `scripts/test-*-roundtrip.ts`.
- **Game data is bundled, not fetched.** `src/data/game-data.json` is
  the source of truth for what schematics / items / recipes exist. If you
  need a field that isn't there, extend `scripts/build-docs.ts`, regenerate,
  and commit the new JSON.
- **Icons are static files in `public/icons/`** with the basename pattern
  `<thing>_256.png`. `<ItemIcon>` falls back to an initials box on 404.

## What's editable today

These are the implemented edits. When extending, mirror the existing
patterns rather than inventing new ones.

- **Purity** — world-level `mNodePuritySettings` + per-node
  `mPurityOverride`. Verified round-trip; both writes are required for the
  edit to stick on 1.2.
- **Inventory & hand slots** — `mNumTotalInventorySlots` and
  `mNumTotalArmEquipmentSlots` on `BP_UnlockSubsystem_C`, plus per-player
  `mNumObservedInventorySlots` mirror writes on every `BP_PlayerState_C`.
- **MAM Research** — every `EST_MAM` schematic, per-row checkbox or bulk
  unlock/lock. Writes to `SchematicManager.mPurchasedSchematics`, ensures
  the parent tree is in `ResearchManager.mUnlockedResearchTrees`, and
  applies the schematic's unlock effects to `UnlockSubsystem` (slot counts,
  panel toggles).
- **Hard Drive alternates** — every `EST_Alternate` schematic, grouped by
  the item they produce. Same write path as MAM (no research tree to
  update).

## Stylistic / behavioural conventions

- **Match the existing terse comment style.** Block comments at the top of
  files explain *why* and what's surprising about a chunk of save state.
  In-line comments are sparse. Don't pad new code with restating-the-code
  comments.
- **No emojis in source, docs, or commits** unless explicitly requested.
- **Don't fetch external resources at runtime.** Icons are mirrored
  precisely so the app works offline; keep it that way.
- **Don't introduce a backend.** The privacy story ("your save never
  leaves your browser") is load-bearing.
- **Round-trip is the bar.** An edit that writes a field but doesn't
  survive `serialize → parse` is broken even if the in-memory object looks
  right. Add a `scripts/test-*-roundtrip.ts` helper when you're working in
  new territory.

## Common pitfalls (learned the hard way)

- Many state changes in Satisfactory require **two writes** to stick — a
  global setting plus a per-entity mirror. Purity is the canonical
  example. Always grep for both halves before declaring an edit done.
- Schematic unlock effects are not automatic. Marking
  `mPurchasedSchematics` is necessary but not sufficient; you also need to
  apply the schematic's unlock effects to `UnlockSubsystem` (slot bumps,
  recipe unlocks, panel toggles). See `src/lib/edits/research.ts` for the
  pattern.
- The raw docs file is **UTF-16 LE** with a BOM and includes characters
  that break naive JSON parsers. The `satisfactory-docs-parser` package
  handles this — don't try to read it with `JSON.parse(fs.readFileSync(...))`.
- 1.2-only items occasionally aren't in SCIM's icon set yet; the icon
  download script logs these as 404s and the UI falls back. Don't try to
  fix this by pointing icons at a hotlink — SCIM blocks hotlinking and
  the app needs to work offline.
