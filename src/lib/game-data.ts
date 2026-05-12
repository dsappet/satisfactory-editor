/**
 * Static accessor for the parsed Docs.json. Regenerate via
 * `bun run build:docs` after dropping a fresh Docs.json into /data/.
 *
 * The JSON is checked into the repo so the app builds without the raw 10+ MB
 * Docs.json being present (the raw file is gitignored).
 */
import raw from "@/data/game-data.json";

export type ItemQty = { className: string; amount: number };

export type GameEvent = "FICSMAS";

export type GameItem = {
  name: string;
  description: string;
  sinkPoints: number;
  stackSize: string;
  isFluid: boolean;
  /** Icon asset basename pulled from Docs.json, e.g. "IconDesc_IronPlates_256". */
  icon: string;
  /** Limited-time event tag (FICSMAS). Undefined for base-game items. */
  event?: GameEvent;
};

export type SchematicUnlocks = {
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

export type Schematic = {
  className: string;
  /** Full save-file pathName, e.g.
   *  "/Game/FactoryGame/Schematics/Research/Sulfur_RS/Research_Sulfur_5.Research_Sulfur_5_C" */
  pathName: string;
  name: string;
  description: string;
  /** mType from the game — e.g. EST_MAM, EST_Milestone, EST_HardDrive. */
  type: SchematicType;
  techTier: number;
  timeToComplete: number;
  cost: ItemQty[];
  unlocks: SchematicUnlocks;
  dependencies: string[];
  /** Icon asset basename pulled from mSchematicIcon. */
  icon: string;
  /** For MAM schematics only — full pathName of the parent research tree. */
  researchTreePath?: string;
  /** Limited-time event tag (FICSMAS). Undefined for permanent content. */
  event?: GameEvent;
};

export type SchematicType =
  | "EST_MAM"
  | "EST_Milestone"
  | "EST_HardDrive"
  | "EST_Alternate"
  | "EST_Tutorial"
  | "EST_Custom"
  | "EST_Customization"
  | "EST_ResourceSink"
  | (string & {});

export type Recipe = {
  className: string;
  name: string;
  ingredients: ItemQty[];
  products: ItemQty[];
  /** Icon basename derived from the first product item. */
  icon: string;
};

export type GameData = {
  gameVersion: string;
  generatedAt: string;
  items: Record<string, GameItem>;
  schematics: Record<string, Schematic>;
  recipes: Record<string, Recipe>;
};

export const gameData = raw as unknown as GameData;

export const itemName = (className: string): string =>
  gameData.items[className]?.name ?? className;

export const schematicsByType = (type: SchematicType): Schematic[] =>
  Object.values(gameData.schematics).filter((s) => s.type === type);

/**
 * URL for a locally-mirrored icon. Icons are downloaded once by
 * `bun run download:icons` into /public/icons/ (and committed). Mirroring
 * sidesteps SCIM's hotlink CORS block and makes the app work offline.
 *
 * The on-disk filename is always the `_256` variant — any `_64`/`_128`/etc.
 * suffix in the asset name is normalized to match. Returns null if no icon
 * basename is known.
 */
export const iconUrl = (assetBasename: string | undefined): string | null => {
  if (!assetBasename) return null;
  const normalized = assetBasename.replace(/_(?:32|64|128|512)$/, "_256");
  return `/icons/${normalized}.png`;
};

export const itemIconUrl = (className: string): string | null =>
  iconUrl(gameData.items[className]?.icon);

export const schematicIconUrl = (className: string): string | null =>
  iconUrl(gameData.schematics[className]?.icon);
