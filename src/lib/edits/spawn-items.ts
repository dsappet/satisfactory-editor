/**
 * Item spawning — drops a loot/dismantle crate (BP_Crate_C) at a player's
 * location, pre-filled with chosen items. This is the same crate the game
 * spawns when you dismantle a building and your inventory is full, so the
 * items are waiting on the ground the next time that player loads in.
 *
 * UNLIKE every other edit in this app, this one CREATES new objects rather
 * than mutating existing ones. A crate is a two-object pair (mirrors the
 * player → character → inventory-component chain in inventory.ts):
 *
 *   1. The crate actor   — a SaveEntity of typePath CRATE_TYPE_PATH, carrying a
 *      world transform and an `mInventory` ObjectProperty pointing at (2).
 *   2. An inventory comp — a SaveComponent of typePath FGInventoryComponent,
 *      whose `mInventoryStacks` array holds the items. Its `parentEntityName`
 *      points back at the crate actor.
 *
 * The serializer (data-blob / toc-blob) regenerates both the object-header
 * list and the data blob from `level.objects` on write, so adding new objects
 * is just `level.objects.push(...)` — there's no separate index to keep in
 * sync. We copy version framing (rootObject, saveCustomVersion,
 * shouldMigrateObjectRefsToPersistent) from a real sibling in the same level
 * and set the crate-specific flags directly.
 *
 * The crate format below was confirmed by dumping a real dismantle crate from
 * a 1.2 save and is exercised end-to-end (spawn → serialize → parse) by
 * scripts/test-crate-roundtrip.ts. Key facts from that dump:
 *   - crate actor typePath = CRATE_TYPE_PATH, flags 8, rootObject the bare
 *     level name; it has NO mInventory property — the link to its inventory is
 *     the `components` list, and it carries mCrateType = CT_DismantleCrate.
 *   - the inventory component is named `<crate>.inventory` (flags 262152) with
 *     properties mAdjustedSizeDiff, mInventoryStacks, mArbitrarySlotSizes,
 *     mAllowedItemDescriptors — the last three all parallel to the slot count.
 *   - inventory-stack tags carry the /Script/FactoryGame package node and the
 *     Item struct property carries flags 8; itemReference.levelName is "".
 */
import type {
  SatisfactorySave,
  SaveObject,
  IntProperty,
  ObjectProperty,
  ArrayProperty,
  ObjectReference,
} from "@/lib/parser/types";
import { PLAYER_STATE_TYPE_PATH } from "@/lib/edits/inventory";

/** The dismantle / loot crate actor class. */
export const CRATE_TYPE_PATH =
  "/Game/FactoryGame/-Shared/Crate/BP_Crate.BP_Crate_C";

/** Inventory component class shared by every container/crate/player bag. */
export const INVENTORY_COMPONENT_TYPE_PATH =
  "/Script/FactoryGame.FGInventoryComponent";

/**
 * Subobject name the crate's class gives its inventory component. The full
 * component instanceName is `<crate>.<this>`. Confirmed by dumping a real
 * dismantle crate (see scripts/test-crate-roundtrip.ts).
 */
export const CRATE_INVENTORY_COMPONENT_NAME = "inventory";

/**
 * Crate kind. A real dismantle crate carries this enum; we reuse it so the
 * spawned crate behaves like the in-game dismantle crate (auto-collected when
 * emptied, retrievable from the HUB, etc.).
 */
export const CRATE_TYPE_ENUM_VALUE = "EFGCrateType::CT_DismantleCrate";

/** UE struct/enum package node that appears in 1.2 complete property tags. */
const FACTORYGAME_PACKAGE = "/Script/FactoryGame";

// Object flags observed on a real dismantle crate (actor) and its inventory
// component. These are role-specific, not save-specific, so we set them
// directly rather than copying from a sibling.
const CRATE_ACTOR_FLAGS = 8;
const CRATE_INVENTORY_FLAGS = 262152;

/**
 * Cap on how many stacks (slots) go in a single crate. Dismantle crates resize
 * to fit, but we spill into extra crates past this so no single inventory grows
 * unreasonably large.
 */
export const MAX_STACKS_PER_CRATE = 128;

/** Hard ceiling on total stacks across one spawn, to keep saves sane. */
export const MAX_TOTAL_STACKS = 2048;

export type SpawnTarget = {
  /** BP_PlayerState_C instanceName — the value the UI selects by. */
  instanceName: string;
  displayName: string;
  /** True when we can resolve a world position to drop the crate at. */
  hasLocation: boolean;
};

export type SpawnItemInput = {
  /** Full save-class path of the item descriptor. */
  pathName: string;
  /** Total number of this item to spawn (split across stacks automatically). */
  count: number;
  /** Per-stack cap (item stack size). Falls back to count when omitted. */
  stackSize?: number;
  /** Display label, used only for error messages. */
  label?: string;
};

export type SpawnResult = {
  /** instanceNames of every object we created (crates + their components). */
  spawnedInstanceNames: string[];
  crateCount: number;
  totalStacks: number;
  totalItems: number;
};

type Vec3 = { x: number; y: number; z: number };
type Vec4 = { x: number; y: number; z: number; w: number };
type Transform = { rotation: Vec4; translation: Vec3; scale3d: Vec3 };

const allObjects = (save: SatisfactorySave): SaveObject[] => {
  const out: SaveObject[] = [];
  for (const level of Object.values(save.levels)) {
    for (const obj of level.objects) out.push(obj);
  }
  return out;
};

const findByInstanceName = (
  save: SatisfactorySave,
  pathName: string
): SaveObject | undefined => {
  if (!pathName) return undefined;
  return allObjects(save).find((o) => o.instanceName === pathName);
};

const readObjectRef = (
  obj: SaveObject,
  name: string
): ObjectReference | null => {
  const prop = obj.properties?.[name] as
    | ObjectProperty
    | ObjectProperty[]
    | undefined;
  if (!prop) return null;
  const single = Array.isArray(prop) ? prop[0] : prop;
  const ref = single?.value;
  if (!ref || typeof ref.pathName !== "string") return null;
  return ref;
};

const readDisplayName = (obj: SaveObject): string => {
  const prop = obj.properties?.["mCachedPlayerName"];
  if (prop && typeof prop === "object" && "value" in prop) {
    const v = (prop as { value: unknown }).value;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return obj.instanceName;
};

const readTransform = (obj: SaveObject): Transform | null => {
  const t = (obj as unknown as { transform?: Transform }).transform;
  if (!t || !t.translation || typeof t.translation.x !== "number") return null;
  return t;
};

/** PS → mOwnedPawn → Char_Player_C. Returns the character SaveObject. */
const resolveCharacter = (
  save: SatisfactorySave,
  playerState: SaveObject
): SaveObject | undefined => {
  const ref = readObjectRef(playerState, "mOwnedPawn");
  if (!ref) return undefined;
  return findByInstanceName(save, ref.pathName);
};

export function listSpawnTargets(save: SatisfactorySave): SpawnTarget[] {
  return allObjects(save)
    .filter((o) => o.typePath === PLAYER_STATE_TYPE_PATH)
    .map((ps) => {
      const character = resolveCharacter(save, ps);
      const hasLocation = !!(character && readTransform(character));
      return {
        instanceName: ps.instanceName,
        displayName: readDisplayName(ps),
        hasLocation,
      };
    });
}

// ───────── Property / object synthesis ─────────

const intProperty = (name: string, value: number): IntProperty => ({
  type: "IntProperty",
  name,
  propertyTagType: { name: "IntProperty", children: [] },
  value,
});

const intArrayProperty = (name: string, values: number[]): ArrayProperty =>
  ({
    type: "ArrayProperty",
    name,
    propertyTagType: {
      name: "ArrayProperty",
      children: [{ name: "IntProperty", children: [] }],
    },
    values,
  }) as unknown as ArrayProperty;

// ArrayProperty<ObjectProperty> whose values are raw ObjectReferences. Used for
// mAllowedItemDescriptors (all empty refs on a fresh crate = no restriction).
const objRefArrayProperty = (
  name: string,
  values: ObjectReference[]
): ArrayProperty =>
  ({
    type: "ArrayProperty",
    name,
    propertyTagType: {
      name: "ArrayProperty",
      children: [{ name: "ObjectProperty", children: [] }],
    },
    values,
  }) as unknown as ArrayProperty;

// FInventoryStack as a dynamic struct, matching exactly what a real dismantle
// crate serializes on 1.2: the InventoryItem tag carries the /Script/FactoryGame
// package node and the Item property carries flags=8.
const inventoryStack = (itemPathName: string, num: number) => ({
  type: "InventoryStack",
  properties: {
    Item: {
      type: "StructProperty",
      name: "Item",
      propertyTagType: {
        name: "StructProperty",
        children: [
          {
            name: "InventoryItem",
            children: [{ name: FACTORYGAME_PACKAGE, children: [] }],
          },
        ],
      },
      flags: 8,
      value: {
        itemReference: { levelName: "", pathName: itemPathName },
        itemState: { hasValidStruct: false },
      },
    },
    NumItems: intProperty("NumItems", num),
  },
});

const stacksArrayProperty = (
  values: ReturnType<typeof inventoryStack>[]
): ArrayProperty =>
  ({
    type: "ArrayProperty",
    name: "mInventoryStacks",
    propertyTagType: {
      name: "ArrayProperty",
      children: [
        {
          name: "StructProperty",
          children: [
            {
              name: "InventoryStack",
              children: [{ name: FACTORYGAME_PACKAGE, children: [] }],
            },
          ],
        },
      ],
    },
    values,
  }) as unknown as ArrayProperty;

const crateTypeEnumProperty = () => ({
  type: "EnumProperty",
  name: "mCrateType",
  propertyTagType: {
    name: "EnumProperty",
    children: [
      {
        name: "EFGCrateType",
        children: [{ name: FACTORYGAME_PACKAGE, children: [] }],
      },
      { name: "ByteProperty", children: [] },
    ],
  },
  value: { value: CRATE_TYPE_ENUM_VALUE },
});

type StructTemplate = {
  rootObject: string;
  saveCustomVersion: number;
  shouldMigrateObjectRefsToPersistent: boolean;
};

const templateFrom = (obj: SaveObject): StructTemplate => ({
  rootObject: obj.rootObject,
  saveCustomVersion:
    (obj as unknown as { saveCustomVersion?: number }).saveCustomVersion ?? 0,
  shouldMigrateObjectRefsToPersistent:
    (obj as unknown as { shouldMigrateObjectRefsToPersistent?: boolean })
      .shouldMigrateObjectRefsToPersistent ?? false,
});

const makeCrateActor = (
  instanceName: string,
  componentInstanceName: string,
  transform: Transform,
  refLevelName: string,
  tmpl: StructTemplate
): SaveObject =>
  ({
    type: "SaveEntity",
    typePath: CRATE_TYPE_PATH,
    rootObject: tmpl.rootObject,
    instanceName,
    flags: CRATE_ACTOR_FLAGS,
    parentEntityName: "",
    needTransform: true,
    transform,
    wasPlacedInLevel: false,
    parentObject: { levelName: "", pathName: "" },
    // The crate finds its inventory through the components list, not an
    // mInventory property — a real dismantle crate has no such property.
    components: [{ levelName: refLevelName, pathName: componentInstanceName }],
    properties: {
      mCrateType: crateTypeEnumProperty(),
    },
    specialProperties: { type: "EmptySpecialProperties" },
    trailingData: [],
    saveCustomVersion: tmpl.saveCustomVersion,
    shouldMigrateObjectRefsToPersistent:
      tmpl.shouldMigrateObjectRefsToPersistent,
  }) as unknown as SaveObject;

const makeInventoryComponent = (
  instanceName: string,
  crateInstanceName: string,
  stacks: ReturnType<typeof inventoryStack>[],
  tmpl: StructTemplate
): SaveObject =>
  ({
    type: "SaveComponent",
    typePath: INVENTORY_COMPONENT_TYPE_PATH,
    rootObject: tmpl.rootObject,
    instanceName,
    flags: CRATE_INVENTORY_FLAGS,
    parentEntityName: crateInstanceName,
    // Property set + order mirror a real dismantle crate's inventory component.
    properties: {
      // Observed diff = slot count - 1 (the crate grows from a 1-slot base).
      mAdjustedSizeDiff: intProperty(
        "mAdjustedSizeDiff",
        Math.max(0, stacks.length - 1)
      ),
      mInventoryStacks: stacksArrayProperty(stacks),
      // Parallel per-slot cap array; 0 means "use the item's default stack
      // size", which is exactly what we want for a freshly spawned crate.
      mArbitrarySlotSizes: intArrayProperty(
        "mArbitrarySlotSizes",
        stacks.map(() => 0)
      ),
      // Parallel allow-list; empty refs = no per-slot item restriction.
      mAllowedItemDescriptors: objRefArrayProperty(
        "mAllowedItemDescriptors",
        stacks.map(() => ({ levelName: "", pathName: "" }))
      ),
    },
    specialProperties: { type: "EmptySpecialProperties" },
    trailingData: [],
    saveCustomVersion: tmpl.saveCustomVersion,
    shouldMigrateObjectRefsToPersistent:
      tmpl.shouldMigrateObjectRefsToPersistent,
  }) as unknown as SaveObject;

// ───────── Spawn ─────────

/** Split a total count into stacks no larger than `stackSize`. */
const splitIntoStacks = (count: number, stackSize: number): number[] => {
  const cap = stackSize > 0 ? stackSize : count;
  const out: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const n = Math.min(cap, remaining);
    out.push(n);
    remaining -= n;
  }
  return out;
};

const findLevelOf = (
  save: SatisfactorySave,
  instanceName: string
): { name: string } & { objects: SaveObject[] } => {
  for (const level of Object.values(save.levels)) {
    if (level.objects.some((o) => o.instanceName === instanceName)) {
      return level as { name: string; objects: SaveObject[] };
    }
  }
  // Fall back to the largest level (the persistent level), which is where
  // players and the unlock subsystem live.
  let biggest: { name: string; objects: SaveObject[] } | null = null;
  for (const level of Object.values(save.levels)) {
    const l = level as { name: string; objects: SaveObject[] };
    if (!biggest || l.objects.length > biggest.objects.length) biggest = l;
  }
  if (!biggest) throw new Error("Save has no levels to spawn into.");
  return biggest;
};

/**
 * Remove a set of previously-spawned objects from every level. Used to make
 * the spawn idempotent: re-staging rebuilds crates from the current selection
 * rather than piling more on top of the old ones.
 */
export function removeSpawnedObjects(
  save: SatisfactorySave,
  instanceNames: string[]
): void {
  if (instanceNames.length === 0) return;
  const drop = new Set(instanceNames);
  for (const level of Object.values(save.levels)) {
    const l = level as { objects: SaveObject[] };
    l.objects = l.objects.filter((o) => !drop.has(o.instanceName));
  }
}

export function spawnItemsInCrates(
  save: SatisfactorySave,
  args: {
    playerInstanceName: string;
    items: SpawnItemInput[];
    /** Previously-spawned objects to clear first (idempotency). */
    removeInstanceNames?: string[];
  }
): SpawnResult {
  // 1) Clear any crates from a previous staging of this edit.
  removeSpawnedObjects(save, args.removeInstanceNames ?? []);

  // 2) Validate inputs before mutating anything further.
  const items = args.items ?? [];
  if (items.length === 0) {
    throw new Error("No items selected to spawn.");
  }
  for (const it of items) {
    if (!it.pathName) {
      throw new Error(
        `Item "${it.label ?? "unknown"}" has no class path — re-run \`bun run build:docs\` to populate item paths.`
      );
    }
    if (!Number.isInteger(it.count) || it.count < 1) {
      throw new Error(
        `Invalid count ${it.count} for "${it.label ?? it.pathName}".`
      );
    }
  }

  // 3) Resolve the target player's character and world location.
  const playerState = findByInstanceName(save, args.playerInstanceName);
  if (!playerState || playerState.typePath !== PLAYER_STATE_TYPE_PATH) {
    throw new Error("Selected player was not found in this save.");
  }
  const character = resolveCharacter(save, playerState);
  if (!character) {
    throw new Error(
      "Selected player has no spawned character in this save, so there's no location to drop a crate at."
    );
  }
  const transform = readTransform(character);
  if (!transform) {
    throw new Error("Could not read the player's location from this save.");
  }

  // 4) Build the flat list of stacks across all items.
  const stacks: Array<{ pathName: string; num: number }> = [];
  let totalItems = 0;
  for (const it of items) {
    for (const num of splitIntoStacks(it.count, it.stackSize ?? it.count)) {
      stacks.push({ pathName: it.pathName, num });
    }
    totalItems += it.count;
  }
  if (stacks.length > MAX_TOTAL_STACKS) {
    throw new Error(
      `That selection needs ${stacks.length} stacks (max ${MAX_TOTAL_STACKS}). Spawn fewer items at once.`
    );
  }

  // 5) Templates + naming. Copy structural framing from real siblings.
  const level = findLevelOf(save, character.instanceName);
  const refComponent =
    (() => {
      const ref = readObjectRef(character, "mInventory");
      return ref ? findByInstanceName(save, ref.pathName) : undefined;
    })() ?? undefined;
  const actorTemplate = templateFrom(character);
  const componentTemplate = refComponent
    ? templateFrom(refComponent)
    : actorTemplate;
  // Component object-references conventionally carry the level name; copy
  // whatever the character's own mInventory ref uses.
  const refLevelName =
    readObjectRef(character, "mInventory")?.levelName ?? "";
  // Prefix = everything up to the last "." of the character's instanceName,
  // i.e. the persistent-level path that all actors hang off.
  const prefix = character.instanceName.includes(".")
    ? character.instanceName.slice(0, character.instanceName.lastIndexOf("."))
    : "Persistent_Level:PersistentLevel";

  const used = new Set(allObjects(save).map((o) => o.instanceName));
  let nextId = 1_900_000_000;
  const uniqueCrateName = (): string => {
    let name: string;
    do {
      name = `${prefix}.BP_Crate_C_${nextId++}`;
    } while (used.has(name));
    used.add(name);
    return name;
  };

  // 6) Chunk stacks into crates and build the objects.
  const spawnedInstanceNames: string[] = [];
  let crateIndex = 0;
  for (let i = 0; i < stacks.length; i += MAX_STACKS_PER_CRATE) {
    const chunk = stacks.slice(i, i + MAX_STACKS_PER_CRATE);
    const crateName = uniqueCrateName();
    const componentName = `${crateName}.${CRATE_INVENTORY_COMPONENT_NAME}`;

    // Offset each crate slightly so they don't perfectly overlap on the ground.
    const crateTransform: Transform = {
      rotation: { ...transform.rotation },
      translation: {
        x: transform.translation.x + crateIndex * 200,
        y: transform.translation.y,
        z: transform.translation.z,
      },
      scale3d: { x: 1, y: 1, z: 1 },
    };

    const stackStructs = chunk.map((s) => inventoryStack(s.pathName, s.num));

    level.objects.push(
      makeCrateActor(
        crateName,
        componentName,
        crateTransform,
        refLevelName,
        actorTemplate
      )
    );
    level.objects.push(
      makeInventoryComponent(
        componentName,
        crateName,
        stackStructs,
        componentTemplate
      )
    );

    spawnedInstanceNames.push(crateName, componentName);
    crateIndex += 1;
  }

  return {
    spawnedInstanceNames,
    crateCount: crateIndex,
    totalStacks: stacks.length,
    totalItems,
  };
}
