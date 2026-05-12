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
 */
import type {
  SatisfactorySave,
  SaveObject,
  IntProperty,
} from "@/lib/parser/types";

export const PLAYER_STATE_TYPE_PATH =
  "/Game/FactoryGame/Character/Player/BP_PlayerState.BP_PlayerState_C";

export const UNLOCK_SUBSYSTEM_TYPE_PATH =
  "/Game/FactoryGame/Unlocks/BP_UnlockSubsystem.BP_UnlockSubsystem_C";

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
  // If a future save format adds one, update this comment and write here.
}
