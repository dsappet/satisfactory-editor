/**
 * Player inventory & hand (arm-equipment) slot count edits.
 *
 * SOURCE OF TRUTH — empirically confirmed on a 1.2 save:
 *
 *   /Game/FactoryGame/Unlocks/BP_UnlockSubsystem.BP_UnlockSubsystem_C
 *   instanceName: Persistent_Level:PersistentLevel.unlockSubsystem
 *
 *     mNumTotalInventorySlots     (IntProperty) — world-level inventory unlock count
 *     mNumTotalArmEquipmentSlots  (IntProperty) — world-level hand slot unlock count
 *
 * Slot unlocks happen via MAM research, which is a world-level event, so these
 * values are the same for every player in a session.
 *
 * The BP_PlayerState_C objects ALSO carry a per-player observed copy of the
 * inventory count:
 *
 *   /Game/FactoryGame/Character/Player/BP_PlayerState.BP_PlayerState_C
 *     mNumObservedInventorySlots  (IntProperty) — per-player cached copy
 *
 * The per-player copy is replicated from the world value at runtime. On save
 * load the game re-syncs from the world value, so writing only the per-player
 * copy is insufficient — the master must be written too. We update both for
 * immediate consistency.
 *
 * For hand slots the BP_PlayerState_C in observed 1.2 saves carries NO
 * corresponding property — older modding docs reference `mNumArmSlots` on the
 * player state but the game no longer serializes it. So we only write the
 * world-level value for hand slots and do not synthesize anything on
 * BP_PlayerState_C.
 *
 * IMPORTANT — the ACTUAL in-game slot count is the LENGTH of the
 * `mInventoryStacks` array on the player's inventory component, not the
 * unlock-budget value above. `FGInventoryComponent::GetSizeLinear()` returns
 * `mInventoryStacks.Num()`. The unlock subsystem just tracks how many slots
 * the player has *earned*; the inventory component is the bag that actually
 * holds items, and the game does NOT auto-resize it from the unlock count on
 * load. So editing `mNumTotalInventorySlots` alone leaves the player with the
 * same physical bag they had when the save was written.
 *
 * We chase down two components per player:
 *   PlayerState.mOwnedPawn         → Char_Player_C
 *   Char_Player_C.mInventory       → FGInventoryComponent (main bag)
 *   Char_Player_C.mArmsEquipmentSlot → FGInventoryComponent (hand slots)
 *
 * For each, we resize `mInventoryStacks` (TArray<FInventoryStack>) by padding
 * with empty stacks or truncating trailing empty stacks. The parallel
 * `mArbitrarySlotSizes` (per-slot stack cap) is resized to match when present.
 *
 * Truncation only removes trailing slots that are empty (NumItems == 0 and
 * empty item ref), so we never lose the player's inventory contents on a
 * shrink.
 */
import type {
  SatisfactorySave,
  SaveObject,
  IntProperty,
  ObjectProperty,
  ArrayProperty,
  ObjectReference,
} from "@/lib/parser/types";

export const PLAYER_STATE_TYPE_PATH =
  "/Game/FactoryGame/Character/Player/BP_PlayerState.BP_PlayerState_C";

export const UNLOCK_SUBSYSTEM_TYPE_PATH =
  "/Game/FactoryGame/Unlocks/BP_UnlockSubsystem.BP_UnlockSubsystem_C";

export const CHAR_PLAYER_TYPE_PATH =
  "/Game/FactoryGame/Character/Player/Char_Player.Char_Player_C";

export const VANILLA_INVENTORY_SLOTS = 18;
export const MAX_INVENTORY_SLOTS = 120;

export const VANILLA_ARM_SLOTS = 1;
/** Vanilla unlocks cap at 6; we allow some headroom for the editor. */
export const MAX_ARM_SLOTS = 12;

export type PlayerInventoryInfo = {
  instanceName: string;
  /** Best-effort identifier: PlayerState's mCachedPlayerName (StrProperty) when present. */
  displayName: string;
  /** Per-player cached inventory slot count. null if the property is absent. */
  observedInventorySlots: number | null;
};

export type SlotsState = {
  /** True if the world's BP_UnlockSubsystem_C was found in the save. */
  hasUnlockSubsystem: boolean;
  /** World-level master inventory slot count (the source of truth). */
  inventorySlots: number;
  /** World-level master hand-equipment slot count. */
  armSlots: number;
  /** Players found in the save, with their per-player observed inventory count. */
  players: PlayerInventoryInfo[];
};

const allObjects = (save: SatisfactorySave): SaveObject[] => {
  const out: SaveObject[] = [];
  for (const level of Object.values(save.levels)) {
    for (const obj of level.objects) out.push(obj);
  }
  return out;
};

const findPlayerStates = (save: SatisfactorySave): SaveObject[] =>
  allObjects(save).filter((o) => o.typePath === PLAYER_STATE_TYPE_PATH);

const findUnlockSubsystem = (save: SatisfactorySave): SaveObject | undefined =>
  allObjects(save).find((o) => o.typePath === UNLOCK_SUBSYSTEM_TYPE_PATH);

const readIntProperty = (
  obj: SaveObject,
  name: string
): number | null => {
  const prop = obj.properties?.[name] as
    | IntProperty
    | IntProperty[]
    | undefined;
  if (!prop) return null;
  const single = Array.isArray(prop) ? prop[0] : prop;
  return typeof single?.value === "number" ? single.value : null;
};

const readDisplayName = (obj: SaveObject): string => {
  const prop = obj.properties?.["mCachedPlayerName"];
  if (prop && typeof prop === "object" && "value" in prop) {
    const v = (prop as { value: unknown }).value;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return obj.instanceName;
};

export function listPlayers(save: SatisfactorySave): PlayerInventoryInfo[] {
  return findPlayerStates(save).map((obj) => ({
    instanceName: obj.instanceName,
    displayName: readDisplayName(obj),
    observedInventorySlots: readIntProperty(obj, "mNumObservedInventorySlots"),
  }));
}

export function getSlotsState(save: SatisfactorySave): SlotsState {
  const unlock = findUnlockSubsystem(save);
  const players = listPlayers(save);

  if (!unlock) {
    // Older save format or unknown variant. Fall back to the most-common
    // observed inventory count across players; default to vanilla.
    const firstObserved = players
      .map((p) => p.observedInventorySlots)
      .find((v): v is number => v !== null);
    return {
      hasUnlockSubsystem: false,
      inventorySlots: firstObserved ?? VANILLA_INVENTORY_SLOTS,
      armSlots: VANILLA_ARM_SLOTS,
      players,
    };
  }

  return {
    hasUnlockSubsystem: true,
    inventorySlots:
      readIntProperty(unlock, "mNumTotalInventorySlots") ??
      VANILLA_INVENTORY_SLOTS,
    armSlots:
      readIntProperty(unlock, "mNumTotalArmEquipmentSlots") ??
      VANILLA_ARM_SLOTS,
    players,
  };
}

const synthesizeIntProperty = (
  name: string,
  value: number
): IntProperty => ({
  type: "IntProperty",
  name,
  propertyTagType: { name: "IntProperty", children: [] },
  value,
});

const writeIntProperty = (
  obj: SaveObject,
  name: string,
  value: number,
  synthesizeIfMissing: boolean
): boolean => {
  const existing = obj.properties?.[name] as
    | IntProperty
    | IntProperty[]
    | undefined;
  if (existing) {
    const single = Array.isArray(existing) ? existing[0] : existing;
    single.value = value;
    return true;
  }
  if (!synthesizeIfMissing) return false;
  obj.properties = obj.properties ?? {};
  obj.properties[name] = synthesizeIntProperty(name, value);
  return true;
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

const findByInstanceName = (
  save: SatisfactorySave,
  pathName: string
): SaveObject | undefined => {
  if (!pathName) return undefined;
  return allObjects(save).find((o) => o.instanceName === pathName);
};

/**
 * For each BP_PlayerState_C, follow `mOwnedPawn` → Char_Player_C and from
 * there `mInventory` (main bag) and `mArmsEquipmentSlot` (hand slots) to
 * resolve the player's FGInventoryComponent SaveObjects. A given component
 * may be missing if the player has never been spawned in this save, in which
 * case it's skipped — leaving the unlock-budget edit as the only effect.
 */
type PlayerInventoryComponents = {
  playerState: SaveObject;
  mainInventory?: SaveObject;
  armsInventory?: SaveObject;
};

const findPlayerInventoryComponents = (
  save: SatisfactorySave
): PlayerInventoryComponents[] => {
  const out: PlayerInventoryComponents[] = [];
  for (const ps of findPlayerStates(save)) {
    const ownedPawnRef = readObjectRef(ps, "mOwnedPawn");
    if (!ownedPawnRef) {
      out.push({ playerState: ps });
      continue;
    }
    const character = findByInstanceName(save, ownedPawnRef.pathName);
    if (!character) {
      out.push({ playerState: ps });
      continue;
    }
    const invRef = readObjectRef(character, "mInventory");
    const armsRef = readObjectRef(character, "mArmsEquipmentSlot");
    out.push({
      playerState: ps,
      mainInventory: invRef
        ? findByInstanceName(save, invRef.pathName)
        : undefined,
      armsInventory: armsRef
        ? findByInstanceName(save, armsRef.pathName)
        : undefined,
    });
  }
  return out;
};

// FInventoryStack values are parsed as dynamic structs:
//   { type: "InventoryStack", properties: { Item: StructProperty, NumItems: IntProperty } }
// An empty slot has an empty item-reference and NumItems == 0. We synthesize
// the full shape rather than an empty `properties: {}` because the game
// writes the full shape in real saves and we want to round-trip identically.
type DynamicStructValue = {
  type: string;
  properties: Record<string, unknown>;
};

const synthesizeEmptyInventoryStack = (): DynamicStructValue => ({
  type: "InventoryStack",
  properties: {
    Item: {
      type: "StructProperty",
      name: "Item",
      propertyTagType: {
        name: "StructProperty",
        children: [{ name: "InventoryItem", children: [] }],
      },
      value: {
        itemReference: { levelName: "", pathName: "" },
        itemState: { hasValidStruct: false },
      },
    },
    NumItems: {
      type: "IntProperty",
      name: "NumItems",
      propertyTagType: { name: "IntProperty", children: [] },
      value: 0,
    },
  },
});

const isEmptyInventoryStack = (stack: unknown): boolean => {
  const s = stack as DynamicStructValue | undefined;
  if (!s || typeof s !== "object") return true;
  const props = s.properties ?? {};
  const numItemsProp = props["NumItems"] as IntProperty | undefined;
  if (numItemsProp && typeof numItemsProp.value === "number") {
    if (numItemsProp.value !== 0) return false;
  }
  const itemProp = props["Item"] as
    | { value?: { itemReference?: { pathName?: string } } }
    | undefined;
  const pathName = itemProp?.value?.itemReference?.pathName;
  return !pathName;
};

/**
 * Resize the `mInventoryStacks` array on an FGInventoryComponent SaveObject.
 *
 * Growth: append empty FInventoryStack entries.
 * Shrink: only allowed by lopping off TRAILING empty slots — refuse to drop
 *         a slot that contains items, since that would silently destroy the
 *         player's stuff.
 *
 * Also resizes the parallel `mArbitrarySlotSizes` array (per-slot stack cap)
 * when it's present, padding with 0 (game default behavior).
 */
const resizeInventoryComponent = (
  comp: SaveObject,
  newSize: number
): void => {
  const stacksProp = comp.properties?.["mInventoryStacks"] as
    | ArrayProperty
    | ArrayProperty[]
    | undefined;
  if (!stacksProp) {
    // No mInventoryStacks property on this component — not a standard
    // FGInventoryComponent layout. Bail rather than synthesize the array
    // ourselves; the structural assumptions get too fragile.
    return;
  }
  const stacks = Array.isArray(stacksProp) ? stacksProp[0] : stacksProp;
  const values = (stacks as { values?: unknown[] }).values;
  if (!Array.isArray(values)) return;

  if (newSize > values.length) {
    while (values.length < newSize) {
      values.push(synthesizeEmptyInventoryStack());
    }
  } else if (newSize < values.length) {
    // Walk back from the end, dropping empty trailing slots only.
    while (values.length > newSize) {
      const tail = values[values.length - 1];
      if (!isEmptyInventoryStack(tail)) break;
      values.pop();
    }
  }

  // Keep mArbitrarySlotSizes parallel-aligned when the array exists.
  const sizesProp = comp.properties?.["mArbitrarySlotSizes"] as
    | ArrayProperty
    | ArrayProperty[]
    | undefined;
  if (sizesProp) {
    const sizes = Array.isArray(sizesProp) ? sizesProp[0] : sizesProp;
    const sv = (sizes as { values?: number[] }).values;
    if (Array.isArray(sv)) {
      while (sv.length < values.length) sv.push(0);
      while (sv.length > values.length) sv.pop();
    }
  }
};

export function setInventorySlots(save: SatisfactorySave, slots: number): void {
  if (!Number.isInteger(slots) || slots < 1 || slots > MAX_INVENTORY_SLOTS) {
    throw new Error(
      `Invalid inventory slot count ${slots} (allowed 1..${MAX_INVENTORY_SLOTS}).`
    );
  }
  // 1) World-level master write. This is the source of truth; the game
  //    re-syncs per-player observed values from it on load.
  const unlock = findUnlockSubsystem(save);
  if (!unlock) {
    throw new Error(
      "Save has no BP_UnlockSubsystem_C; cannot set inventory slot count."
    );
  }
  writeIntProperty(unlock, "mNumTotalInventorySlots", slots, true);

  // 2) Per-player observed write — only update where the property already
  //    exists. Synthesize if missing so the player immediately sees the new
  //    count without waiting for a replication tick on first load.
  for (const ps of findPlayerStates(save)) {
    writeIntProperty(ps, "mNumObservedInventorySlots", slots, true);
  }

  // 3) Resize the actual player inventory bags. The unlock budget above is
  //    just bookkeeping — the in-game slot count is mInventoryStacks.Num()
  //    on the FGInventoryComponent, and the game does NOT auto-resize from
  //    the unlock value on load. Without this step the player loads in with
  //    exactly the bag size they had when the save was written.
  for (const pc of findPlayerInventoryComponents(save)) {
    if (pc.mainInventory) {
      resizeInventoryComponent(pc.mainInventory, slots);
    }
  }
}

export function setArmSlots(save: SatisfactorySave, slots: number): void {
  if (!Number.isInteger(slots) || slots < 1 || slots > MAX_ARM_SLOTS) {
    throw new Error(
      `Invalid hand slot count ${slots} (allowed 1..${MAX_ARM_SLOTS}).`
    );
  }
  const unlock = findUnlockSubsystem(save);
  if (!unlock) {
    throw new Error(
      "Save has no BP_UnlockSubsystem_C; cannot set hand slot count."
    );
  }
  writeIntProperty(unlock, "mNumTotalArmEquipmentSlots", slots, true);

  // BP_PlayerState_C carries no per-player hand-slot property in observed 1.2
  // saves, so we deliberately do not write to player states for arm slots.

  // Resize the hand-slot inventory component on each player's character.
  // Same reasoning as inventory: the unlock budget is bookkeeping; the slot
  // count the game uses is the array length on the arms-equipment component.
  for (const pc of findPlayerInventoryComponents(save)) {
    if (pc.armsInventory) {
      resizeInventoryComponent(pc.armsInventory, slots);
    }
  }
}
