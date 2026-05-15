/**
 * Schematic unlock edits — MAM research, hard-drive alternates, AWESOME shop.
 *
 * Empirical save model (1.2):
 *
 *   SchematicManager.mPurchasedSchematics  ArrayProperty<ObjectProperty>
 *     Every completed schematic — milestones, MAM, hard drives, alternates,
 *     shop purchases, tutorials. Adding a schematic's pathName here is what
 *     marks it as "done" from the player's perspective.
 *
 *   ResearchManager.mUnlockedResearchTrees ArrayProperty<ObjectProperty>
 *     One entry per MAM tree the player has unlocked at least one node of
 *     (e.g. BPD_ResearchTree_Sulfur_C). The game adds this when the first
 *     research in a tree is completed.
 *
 *   UnlockSubsystem.*                      Aggregate state derived from the
 *     set of purchased schematics. Slot counts, panel toggles, scanner
 *     resources, emotes, etc. live here. We update these directly so the
 *     edit is visible immediately in-game without relying on the game to
 *     re-derive.
 *
 * Recipe unlocks live elsewhere and are deliberately NOT applied — the game
 * derives the available-recipes list from mPurchasedSchematics on load, so
 * adding to that array is sufficient for recipes to unlock.
 *
 * AWESOME shop bundles (EST_ResourceSink) sometimes wrap nested EST_Custom
 * schematics via BP_UnlockSchematic_C — a "Foundation Material" purchase
 * unlocks the parent shop entry plus a handful of customizer build-gun
 * schematics. We mirror what the game does at purchase time and add the
 * children to mPurchasedSchematics too. On undo, a child is only removed if
 * no OTHER currently-purchased shop bundle still references it (49 nested
 * children in 1.2 are referenced by more than one parent).
 *
 * Items granted by mUnlocks (BP_UnlockGiveItem_C) are NOT pushed into the
 * player's inventory by this edit. For MAM/alternates those are one-shot
 * grants that would compound on re-apply. For shop "Decorations" (statues,
 * trinkets) and "Parts" (hard drive packs, ammo bundles) the items are the
 * whole point of the purchase — but inventory writes are out of scope here.
 * The UI surfaces a clear caveat for those sections.
 */
import type {
  SatisfactorySave,
  SaveObject,
  ArrayProperty,
  IntProperty,
  ObjectReference,
} from "@/lib/parser/types";
import { gameData, type Schematic } from "@/lib/game-data";
import {
  PLAYER_STATE_TYPE_PATH,
  UNLOCK_SUBSYSTEM_TYPE_PATH,
} from "@/lib/edits/inventory";

const SCHEMATIC_MANAGER_TYPE_PATH =
  "/Game/FactoryGame/Schematics/Progression/BP_SchematicManager.BP_SchematicManager_C";
const RESEARCH_MANAGER_TYPE_PATH =
  "/Game/FactoryGame/Recipes/Research/BP_ResearchManager.BP_ResearchManager_C";

export type ResearchState = {
  /** True iff all three singleton objects were found. */
  ready: boolean;
  /** Class names (e.g. "Research_Sulfur_5_C") of MAM schematics already purchased. */
  unlockedClassNames: Set<string>;
};

const allObjects = (save: SatisfactorySave): SaveObject[] => {
  const out: SaveObject[] = [];
  for (const level of Object.values(save.levels)) {
    for (const obj of level.objects) out.push(obj);
  }
  return out;
};

const findByType = (
  save: SatisfactorySave,
  typePath: string
): SaveObject | undefined =>
  allObjects(save).find((o) => o.typePath === typePath);

const findAllByType = (save: SatisfactorySave, typePath: string): SaveObject[] =>
  allObjects(save).filter((o) => o.typePath === typePath);

const readObjectArray = (
  obj: SaveObject,
  name: string
): ObjectReference[] => {
  const prop = obj.properties?.[name] as
    | ArrayProperty
    | ArrayProperty[]
    | undefined;
  if (!prop) return [];
  const single = Array.isArray(prop) ? prop[0] : prop;
  const values = (single as { values?: unknown }).values;
  if (!Array.isArray(values)) return [];
  return values as ObjectReference[];
};

const synthesizeObjectArray = (
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

const writeObjectArray = (
  obj: SaveObject,
  name: string,
  values: ObjectReference[]
): void => {
  const prop = obj.properties?.[name] as
    | ArrayProperty
    | ArrayProperty[]
    | undefined;
  if (prop) {
    const single = Array.isArray(prop) ? prop[0] : prop;
    (single as { values: ObjectReference[] }).values = values;
  } else {
    obj.properties = obj.properties ?? {};
    obj.properties[name] = synthesizeObjectArray(name, values);
  }
};

const synthesizeIntProperty = (
  name: string,
  value: number
): IntProperty => ({
  type: "IntProperty",
  name,
  propertyTagType: { name: "IntProperty", children: [] },
  value,
});

const writeInt = (obj: SaveObject, name: string, value: number): void => {
  const prop = obj.properties?.[name] as
    | IntProperty
    | IntProperty[]
    | undefined;
  if (prop) {
    const single = Array.isArray(prop) ? prop[0] : prop;
    single.value = value;
  } else {
    obj.properties = obj.properties ?? {};
    obj.properties[name] = synthesizeIntProperty(name, value);
  }
};

const readInt = (obj: SaveObject, name: string): number | null => {
  const prop = obj.properties?.[name] as
    | IntProperty
    | IntProperty[]
    | undefined;
  if (!prop) return null;
  const single = Array.isArray(prop) ? prop[0] : prop;
  return typeof single?.value === "number" ? single.value : null;
};

const writeBool = (obj: SaveObject, name: string, value: boolean): void => {
  const prop = obj.properties?.[name] as
    | { type: "BoolProperty"; name: string; propertyTagType?: unknown; value: boolean }
    | undefined;
  if (prop) {
    prop.value = value;
  } else {
    obj.properties = obj.properties ?? {};
    obj.properties[name] = {
      type: "BoolProperty",
      name,
      propertyTagType: { name: "BoolProperty", children: [] },
      value,
    } as never;
  }
};

// pathName "/Game/.../Research_Sulfur_5.Research_Sulfur_5_C" → "Research_Sulfur_5_C"
// Class names may contain hyphens (XMas FICSMAS schematics: Research_XMas_4-2_C),
// so we accept anything that's not a slash or another dot in the suffix.
const pathToClassName = (pathName: string): string => {
  const m = /\.([^./]+_C)$/.exec(pathName);
  return m ? m[1] : pathName;
};

export function getResearchState(save: SatisfactorySave): ResearchState {
  const schMgr = findByType(save, SCHEMATIC_MANAGER_TYPE_PATH);
  const resMgr = findByType(save, RESEARCH_MANAGER_TYPE_PATH);
  const unlock = findByType(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
  const ready = !!schMgr && !!resMgr && !!unlock;
  const unlockedClassNames = new Set<string>();
  if (schMgr) {
    for (const ref of readObjectArray(schMgr, "mPurchasedSchematics")) {
      unlockedClassNames.add(pathToClassName(ref.pathName));
    }
  }
  return { ready, unlockedClassNames };
}

const applyUnlockEffectsToSubsystem = (
  unlock: SaveObject,
  sch: Schematic,
  sign: 1 | -1
): void => {
  const u = sch.unlocks;
  if (u.inventorySlots > 0) {
    const cur = readInt(unlock, "mNumTotalInventorySlots") ?? 0;
    writeInt(unlock, "mNumTotalInventorySlots", cur + sign * u.inventorySlots);
  }
  if (u.equipmentHandSlots > 0) {
    const cur = readInt(unlock, "mNumTotalArmEquipmentSlots") ?? 0;
    writeInt(
      unlock,
      "mNumTotalArmEquipmentSlots",
      cur + sign * u.equipmentHandSlots
    );
  }
  // Boolean panel toggles only flip on; never flip off when removing an
  // unlock (other schematics may grant the same panel).
  if (sign === 1) {
    if (u.map) writeBool(unlock, "mIsMapUnlocked", true);
    if (u.efficiencyPanel)
      writeBool(unlock, "mIsBuildingEfficiencyUnlocked", true);
    if (u.overclockPanel)
      writeBool(unlock, "mIsBuildingOverclockUnlocked", true);
    if (u.customizer) writeBool(unlock, "mIsCustomizerUnlocked", true);
  }
  // Emotes / scannable resources / tape unlocks are deliberately skipped:
  // we'd need the full pathName for each (game-data only has class names),
  // and emotes are cosmetic. Recipe lists aren't a persisted array — the
  // game re-derives them from mPurchasedSchematics on load.
};

/** Mirror inventory-slot edits to player states so observed counts stay in sync. */
const syncPlayerObservedSlots = (save: SatisfactorySave): void => {
  const unlock = findByType(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
  if (!unlock) return;
  const master = readInt(unlock, "mNumTotalInventorySlots");
  if (master === null) return;
  for (const ps of findAllByType(save, PLAYER_STATE_TYPE_PATH)) {
    writeInt(ps, "mNumObservedInventorySlots", master);
  }
};

const ensureSchematicInPurchased = (
  schMgr: SaveObject,
  pathName: string,
  shouldBeIn: boolean
): void => {
  const list = readObjectArray(schMgr, "mPurchasedSchematics");
  const idx = list.findIndex((r) => r.pathName === pathName);
  if (shouldBeIn && idx === -1) {
    list.push({ levelName: "", pathName });
    writeObjectArray(schMgr, "mPurchasedSchematics", list);
  } else if (!shouldBeIn && idx !== -1) {
    list.splice(idx, 1);
    writeObjectArray(schMgr, "mPurchasedSchematics", list);
  }
};

const ensureTreeInUnlocked = (
  resMgr: SaveObject,
  treePath: string | undefined,
  shouldBeIn: boolean,
  /** Set to true while there are still MAM schematics of this tree purchased. */
  treeStillNeeded: boolean
): void => {
  if (!treePath) return;
  const list = readObjectArray(resMgr, "mUnlockedResearchTrees");
  const idx = list.findIndex((r) => r.pathName === treePath);
  if (shouldBeIn && idx === -1) {
    list.push({ levelName: "", pathName: treePath });
    writeObjectArray(resMgr, "mUnlockedResearchTrees", list);
  } else if (!shouldBeIn && !treeStillNeeded && idx !== -1) {
    list.splice(idx, 1);
    writeObjectArray(resMgr, "mUnlockedResearchTrees", list);
  }
};

/**
 * Set the unlocked state of a single MAM schematic. Idempotent.
 *
 * Apply path:
 *   - Push schematic pathName into SchematicManager.mPurchasedSchematics
 *   - Ensure parent research tree is in ResearchManager.mUnlockedResearchTrees
 *   - Add the schematic's unlock effects to UnlockSubsystem aggregates
 *
 * Undo path:
 *   - Remove schematic from mPurchasedSchematics
 *   - Subtract slot-count effects from UnlockSubsystem
 *   - Remove research tree from mUnlockedResearchTrees IF no other MAM
 *     schematic from that tree is still unlocked
 *   - Panel toggles are NEVER flipped off on undo (would be unsafe — other
 *     unlocks could grant the same panel)
 */
/** Schematic types this editor knows how to flip safely. */
const EDITABLE_TYPES = new Set(["EST_MAM", "EST_Alternate", "EST_ResourceSink"]);

export function setSchematicUnlocked(
  save: SatisfactorySave,
  args: { className: string; unlocked: boolean }
): void {
  const sch = gameData.schematics[args.className];
  if (!sch) {
    throw new Error(`Unknown schematic class ${args.className}`);
  }
  if (!EDITABLE_TYPES.has(sch.type)) {
    throw new Error(
      `Schematic type ${sch.type} is not editable here (${args.className}).`
    );
  }
  if (!sch.pathName) {
    throw new Error(
      `Schematic ${args.className} has no pathName — regenerate game-data.json.`
    );
  }

  const schMgr = findByType(save, SCHEMATIC_MANAGER_TYPE_PATH);
  const resMgr = findByType(save, RESEARCH_MANAGER_TYPE_PATH);
  const unlock = findByType(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
  if (!schMgr || !resMgr || !unlock) {
    throw new Error(
      "Save is missing SchematicManager / ResearchManager / UnlockSubsystem; cannot edit research."
    );
  }

  const state = getResearchState(save);
  const wasUnlocked = state.unlockedClassNames.has(args.className);
  if (wasUnlocked === args.unlocked) return;

  ensureSchematicInPurchased(schMgr, sch.pathName, args.unlocked);

  // Recompute tree-still-needed for undo path.
  const remaining = new Set(state.unlockedClassNames);
  if (args.unlocked) remaining.add(args.className);
  else remaining.delete(args.className);
  const treeStillNeeded = [...remaining].some((cn) => {
    const other = gameData.schematics[cn];
    return other?.researchTreePath === sch.researchTreePath;
  });
  ensureTreeInUnlocked(
    resMgr,
    sch.researchTreePath,
    args.unlocked,
    treeStillNeeded
  );

  applyUnlockEffectsToSubsystem(unlock, sch, args.unlocked ? 1 : -1);
  syncPlayerObservedSlots(save);

  // Shop bundles (EST_ResourceSink) wrap nested EST_Custom children via
  // BP_UnlockSchematic_C. Mirror the game's purchase-time behavior: add each
  // child to mPurchasedSchematics on apply; on undo, only remove a child if
  // no OTHER currently-unlocked shop bundle still references it. The "remaining"
  // set above already reflects the post-edit world.
  if (sch.unlocks.schematics.length > 0) {
    if (args.unlocked) {
      for (const childCls of sch.unlocks.schematics) {
        const child = gameData.schematics[childCls];
        if (child?.pathName) {
          ensureSchematicInPurchased(schMgr, child.pathName, true);
        }
      }
    } else {
      const stillReferenced = new Set<string>();
      for (const cn of remaining) {
        const other = gameData.schematics[cn];
        if (!other) continue;
        for (const ch of other.unlocks.schematics) stillReferenced.add(ch);
      }
      for (const childCls of sch.unlocks.schematics) {
        if (stillReferenced.has(childCls)) continue;
        const child = gameData.schematics[childCls];
        if (child?.pathName) {
          ensureSchematicInPurchased(schMgr, child.pathName, false);
        }
      }
    }
  }
}

/**
 * Bulk variant — applies the same `unlocked` value to a list of schematics.
 * Caller decides scope (MAM, alternates, …). Each entry must be of an
 * editable type (EST_MAM or EST_Alternate) or this throws.
 */
export function setBulkSchematicUnlocked(
  save: SatisfactorySave,
  unlocked: boolean,
  classNames: string[]
): void {
  for (const className of classNames) {
    setSchematicUnlocked(save, { className, unlocked });
  }
}
