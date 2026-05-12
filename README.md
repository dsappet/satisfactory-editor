# Satisfactory save editor

In-browser editor for Satisfactory 1.2 save files. Parses, edits (purity,
inventory & hand slots, MAM data lookups), and re-serializes saves entirely
client-side — files never leave your machine.

## Getting started

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Gotcha: changes to the save worker do NOT hot-reload

The save parser runs in a Web Worker that is **pre-bundled** to
`public/save-worker.js` (because Next/Turbopack with `output: 'export'` can't
bundle `new Worker(new URL(..., import.meta.url))` for static export). The
`dev` script rebuilds the worker once at startup, but `next dev`'s hot-reload
does not watch worker source files.

If you edit any of these and don't see your changes:

- `src/workers/save-worker.ts`
- `src/lib/edits/*`
- `src/lib/parser/*`
- anything else imported by the worker

…you need to rebuild the worker bundle and refresh the browser. Either:

```bash
# in a second terminal, while `bun dev` is running
bun run build:worker
# then hard-refresh the browser tab (Cmd-Shift-R)
```

…or restart `bun dev` entirely.

Symptom of a stale worker: a tab renders blank, or `Comlink` throws a "method
not found" error in the console because the worker bundle is from before you
added the method.

## Updating game data (MAM, items, recipes) for a new patch

The MAM Research tab and any future item/recipe-aware UI read from
`src/data/game-data.json`, which is a slimmed-down parse of the game's
`Docs.json`. The raw `Docs.json` is large (10+ MB, UTF-16) and is gitignored;
the parsed JSON is checked in so the app builds without it.

**To pull in a new game version:**

1. Find `Docs.json` in your Satisfactory install:
   - Steam: `<SteamLibrary>/steamapps/common/Satisfactory/CommunityResources/Docs/Docs.json`
   - Epic: `<EpicGames>/Satisfactory/CommunityResources/Docs/Docs.json`
2. Copy it to `data/` in this repo with a version-tagged name:
   ```
   data/docs_v1-2.json
   ```
   Filename convention: `docs_v<major>-<minor>.json`. Multiple files may
   coexist; `build:docs` picks the highest version.
3. Run the parser:
   ```bash
   bun run build:docs
   ```
4. Commit the regenerated `src/data/game-data.json`. The raw file in `data/`
   stays local (gitignored).

The build is **not** wired into `bun dev` or `bun build` — it only runs when
you explicitly invoke it, because the raw `Docs.json` isn't required for
normal development.

### Updating icons

Item and schematic icons are mirrored from satisfactory-calculator.com (SCIM)
into `public/icons/` and committed to the repo. Mirroring sidesteps SCIM's
hotlink CORS block and makes the app work offline.

After regenerating `game-data.json` for a new patch:

```bash
bun run download:icons
```

The script is idempotent — it only fetches basenames that aren't already in
`public/icons/`. Failures (typically 404s for new 1.2-only icons SCIM hasn't
caught up to) are logged and the `<ItemIcon>` component falls back to an
initials box. If you want better coverage you can extract the missing icons
locally from your game install with UModel and drop them in by hand using
the same naming convention (`<basename>_256.png`).

## Scripts

| Script | What it does |
|---|---|
| `bun dev` | Rebuilds the worker, starts `next dev`. |
| `bun run build` | Rebuilds the worker, runs `next build`. |
| `bun run build:worker` | Re-bundles `src/workers/save-worker.ts` → `public/save-worker.js`. |
| `bun run build:docs` | Re-parses `data/docs_v*.json` → `src/data/game-data.json`. |
| `bun run download:icons` | Mirrors any new icons referenced by `game-data.json` from SCIM into `public/icons/`. |
| `bun test` | Runs the Jest suite (parser/edit lock-down tests). |
| `bun run lint` | ESLint. |

## What's editable today

- **Purity** — world-level `mNodePuritySettings` + per-node `mPurityOverride`.
  Verified round-trip; both writes are required for the edit to stick on 1.2.
- **Inventory & hand slots** — `mNumTotalInventorySlots` and
  `mNumTotalArmEquipmentSlots` on `BP_UnlockSubsystem_C`, plus per-player
  `mNumObservedInventorySlots` mirror writes on every `BP_PlayerState_C`.

## What's read-only

- **MAM Research** tab — lists all MAM schematics with cost and what they
  unlock. The save-side edit (flipping entries in `BP_ResearchManager_C`) is
  the next milestone.
