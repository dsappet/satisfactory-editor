# Satisfactory Save Editor

A friendly, in-browser editor for **Satisfactory 1.2** save files.

**[satisfactory-editor.com](https://satisfactory-editor.com)** — drop in your
`.sav`, tweak a few things, download it back. No account, no upload, no
backend.

## Why it exists

The game ships without an easy way to fix mistakes you regret a hundred
hours in. Forgot to scan a resource node before building over it? Wishing
your starting biome had a few more Pure nodes? Want to unlock a hard-drive
alternate you already researched on another save? This editor is for
those moments.

## What you can edit

- **Resource purity** — flip any node between Impure / Normal / Pure. Both
  the world-level setting and the per-node override are written so the
  change actually sticks in 1.2.
- **Inventory & hand slots** — bump the inventory bag and equipped-arm slot
  counts. Applied to the unlock subsystem *and* mirrored to every player
  state so it shows up in-game immediately.
- **MAM Research** — unlock or lock any MAM schematic (Caterium, Quartz,
  Mycelia, Alien Tech, …). Marks the schematic as purchased, makes sure its
  research tree is unlocked, and applies its unlock effects (slot bumps,
  panel toggles, etc.).
- **Hard Drive alternates** — unlock or lock any alternate recipe, grouped
  by the item it produces. Same write path as MAM, no research tree needed.
- **Game phase skip** — *coming soon.*

## Privacy

Your save **never leaves your browser.** Parsing, editing, and
re-serialization all happen client-side in a Web Worker. There is no upload
endpoint to send it to — the server only ships static assets and the Next.js
runtime.

The app sends a strict Content Security Policy that disallows outbound
connections to anywhere but the same origin, so you can verify the privacy
claim from your browser's devtools without reading source. The hosted site
is served over HTTPS so the JS bundle you receive can't be swapped in
transit.

## Stack

- **Next.js 16** + React 19, App Router
- **shadcn/ui** (New York style) on Radix primitives, Tailwind CSS v4
- **Zustand** for the save store, **Comlink** for the Worker bridge
- [`@etothepii/satisfactory-file-parser`](https://www.npmjs.com/package/@etothepii/satisfactory-file-parser)
  for parsing/serializing `.sav` files
- [`satisfactory-docs-parser`](https://www.npmjs.com/package/satisfactory-docs-parser)
  for the bundled game data

## Try it locally

```bash
bun install
bun dev
# open http://localhost:3000
```

That's it for the user-facing app. Engineering details — the data pipeline,
smoke-test scripts, worker bundling notes, deployment — live in
[DEVELOPMENT.md](./DEVELOPMENT.md).

## Credits

Built on top of
[@etothepii/satisfactory-file-parser](https://github.com/etothepii42/satisfactory-file-parser).
Icons mirrored from [satisfactory-calculator.com](https://satisfactory-calculator.com)
(SCIM) so the app works offline.

Big thanks to the community projects that did the empirical save-format
spelunking before this one — especially
[`@etothepii/satisfactory-file-parser`](https://github.com/etothepii42/satisfactory-file-parser)
and [GreyHak/sat_sav_parse](https://github.com/GreyHak/sat_sav_parse).

Not affiliated with Coffee Stain Studios. Satisfactory is © Coffee Stain.
