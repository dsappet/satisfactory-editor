# Development

Engineering notes for contributors. If you just want to use the editor, head
to [satisfactory-editor.com](https://satisfactory-editor.com) or read the
[README](./README.md).

## Prerequisites

- [Bun](https://bun.sh) (the project lockfile is `bun.lock`; npm/yarn/pnpm
  will work but aren't tested in CI).
- Node 20+ is recommended for the `@types/node` line shipped in `package.json`.

## Getting started

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

No further setup is needed for normal development — the parsed game data and
icons are checked into the repo. See [Files not in the repo](#files-not-in-the-repo)
for what you only need to grab when working on the data pipeline or the
smoke-test scripts.

## Project layout

```
src/
  app/                  Next.js App Router entry points + /api routes
  components/           Feature components (purity-tab, mam-research-tab, …)
    ui/                 shadcn/ui primitives
  data/game-data.json   Parsed items/schematics/recipes for 1.2 (committed)
  lib/
    parser/             load.ts / save.ts wrappers around @etothepii's parser
    edits/              Pure edit functions + co-located *.test.ts lock-downs
    game-data.ts        Typed accessors over the bundled game data
    worker-client.ts    Comlink-wrapped Worker proxy
  store/                Zustand store (single `save-store.ts`)
  workers/save-worker.ts  Web Worker entry — re-exports load/save/edit fns
scripts/                build-docs, download-icons, dump-*, test-*-roundtrip
public/icons/           339 item/schematic PNGs (committed)
data/                   Local-only raw game docs (gitignored)
test/                   Local-only real .sav fixtures for smoke tests (gitignored)
```

## Files not in the repo

A few inputs are deliberately gitignored. None of them are required for
`bun dev` to work, but each is needed for a specific contributor task. The
artifacts they produce **are** checked in.

| Path | Used by | When you need to provide it |
|---|---|---|
| `data/en-US.json` (or `data/docs_v<maj>-<min>.json`) | `bun run build:docs` | Only when refreshing game data for a new patch. See [Updating game data](#updating-game-data-mam-items-recipes-for-a-new-patch). |
| `test/*.sav` | `scripts/test-mam-roundtrip.ts`, `scripts/test-alt-roundtrip.ts`, `scripts/dump-*.ts` | Only when running the round-trip smoke tests or inspecting a real save's properties. Drop any 1.2 `.sav` into `test/`; the scripts default to `test/dune.sav`, override with `bun run scripts/test-mam-roundtrip.ts test/your.sav`. |

What's already in the repo so you don't have to fetch it:

- `src/data/game-data.json` — parsed items, schematics, recipes for 1.2.
- `public/icons/` — 339 item/schematic PNGs mirrored from SCIM.
- The pre-built worker is **not** committed — Turbopack rebuilds it from
  `src/workers/save-worker.ts` on every build.

## The save worker

The save parser runs in a Web Worker, instantiated as:

```ts
new Worker(new URL("../workers/save-worker.ts", import.meta.url), { type: "module" })
```

Turbopack picks this pattern up at build time, emits the worker as its own
chunk under `/_next/static/chunks/…`, and rewrites the URL inline. The worker
hot-reloads alongside the rest of the app in `next dev`; in production it's
a content-hashed static asset like any other bundle. There's no separate
build step.

If you edit worker code (`src/workers/save-worker.ts` or anything it imports
from `src/lib/parser/*` / `src/lib/edits/*`) and don't see your changes,
hard-refresh the browser tab (Cmd-Shift-R) so the new chunk is fetched.

## Updating game data (MAM, items, recipes) for a new patch

The MAM Research and Hard Drives tabs read from `src/data/game-data.json`,
which is a slimmed-down parse of the localized docs file Coffee Stain ships
with the game. In 1.0+ that file is `en-US.json` (UTF-16 LE, 10+ MB) —
pre-1.0 it was named `Docs.json`. The raw file is gitignored; the parsed
JSON is checked in so the app builds without it.

**To pull in a new game version:**

1. Find `en-US.json` in your Satisfactory install:
   - Steam: `<SteamLibrary>/steamapps/common/Satisfactory/CommunityResources/Docs/en-US.json`
   - Epic: `<EpicGames>/Satisfactory/CommunityResources/Docs/en-US.json`
2. Copy it to `data/` in this repo. Either filename works:
   ```
   data/en-US.json                 # straight from the game install
   data/docs_v1-2.json             # version-tagged, lets you keep multiple side-by-side
   ```
   When multiple files are present, names with a `v<major>-<minor>` tag win
   over plain locale-coded names. Other locales (`de-DE.json`, `fr-FR.json`,
   …) are accepted but the English file is what the parser is tested
   against.
3. Run the parser:
   ```bash
   bun run build:docs
   ```
4. Commit the regenerated `src/data/game-data.json`. The raw file in `data/`
   stays local (gitignored).

The build is **not** wired into `bun dev` or `bun build` — it only runs when
you explicitly invoke it, because the raw docs file isn't required for
normal development.

### Updating icons

Item and schematic icons are mirrored from satisfactory-calculator.com (SCIM)
into `public/icons/` and **committed to the repo**. Mirroring sidesteps
SCIM's hotlink CORS block and makes the app work offline.

> **Manual-only.** `bun run download:icons` reaches out to a third-party
> host and writes the bytes into the repo. **Never wire it into CI or any
> automated build** — the script refuses to run when `CI` (or any common
> CI flag) is set. The runtime app reads from the committed
> `public/icons/`, so the build doesn't depend on this script. Run it
> manually after a `build:docs` refresh, then **diff `public/icons/` by
> eye** before committing.

After regenerating `game-data.json` for a new patch:

```bash
bun run download:icons
git status public/icons/      # review the new files before committing
```

The script is idempotent — it only fetches basenames that aren't already in
`public/icons/`. Each downloaded file is checked for the PNG magic header
and rejected if it doesn't match (cheap protection against the CDN returning
an HTML error page; not a defense against a determined supply-chain attack).
Failures (typically 404s for new 1.2-only icons SCIM hasn't caught up to)
are logged and the `<ItemIcon>` component falls back to an initials box. If
you want better coverage you can extract the missing icons locally from
your game install with UModel and drop them in by hand using the same
naming convention (`<basename>_256.png`).

## Smoke-test scripts

Helpers under `scripts/` that load a real save, apply an edit, serialize,
re-parse, and compare. They expect a save at `test/<name>.sav` (gitignored).

| Script | What it does |
|---|---|
| `bun run scripts/test-mam-roundtrip.ts [path]` | Unlocks an MAM research, round-trips, prints state before and after. |
| `bun run scripts/test-alt-roundtrip.ts [path]` | Same for a hard-drive alternate plus a slot-upgrade alt. |
| `bun run scripts/dump-slots.ts [path]` | Prints the unlock subsystem's slot counters + every player's observed inventory count. |
| `bun run scripts/dump-research.ts [path]` | Dumps `SchematicManager` / `ResearchManager` / `UnlockSubsystem` array properties (purchased schematics, unlocked trees, etc.). |

These were the empirical tools that drove the design — keeping them around
makes the next round of data spelunking (e.g. for milestones or game-phase
edits) much cheaper.

## Tests

```bash
bun test           # Jest — parser/edit lock-down tests under src/lib/edits/
bun run lint       # ESLint
```

The Jest suite is fast (no real saves required) and covers the pure edit
functions. Round-trip behavior against real saves is exercised by the
`scripts/test-*-roundtrip.ts` helpers above.

## Scripts reference

| Script | What it does |
|---|---|
| `bun dev` | Starts `next dev`. |
| `bun run build` | `next build`. |
| `bun run start` | Starts the production server after `bun run build`. |
| `bun run build:docs` | Parses `data/en-US.json` (or `data/docs_v*.json`) → `src/data/game-data.json`. |
| `bun run download:icons` | Mirrors any new icons referenced by `game-data.json` from SCIM into `public/icons/`. |
| `bun test` | Runs the Jest suite (parser/edit lock-down tests). |
| `bun run lint` | ESLint. |
| `bun run format` | Prettier over `src/**/*.{ts,tsx,css}`. |

## Deploying to a VPS

The app runs as a regular Next.js server (no static export). Image
optimization, lazy loading, and the standard Next runtime all apply.

```bash
# On the build host (or the VPS itself if you build there):
bun install
bun run build
bun run start            # boots next on port 3000 by default
# or:
PORT=8080 bun run start
```

Behind a reverse proxy, point at `127.0.0.1:3000` (or your chosen port) and
let Next handle compression / caching. A minimal nginx block:

```nginx
server {
  listen 443 ssl http2;
  server_name your.domain;
  ssl_certificate     /etc/letsencrypt/live/your.domain/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your.domain/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name your.domain;
  return 301 https://$host$request_uri;
}
```

**Serve over HTTPS.** The privacy claim ("save never leaves your browser")
depends on the user receiving an unmodified JS bundle. Without TLS, a network
attacker between the user and your server can swap the bundle for one that
silently uploads saves, and CSP can't save you from that. Use Let's Encrypt
(`certbot --nginx`) or a host that terminates TLS for you (Caddy, Cloudflare,
Vercel, Fly, etc.). Don't run this app on plain HTTP for users you don't
trust to be on a trusted network.

The app sends a strict CSP (see [`next.config.ts`](./next.config.ts)) that
disallows outbound connections to anywhere but the same origin — auditors
can verify the privacy claim from their browser's devtools without reading
the source.

You do **not** need to re-run `build:docs` or `download:icons` on the VPS —
both produce artifacts that are checked into the repo
(`src/data/game-data.json` and `public/icons/`). A plain `bun run build`
is enough.

There is a liveness endpoint at `/api/health` if you want to wire a
healthcheck.

The app has no backend — all save parsing happens in the user's browser
via a Web Worker. Next is here for the asset pipeline, image optimization,
and a stable URL surface, not for server-side compute.
