/**
 * Lock-down tests for the slot-count edits. Spec is empirically derived from a
 * 1.2 save: world-level master count on BP_UnlockSubsystem_C is the source of
 * truth; per-player BP_PlayerState_C carries an observed copy of the inventory
 * count only.
 */
import {
  getSlotsState,
  setArmSlots,
  setInventorySlots,
  PLAYER_STATE_TYPE_PATH,
  UNLOCK_SUBSYSTEM_TYPE_PATH,
  VANILLA_ARM_SLOTS,
  VANILLA_INVENTORY_SLOTS,
} from "./inventory";
import type { SatisfactorySave } from "@/lib/parser/types";

const intProp = (name: string, value: number) => ({
  type: "IntProperty",
  name,
  propertyTagType: { name: "IntProperty", children: [] },
  value,
});

const obj = (typePath: string, instanceName: string, properties: any = {}) => ({
  typePath,
  rootObject: "Persistent_Level:PersistentLevel",
  instanceName,
  parentEntityName: "",
  type: "SaveEntity" as const,
  properties,
  specialProperties: { type: "EmptySpecialProperties" } as any,
  trailingData: [],
  saveCustomVersion: 0,
  shouldMigrateObjectRefsToPersistent: false,
  needTransform: false,
  transform: {} as any,
  wasPlacedInLevel: false,
  parentObject: { levelName: "", pathName: "" },
  components: [],
});

const makeSave = (opts: {
  unlock?: { inv?: number; arm?: number } | null;
  players?: Array<{ instanceName: string; observedInv?: number | null }>;
}): SatisfactorySave => {
  const objects: any[] = [];
  if (opts.unlock !== null) {
    const props: any = {};
    if (opts.unlock?.inv !== undefined) {
      props.mNumTotalInventorySlots = intProp(
        "mNumTotalInventorySlots",
        opts.unlock.inv
      );
    }
    if (opts.unlock?.arm !== undefined) {
      props.mNumTotalArmEquipmentSlots = intProp(
        "mNumTotalArmEquipmentSlots",
        opts.unlock.arm
      );
    }
    objects.push(
      obj(
        UNLOCK_SUBSYSTEM_TYPE_PATH,
        "Persistent_Level:PersistentLevel.unlockSubsystem",
        props
      )
    );
  }
  for (const p of opts.players ?? []) {
    const props: any = {};
    if (p.observedInv !== undefined && p.observedInv !== null) {
      props.mNumObservedInventorySlots = intProp(
        "mNumObservedInventorySlots",
        p.observedInv
      );
    }
    objects.push(obj(PLAYER_STATE_TYPE_PATH, p.instanceName, props));
  }
  return {
    name: "test.sav",
    header: { saveVersion: 58 } as any,
    saveBodyValidation: {} as any,
    levels: {
      Persistent_Level: {
        name: "Persistent_Level",
        objects,
        collectables: [],
        writesDestroyedActorsInTOCBlob: false,
      },
    },
  } as unknown as SatisfactorySave;
};

const readUnlockProp = (save: SatisfactorySave, name: string) => {
  const lvl = Object.values(save.levels)[0];
  const u = lvl.objects.find((o) => o.typePath === UNLOCK_SUBSYSTEM_TYPE_PATH);
  if (!u) return undefined;
  const p: any = u.properties?.[name];
  if (!p) return null;
  return Array.isArray(p) ? p[0]?.value : p.value;
};

const readPlayerProp = (
  save: SatisfactorySave,
  instanceName: string,
  name: string
) => {
  const lvl = Object.values(save.levels)[0];
  const ps = lvl.objects.find((o) => o.instanceName === instanceName);
  if (!ps) return undefined;
  const p: any = ps.properties?.[name];
  if (!p) return null;
  return Array.isArray(p) ? p[0]?.value : p.value;
};

describe("getSlotsState", () => {
  test("reads master counts from unlockSubsystem", () => {
    const save = makeSave({
      unlock: { inv: 54, arm: 6 },
      players: [{ instanceName: "PS_1", observedInv: 54 }],
    });
    const s = getSlotsState(save);
    expect(s.hasUnlockSubsystem).toBe(true);
    expect(s.inventorySlots).toBe(54);
    expect(s.armSlots).toBe(6);
    expect(s.players).toHaveLength(1);
    expect(s.players[0].observedInventorySlots).toBe(54);
  });

  test("reports vanilla defaults when unlockSubsystem properties are missing", () => {
    const save = makeSave({ unlock: {}, players: [] });
    const s = getSlotsState(save);
    expect(s.hasUnlockSubsystem).toBe(true);
    expect(s.inventorySlots).toBe(VANILLA_INVENTORY_SLOTS);
    expect(s.armSlots).toBe(VANILLA_ARM_SLOTS);
  });

  test("falls back to player-observed when no unlockSubsystem exists", () => {
    const save = makeSave({
      unlock: null,
      players: [{ instanceName: "PS_1", observedInv: 42 }],
    });
    const s = getSlotsState(save);
    expect(s.hasUnlockSubsystem).toBe(false);
    expect(s.inventorySlots).toBe(42);
    expect(s.armSlots).toBe(VANILLA_ARM_SLOTS);
  });
});

describe("setInventorySlots", () => {
  test("writes master AND every per-player observed copy — both must happen", () => {
    const save = makeSave({
      unlock: { inv: 18 },
      players: [
        { instanceName: "PS_1", observedInv: 18 },
        { instanceName: "PS_2", observedInv: 18 },
      ],
    });
    setInventorySlots(save, 72);
    expect(readUnlockProp(save, "mNumTotalInventorySlots")).toBe(72);
    expect(readPlayerProp(save, "PS_1", "mNumObservedInventorySlots")).toBe(72);
    expect(readPlayerProp(save, "PS_2", "mNumObservedInventorySlots")).toBe(72);
  });

  test("synthesizes the observed property when missing on a player state", () => {
    const save = makeSave({
      unlock: { inv: 18 },
      players: [{ instanceName: "PS_New", observedInv: null }],
    });
    setInventorySlots(save, 30);
    expect(readPlayerProp(save, "PS_New", "mNumObservedInventorySlots")).toBe(30);
  });

  test("rejects out-of-range values without mutating", () => {
    const save = makeSave({ unlock: { inv: 18 } });
    expect(() => setInventorySlots(save, 0)).toThrow();
    expect(() => setInventorySlots(save, 9999)).toThrow();
    expect(readUnlockProp(save, "mNumTotalInventorySlots")).toBe(18);
  });

  test("errors out loudly when unlockSubsystem is missing — refuses to half-edit", () => {
    const save = makeSave({
      unlock: null,
      players: [{ instanceName: "PS_1", observedInv: 18 }],
    });
    expect(() => setInventorySlots(save, 30)).toThrow(/BP_UnlockSubsystem/);
  });
});

describe("setArmSlots", () => {
  test("writes the master count and does NOT synthesize anything on player states", () => {
    const save = makeSave({
      unlock: { arm: 1 },
      players: [{ instanceName: "PS_1", observedInv: 18 }],
    });
    setArmSlots(save, 4);
    expect(readUnlockProp(save, "mNumTotalArmEquipmentSlots")).toBe(4);
    // Player state must remain untouched re: arm slots.
    expect(readPlayerProp(save, "PS_1", "mNumArmSlots")).toBe(null);
    expect(
      readPlayerProp(save, "PS_1", "mNumTotalArmEquipmentSlots")
    ).toBe(null);
  });

  test("synthesizes the unlockSubsystem property when missing", () => {
    const save = makeSave({ unlock: {} });
    setArmSlots(save, 3);
    expect(readUnlockProp(save, "mNumTotalArmEquipmentSlots")).toBe(3);
  });

  test("rejects out-of-range values", () => {
    const save = makeSave({ unlock: { arm: 1 } });
    expect(() => setArmSlots(save, 0)).toThrow();
    expect(() => setArmSlots(save, 9999)).toThrow();
  });
});
