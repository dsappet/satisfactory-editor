#!/usr/bin/env bun
/**
 * Parses the game's localized docs JSON into a slim, app-shaped JSON for
 * static import. Re-run when a new patch lands.
 *
 *   1. Drop a fresh file into /data/. Coffee Stain ships it as
 *      `<game-install>/CommunityResources/Docs/en-US.json` (UTF-16 LE).
 *      Keep that name, or rename to `docs_v<maj>-<min>.json` to keep
 *      multiple game versions side by side — both patterns are accepted.
 *   2. `bun run build:docs`
 *
 * Multiple files can coexist (e.g. docs_v1-1.json, docs_v1-2.json, en-US.json)
 * — names embedding a `v<major>-<minor>` tag win; otherwise we just use
 * whichever sorts last. The raw files are gitignored; the parsed JSON
 * (src/data/game-data.json) IS checked in.
 *
 * Pre-1.0 the file was named `Docs.json` (English-only). The renamed
 * `en-US.json` variant is what shows up in 1.0+ installs.
 *
 * NOTE: We deliberately avoid `satisfactory-docs-parser` (v7.0.1 chokes on a
 * handful of new 1.2 recipes and the failure modes are noisy). The data we
 * care about — schematics, items — has a stable shape that's easier to read
 * directly than to patch around the library.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "data");
const outDir = resolve(root, "src", "data");

type DocsTopLevel = { NativeClass: string; Classes: Record<string, string>[] };

// Accept the historical name (`docs*.json`) and the 1.0+ locale-coded
// filenames (`en-US.json`, `de-DE.json`, …). New devs can drop the file
// straight from their game install without renaming.
const DOCS_FILE_RE = /^(docs.*|[a-z]{2}-[A-Z]{2}.*)\.json$/;

const pickDocsFile = (): { path: string; version: string } => {
  const entries = readdirSync(dataDir).filter((f) => DOCS_FILE_RE.test(f));
  if (entries.length === 0) {
    console.error(
      `No docs / locale-named JSON file found in ${dataDir}.\n` +
        `Drop a copy of <game-install>/CommunityResources/Docs/en-US.json there.`
    );
    process.exit(1);
  }
  const ranked = entries
    .map((name) => {
      const match = /v(\d+)-(\d+)/i.exec(name);
      const tuple: [number, number] = match
        ? [parseInt(match[1], 10), parseInt(match[2], 10)]
        : [0, 0];
      return { name, tuple };
    })
    .sort((a, b) =>
      b.tuple[0] !== a.tuple[0]
        ? b.tuple[0] - a.tuple[0]
        : b.tuple[1] - a.tuple[1]
    );
  const winner = ranked[0];
  const version =
    winner.tuple[0] === 0 && winner.tuple[1] === 0
      ? "unknown"
      : `${winner.tuple[0]}.${winner.tuple[1]}`;
  return { path: resolve(dataDir, winner.name), version };
};

const { path, version } = pickDocsFile();
console.log(`docs source: ${path} (game version ${version})`);

const buf = readFileSync(path);
const text = new TextDecoder("utf-16le").decode(buf).replace(/^﻿/, "");
const docs = JSON.parse(text) as DocsTopLevel[];

const groupByClass = (suffix: string): Record<string, string>[] => {
  const out: Record<string, string>[] = [];
  for (const top of docs) {
    if (!top.NativeClass.endsWith(`${suffix}'`)) continue;
    for (const c of top.Classes ?? []) out.push(c);
  }
  return out;
};

// "(/Script/Engine.BlueprintGeneratedClass'/Game/.../Desc_IronOre.Desc_IronOre_C')"
// → "Desc_IronOre_C"
const extractClassName = (path: string): string => {
  const m = /\.(\w+_C)'/.exec(path);
  return m ? m[1] : path;
};

// "((ItemClass=\"...IronOre_C'\",Amount=10),(ItemClass=\"...Coal_C'\",Amount=5))"
// → [{ className: "Desc_IronOre_C", amount: 10 }, ...]
type ItemQty = { className: string; amount: number };
const parseItemCostList = (s: string | undefined): ItemQty[] => {
  if (!s || s === "()" || s === "") return [];
  const out: ItemQty[] = [];
  const re =
    /ItemClass=\\?"([^"\\]+(?:\\.[^"\\]*)*)\\?",Amount=([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push({ className: extractClassName(m[1]), amount: Number(m[2]) });
  }
  return out;
};

// "(\"...Recipe_Silica_C'\",\"...Recipe_Foo_C'\")" → ["Recipe_Silica_C", ...]
const parsePathList = (s: string | undefined): string[] => {
  if (!s || s === "()" || s === "") return [];
  const out: string[] = [];
  const re = /\\?"([^"\\]+(?:\\.[^"\\]*)*)\\?"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push(extractClassName(m[1]));
  }
  return out;
};

const intOrZero = (s: unknown): number => {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
};

const floatOrZero = (s: unknown): number => {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

// ───────── Items ─────────
// Item descriptors live under multiple native classes (FGItemDescriptor and a
// dozen subclasses for biomass, ammo, equipment, etc.). Anything whose
// ClassName starts with `Desc_` or `BP_EquipmentDescriptor` is fair game.
type SlimItem = {
  name: string;
  description: string;
  sinkPoints: number;
  stackSize: string;
  isFluid: boolean;
  /** Icon asset basename, e.g. "IconDesc_IronPlates_256". Empty if missing. */
  icon: string;
  /** True for FICSMAS / event-only content. Derived from display-name heuristic
   *  since items don't carry mRelevantEvents the way schematics do. */
  event?: "FICSMAS";
};

// Items don't expose mRelevantEvents in the docs JSON, but every FICSMAS item
// follows a consistent class-name convention. Matching on class name avoids
// false positives from base-game items whose display name happens to overlap.
const FICSMAS_CLASS_PATTERNS = [
  /^Desc_Xmas/i,
  /^Desc_Gift/i,
  /^Desc_Snow/i,
  /^Desc_CandyCane/i,
  /^Desc_Fireworks_/i,
  /^BP_EquipmentDescriptorCandyCane/i,
];

const isFicsmasItemClass = (className: string): boolean =>
  FICSMAS_CLASS_PATTERNS.some((re) => re.test(className));

// "Texture2D /Game/.../UI/IconDesc_IronPlates_256.IconDesc_IronPlates_256"
// → "IconDesc_IronPlates_256"
const extractIconBasename = (raw: unknown): string => {
  if (typeof raw !== "string") return "";
  // Take the part after the last "/", then the last "." (asset name is repeated).
  const m = /([\w-]+)\.[\w-]+$/.exec(raw);
  return m ? m[1] : "";
};

const itemNativeClassSuffixes = [
  "FGItemDescriptor",
  "FGItemDescriptorBiomass",
  "FGItemDescriptorNuclearFuel",
  "FGAmmoTypeProjectile",
  "FGAmmoTypeInstantHit",
  "FGAmmoTypeSpreadshot",
  "FGEquipmentDescriptor",
  "FGItemDescriptorPowerBoosterFuel",
  "FGConsumableDescriptor",
  "FGResourceDescriptor",
];

const items: Record<string, SlimItem> = {};
for (const suffix of itemNativeClassSuffixes) {
  for (const entry of groupByClass(suffix)) {
    const className = entry.ClassName;
    if (!className || items[className]) continue;
    const name = entry.mDisplayName || className;
    items[className] = {
      name,
      description: entry.mDescription ?? "",
      sinkPoints: intOrZero(entry.mResourceSinkPoints),
      stackSize: entry.mStackSize ?? "SS_MEDIUM",
      isFluid: entry.mForm === "RF_LIQUID" || entry.mForm === "RF_GAS",
      icon:
        extractIconBasename(entry.mSmallIcon) ||
        extractIconBasename(entry.mPersistentBigIcon),
      event: isFicsmasItemClass(className) ? "FICSMAS" : undefined,
    };
  }
}

// ───────── Schematics ─────────
type SchematicUnlocks = {
  recipes: string[];
  schematics: string[];
  scannerResources: string[];
  inventorySlots: number;
  equipmentHandSlots: number;
  giveItems: ItemQty[];
  emotes: string[];
  scannerObject: boolean;
  efficiencyPanel: boolean;
  overclockPanel: boolean;
  map: boolean;
  customizer: boolean;
  tape: boolean;
};

type SlimSchematic = {
  className: string;
  /** Full pathName as referenced in save files, e.g.
   *  "/Game/FactoryGame/Schematics/Research/Sulfur_RS/Research_Sulfur_5.Research_Sulfur_5_C" */
  pathName: string;
  name: string;
  description: string;
  type: string;
  techTier: number;
  timeToComplete: number;
  cost: ItemQty[];
  unlocks: SchematicUnlocks;
  dependencies: string[];
  /** Icon asset basename pulled out of the SlateBrush struct. */
  icon: string;
  /** For MAM schematics only — full pathName of parent research tree. */
  researchTreePath?: string;
  /** Set when the game tags this schematic for a limited-time event.
   *  Currently only FICSMAS (Christmas). */
  event?: "FICSMAS";
};

// Schematic event tagging is reliable: the game ships mRelevantEvents = "(EV_Christmas)"
// on every FICSMAS schematic (17 of them in 1.2).
const parseSchematicEvent = (raw: unknown): "FICSMAS" | undefined => {
  if (typeof raw !== "string") return undefined;
  if (raw.includes("EV_Christmas")) return "FICSMAS";
  return undefined;
};

// "BlueprintGeneratedClass /Game/FactoryGame/Schematics/Research/Sulfur_RS/Research_Sulfur_5.Research_Sulfur_5_C"
// → "/Game/FactoryGame/Schematics/Research/Sulfur_RS/Research_Sulfur_5.Research_Sulfur_5_C"
const fullNameToPath = (raw: unknown): string => {
  if (typeof raw !== "string") return "";
  const m = /^\S+\s+(\/.+)$/.exec(raw);
  return m ? m[1] : "";
};

// Path "/Game/FactoryGame/Schematics/Research/Sulfur_RS/Research_Sulfur_5.Research_Sulfur_5_C"
// → "/Game/FactoryGame/Schematics/Research/BPD_ResearchTree_Sulfur.BPD_ResearchTree_Sulfur_C"
const deriveResearchTreePath = (schematicPath: string): string | undefined => {
  const m = /\/Schematics\/Research\/([\w-]+)_RS\//.exec(schematicPath);
  if (!m) return undefined;
  const tree = m[1];
  return `/Game/FactoryGame/Schematics/Research/BPD_ResearchTree_${tree}.BPD_ResearchTree_${tree}_C`;
};

// mSchematicIcon is a serialized SlateBrush. The ResourceObject value looks
// like "/Script/Engine.Texture2D'/Game/.../TXUI_HandUpgrade_256.TXUI_HandUpgrade_256'"
// — the path is wrapped in single quotes, and the asset basename is repeated.
const extractSchematicIcon = (raw: unknown): string => {
  if (typeof raw !== "string") return "";
  const m = /ResourceObject="[^"]*\.([\w-]+)'?"/.exec(raw);
  return m ? m[1] : "";
};

const emptyUnlocks = (): SchematicUnlocks => ({
  recipes: [],
  schematics: [],
  scannerResources: [],
  inventorySlots: 0,
  equipmentHandSlots: 0,
  giveItems: [],
  emotes: [],
  scannerObject: false,
  efficiencyPanel: false,
  overclockPanel: false,
  map: false,
  customizer: false,
  tape: false,
});

const schematics: Record<string, SlimSchematic> = {};
for (const entry of groupByClass("FGSchematic")) {
  const className = entry.ClassName;
  if (!className) continue;
  const unlocks = emptyUnlocks();
  const rawUnlocks = entry.mUnlocks as unknown;
  if (Array.isArray(rawUnlocks)) {
    for (const u of rawUnlocks as Record<string, string>[]) {
      switch (u.Class) {
        case "BP_UnlockRecipe_C":
          unlocks.recipes.push(...parsePathList(u.mRecipes));
          break;
        case "BP_UnlockSchematic_C":
          unlocks.schematics.push(...parsePathList(u.mSchematics));
          break;
        case "BP_UnlockScannableResource_C":
          unlocks.scannerResources.push(...parsePathList(u.mResourcesToAddToScanner));
          break;
        case "BP_UnlockInventorySlot_C":
          unlocks.inventorySlots += intOrZero(u.mNumInventorySlotsToUnlock);
          break;
        case "BP_UnlockArmEquipmentSlot_C":
          unlocks.equipmentHandSlots += intOrZero(u.mNumArmEquipmentSlotsToUnlock);
          break;
        case "BP_UnlockGiveItem_C":
          unlocks.giveItems.push(...parseItemCostList(u.mItemsToGive));
          break;
        case "BP_UnlockEmote_C":
          unlocks.emotes.push(...parsePathList(u.mEmotes));
          break;
        case "BP_UnlockScannerObject_C":
          unlocks.scannerObject = true;
          break;
        case "BP_UnlockBuildEfficiency_C":
          unlocks.efficiencyPanel = true;
          break;
        case "BP_UnlockBuildOverclock_C":
          unlocks.overclockPanel = true;
          break;
        case "BP_UnlockMap_C":
          unlocks.map = true;
          break;
        case "BP_UnlockCustomizer_C":
          unlocks.customizer = true;
          break;
        case "BP_UnlockTape_C":
          unlocks.tape = true;
          break;
      }
    }
  }
  const pathName = fullNameToPath(entry.FullName);
  schematics[className] = {
    className,
    pathName,
    name: entry.mDisplayName || className,
    description: entry.mDescription ?? "",
    type: entry.mType ?? "",
    techTier: intOrZero(entry.mTechTier),
    timeToComplete: floatOrZero(entry.mTimeToComplete),
    cost: parseItemCostList(entry.mCost),
    unlocks,
    dependencies: parsePathList(
      typeof entry.mSchematicDependencies === "string"
        ? entry.mSchematicDependencies
        : ""
    ),
    icon: extractSchematicIcon(entry.mSchematicIcon),
    researchTreePath:
      entry.mType === "EST_MAM" ? deriveResearchTreePath(pathName) : undefined,
    event: parseSchematicEvent(entry.mRelevantEvents),
  };
}

// ───────── Recipes ─────────
// Production recipes — anything that produces at least one item. We skip
// buildable recipes (those drive the build gun, not crafting) and pure
// customizer recipes. Used by the Hard Drive tab to render ingredients →
// product previews for each alternate.
type SlimRecipe = {
  className: string;
  name: string;
  ingredients: ItemQty[];
  products: ItemQty[];
  /** Icon basename derived from the first product item. Empty if unknown. */
  icon: string;
};

const recipes: Record<string, SlimRecipe> = {};
for (const entry of groupByClass("FGRecipe")) {
  const className = entry.ClassName;
  if (!className) continue;
  const products = parseItemCostList(entry.mProduct);
  if (products.length === 0) continue;
  const ingredients = parseItemCostList(entry.mIngredients);
  recipes[className] = {
    className,
    name: entry.mDisplayName || className,
    ingredients,
    products,
    icon: items[products[0].className]?.icon ?? "",
  };
}

// ───────── Write ─────────
const output = {
  gameVersion: version,
  generatedAt: new Date().toISOString(),
  items,
  schematics,
  recipes,
};

mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "game-data.json");
writeFileSync(outPath, JSON.stringify(output), "utf-8");

const sizeMB = (
  Buffer.byteLength(JSON.stringify(output), "utf-8") /
  1024 /
  1024
).toFixed(2);
const typeCounts: Record<string, number> = {};
for (const s of Object.values(schematics)) {
  typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1;
}
console.log(`wrote ${outPath} (${sizeMB} MB)`);
console.log(`  items: ${Object.keys(items).length}`);
console.log(`  schematics: ${Object.keys(schematics).length}`);
for (const [t, n] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${t}: ${n}`);
}
console.log(`  recipes: ${Object.keys(recipes).length}`);
