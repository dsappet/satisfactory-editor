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
  CHAR_PLAYER_TYPE_PATH,
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

const objRefProp = (name: string, pathName: string) => ({
  type: "ObjectProperty",
  name,
  propertyTagType: { name: "ObjectProperty", children: [] },
  value: { levelName: "", pathName },
});

const emptyStack = () => ({
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

const itemStack = (itemPath: string, count: number) => ({
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
        itemReference: { levelName: "", pathName: itemPath },
        itemState: { hasValidStruct: false },
      },
    },
    NumItems: {
      type: "IntProperty",
      name: "NumItems",
      propertyTagType: { name: "IntProperty", children: [] },
      value: count,
    },
  },
});

const stackArrayProp = (values: ReturnType<typeof emptyStack>[]) => ({
  type: "ArrayProperty",
  name: "mInventoryStacks",
  propertyTagType: {
    name: "ArrayProperty",
    children: [
      {
        name: "StructProperty",
        children: [{ name: "InventoryStack", children: [] }],
      },
    ],
  },
  values,
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

type PlayerSpec = {
  instanceName: string;
  observedInv?: number | null;
  /** When set, builds Char_Player_C + inventory components linked from the PS. */
  character?: {
    instanceName: string;
    /** Items per inventory slot. Length determines the bag size. */
    mainStacks?: Array<ReturnType<typeof emptyStack>>;
    /** Items per arm slot. Length determines the hand-slot count. */
    armsStacks?: Array<ReturnType<typeof emptyStack>>;
    /** When set, attaches mArbitrarySlotSizes parallel array to mainInventory. */
    arbitrarySlotSizes?: number[];
  };
};

const makeSave = (opts: {
  unlock?: { inv?: number; arm?: number } | null;
  players?: PlayerSpec[];
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
    const psProps: any = {};
    if (p.observedInv !== undefined && p.observedInv !== null) {
      psProps.mNumObservedInventorySlots = intProp(
        "mNumObservedInventorySlots",
        p.observedInv
      );
    }
    if (p.character) {
      psProps.mOwnedPawn = objRefProp("mOwnedPawn", p.character.instanceName);

      const mainInvPath = `${p.character.instanceName}.inventory`;
      const armsPath = `${p.character.instanceName}.armsEquipment`;

      const charProps: any = {
        mInventory: objRefProp("mInventory", mainInvPath),
        mArmsEquipmentSlot: objRefProp("mArmsEquipmentSlot", armsPath),
      };
      objects.push(
        obj(CHAR_PLAYER_TYPE_PATH, p.character.instanceName, charProps)
      );

      const mainProps: any = {
        mInventoryStacks: stackArrayProp(p.character.mainStacks ?? []),
      };
      if (p.character.arbitrarySlotSizes) {
        mainProps.mArbitrarySlotSizes = {
          type: "ArrayProperty",
          name: "mArbitrarySlotSizes",
          propertyTagType: {
            name: "ArrayProperty",
            children: [{ name: "IntProperty", children: [] }],
          },
          values: [...p.character.arbitrarySlotSizes],
        };
      }
      objects.push(obj("FGInventoryComponent", mainInvPath, mainProps));

      objects.push(
        obj("FGInventoryComponent", armsPath, {
          mInventoryStacks: stackArrayProp(p.character.armsStacks ?? []),
        })
      );
    }
    objects.push(obj(PLAYER_STATE_TYPE_PATH, p.instanceName, psProps));
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

const readStacks = (save: SatisfactorySave, instanceName: string): any[] => {
  const lvl = Object.values(save.levels)[0];
  const o = lvl.objects.find((x) => x.instanceName === instanceName);
  if (!o) throw new Error(`No object ${instanceName}`);
  const prop: any = o.properties?.["mInventoryStacks"];
  const single = Array.isArray(prop) ? prop[0] : prop;
  return single.values;
};

const readSlotSizes = (
  save: SatisfactorySave,
  instanceName: string
): number[] | undefined => {
  const lvl = Object.values(save.levels)[0];
  const o = lvl.objects.find((x) => x.instanceName === instanceName);
  if (!o) return undefined;
  const prop: any = o.properties?.["mArbitrarySlotSizes"];
  if (!prop) return undefined;
  const single = Array.isArray(prop) ? prop[0] : prop;
  return single.values;
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

// These tests cover the actual bag-resize step. The unlock-budget value on
// BP_UnlockSubsystem_C is bookkeeping — the in-game inventory size is the
// length of mInventoryStacks on the player's FGInventoryComponent, and the
// game does NOT auto-resize the bag from the unlock count on load. Without
// these writes, the player loads in with their original 18 slots even when
// the unlock budget says 50.
describe("setInventorySlots — resizes the actual player bag", () => {
  test("grows mInventoryStacks on the player's main inventory component", () => {
    const save = makeSave({
      unlock: { inv: 18 },
      players: [
        {
          instanceName: "PS_1",
          observedInv: 18,
          character: {
            instanceName: "Char_1",
            mainStacks: new Array(18).fill(0).map(() => emptyStack()),
            armsStacks: new Array(1).fill(0).map(() => emptyStack()),
          },
        },
      ],
    });
    setInventorySlots(save, 50);
    expect(readStacks(save, "Char_1.inventory")).toHaveLength(50);
    // Arms inventory must NOT be touched by an inventory edit.
    expect(readStacks(save, "Char_1.armsEquipment")).toHaveLength(1);
  });

  test("preserves existing items when growing the bag", () => {
    const items = [
      itemStack(
        "/Game/FactoryGame/Resource/RawResources/OreIron/Desc_OreIron.Desc_OreIron_C",
        50
      ),
      itemStack(
        "/Game/FactoryGame/Resource/Parts/Cable/Desc_Cable.Desc_Cable_C",
        7
      ),
      emptyStack(),
    ];
    const save = makeSave({
      unlock: { inv: 18 },
      players: [
        {
          instanceName: "PS_1",
          observedInv: 18,
          character: { instanceName: "Char_1", mainStacks: items },
        },
      ],
    });
    setInventorySlots(save, 30);
    const stacks = readStacks(save, "Char_1.inventory");
    expect(stacks).toHaveLength(30);
    // First two slots keep their items, untouched.
    expect(stacks[0].properties.NumItems.value).toBe(50);
    expect(stacks[1].properties.NumItems.value).toBe(7);
    // Trailing slots are the newly-padded empties.
    expect(stacks[29].properties.NumItems.value).toBe(0);
  });

  test("shrinking only drops trailing EMPTY slots — refuses to destroy items", () => {
    const stacks = [
      itemStack(
        "/Game/FactoryGame/Resource/Parts/Cable/Desc_Cable.Desc_Cable_C",
        1
      ),
      emptyStack(),
      itemStack(
        "/Game/FactoryGame/Resource/Parts/Wire/Desc_Wire.Desc_Wire_C",
        2
      ),
      emptyStack(),
      emptyStack(),
    ];
    const save = makeSave({
      unlock: { inv: 5 },
      players: [
        {
          instanceName: "PS_1",
          observedInv: 5,
          character: { instanceName: "Char_1", mainStacks: stacks },
        },
      ],
    });
    // Asks for 2 slots, but slot index 2 holds Wire. We're allowed to drop
    // the two trailing empties (down to 3) but NOT the Wire stack.
    setInventorySlots(save, 2);
    const out = readStacks(save, "Char_1.inventory");
    expect(out).toHaveLength(3);
    expect(out[0].properties.NumItems.value).toBe(1); // Cable kept
    expect(out[2].properties.NumItems.value).toBe(2); // Wire kept
  });

  test("keeps mArbitrarySlotSizes parallel to mInventoryStacks when present", () => {
    const save = makeSave({
      unlock: { inv: 4 },
      players: [
        {
          instanceName: "PS_1",
          observedInv: 4,
          character: {
            instanceName: "Char_1",
            mainStacks: new Array(4).fill(0).map(() => emptyStack()),
            arbitrarySlotSizes: [100, 100, 100, 100],
          },
        },
      ],
    });
    setInventorySlots(save, 7);
    expect(readSlotSizes(save, "Char_1.inventory")).toEqual([
      100, 100, 100, 100, 0, 0, 0,
    ]);
  });

  test("is a no-op on inventory components when no character is linked", () => {
    // E.g., a player who hasn't been in this session — only PlayerState exists.
    const save = makeSave({
      unlock: { inv: 18 },
      players: [{ instanceName: "PS_1", observedInv: 18 }],
    });
    expect(() => setInventorySlots(save, 30)).not.toThrow();
    expect(readUnlockProp(save, "mNumTotalInventorySlots")).toBe(30);
    expect(readPlayerProp(save, "PS_1", "mNumObservedInventorySlots")).toBe(30);
  });
});

describe("setArmSlots — resizes the actual hand-slot component", () => {
  test("grows mInventoryStacks on the player's arms-equipment component", () => {
    const save = makeSave({
      unlock: { arm: 1 },
      players: [
        {
          instanceName: "PS_1",
          observedInv: 18,
          character: {
            instanceName: "Char_1",
            mainStacks: new Array(18).fill(0).map(() => emptyStack()),
            armsStacks: [emptyStack()],
          },
        },
      ],
    });
    setArmSlots(save, 4);
    expect(readStacks(save, "Char_1.armsEquipment")).toHaveLength(4);
    // Main inventory must NOT be touched by an arm-slot edit.
    expect(readStacks(save, "Char_1.inventory")).toHaveLength(18);
  });

  test("preserves equipped tools when growing the hand slots", () => {
    const equipped = [
      itemStack(
        "/Game/FactoryGame/Equipment/Chainsaw/BP_EquipmentDescriptorChainsaw.BP_EquipmentDescriptorChainsaw_C",
        1
      ),
    ];
    const save = makeSave({
      unlock: { arm: 1 },
      players: [
        {
          instanceName: "PS_1",
          character: { instanceName: "Char_1", armsStacks: equipped },
        },
      ],
    });
    setArmSlots(save, 6);
    const stacks = readStacks(save, "Char_1.armsEquipment");
    expect(stacks).toHaveLength(6);
    expect(stacks[0].properties.NumItems.value).toBe(1);
    expect(stacks[5].properties.NumItems.value).toBe(0);
  });
});
