/**
 * Player inventory slot count edit.
 *
 *   typePath: /Game/FactoryGame/Character/Player/BP_PlayerState.BP_PlayerState_C
 *   property: mNumObservedInventorySlots (IntProperty)
 *
 * Vanilla default is 18. Multiple BP_PlayerState_C entries exist in multiplayer.
 */
import type {
  SatisfactorySave,
  SaveObject,
  IntProperty,
} from "@/lib/parser/types";

export const PLAYER_STATE_TYPE_PATH =
  "/Game/FactoryGame/Character/Player/BP_PlayerState.BP_PlayerState_C";

export const VANILLA_INVENTORY_SLOTS = 18;
export const MAX_INVENTORY_SLOTS = 120;

export type PlayerInventoryInfo = {
  instanceName: string;
  /** Best-effort identifier: PlayerState's mCachedPlayerName (StrProperty) when present. */
  displayName: string;
  slots: number;
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

const readSlots = (obj: SaveObject): number | null => {
  const prop = obj.properties?.["mNumObservedInventorySlots"] as
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
    slots: readSlots(obj) ?? VANILLA_INVENTORY_SLOTS,
  }));
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

export function setInventorySlots(
  save: SatisfactorySave,
  args: { instanceName: string; slots: number }
): void {
  if (
    !Number.isInteger(args.slots) ||
    args.slots < 1 ||
    args.slots > MAX_INVENTORY_SLOTS
  ) {
    throw new Error(
      `Invalid slot count ${args.slots} (allowed 1..${MAX_INVENTORY_SLOTS}).`
    );
  }
  const obj = findPlayerStates(save).find(
    (o) => o.instanceName === args.instanceName
  );
  if (!obj) {
    throw new Error(`No BP_PlayerState_C with instanceName ${args.instanceName}`);
  }
  const existing = obj.properties?.["mNumObservedInventorySlots"] as
    | IntProperty
    | IntProperty[]
    | undefined;
  if (existing) {
    const single = Array.isArray(existing) ? existing[0] : existing;
    single.value = args.slots;
  } else {
    obj.properties = obj.properties ?? {};
    obj.properties["mNumObservedInventorySlots"] = synthesizeIntProperty(
      "mNumObservedInventorySlots",
      args.slots
    );
  }
}
