/**
 * Lock-down tests for the item-spawn edit. The crate is a from-scratch
 * SaveEntity + FGInventoryComponent pair; these tests pin the structure we
 * synthesize (typePaths, the inventory-stack shape, stack splitting, crate
 * chunking, idempotent re-staging) so a refactor can't silently change the
 * bytes we write. In-game binding of the crate is verified separately via
 * scripts/test-crate-roundtrip.ts against a real save.
 */
import {
  listSpawnTargets,
  spawnItemsInCrates,
  removeSpawnedObjects,
  CRATE_TYPE_PATH,
  INVENTORY_COMPONENT_TYPE_PATH,
  MAX_STACKS_PER_CRATE,
} from "./spawn-items";
import { PLAYER_STATE_TYPE_PATH, CHAR_PLAYER_TYPE_PATH } from "./inventory";
import type { SatisfactorySave, SaveObject } from "@/lib/parser/types";

const objRefProp = (name: string, pathName: string, levelName = "") => ({
  type: "ObjectProperty",
  name,
  propertyTagType: { name: "ObjectProperty", children: [] },
  value: { levelName, pathName },
});

const entity = (
  typePath: string,
  instanceName: string,
  properties: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
): SaveObject =>
  ({
    typePath,
    rootObject: "Persistent_Level:PersistentLevel",
    instanceName,
    parentEntityName: "",
    type: "SaveEntity",
    properties,
    specialProperties: { type: "EmptySpecialProperties" },
    trailingData: [],
    saveCustomVersion: 42,
    shouldMigrateObjectRefsToPersistent: false,
    needTransform: false,
    transform: {
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      translation: { x: 0, y: 0, z: 0 },
      scale3d: { x: 1, y: 1, z: 1 },
    },
    wasPlacedInLevel: false,
    parentObject: { levelName: "", pathName: "" },
    components: [],
    ...extra,
  }) as unknown as SaveObject;

const component = (
  typePath: string,
  instanceName: string,
  properties: Record<string, unknown> = {}
): SaveObject =>
  ({
    typePath,
    rootObject: "Persistent_Level:PersistentLevel",
    instanceName,
    parentEntityName: "",
    type: "SaveComponent",
    properties,
    specialProperties: { type: "EmptySpecialProperties" },
    trailingData: [],
    saveCustomVersion: 42,
    shouldMigrateObjectRefsToPersistent: false,
  }) as unknown as SaveObject;

const PS = "Persistent_Level:PersistentLevel.BP_PlayerState_C_1";
const CHAR = "Persistent_Level:PersistentLevel.Char_Player_C_1";
const INV = `${CHAR}.inventory`;

const makeSave = (opts?: {
  withCharacter?: boolean;
  withLocation?: boolean;
}): SatisfactorySave => {
  const withCharacter = opts?.withCharacter ?? true;
  const withLocation = opts?.withLocation ?? true;
  const objects: SaveObject[] = [];

  const psProps: Record<string, unknown> = {
    mCachedPlayerName: { type: "StrProperty", name: "mCachedPlayerName", value: "Pioneer" },
  };
  if (withCharacter) psProps.mOwnedPawn = objRefProp("mOwnedPawn", CHAR);
  objects.push(entity(PLAYER_STATE_TYPE_PATH, PS, psProps));

  if (withCharacter) {
    objects.push(
      entity(
        CHAR_PLAYER_TYPE_PATH,
        CHAR,
        { mInventory: objRefProp("mInventory", INV, "Persistent_Level") },
        withLocation
          ? {
              transform: {
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                translation: { x: 100, y: 200, z: 300 },
                scale3d: { x: 1, y: 1, z: 1 },
              },
            }
          : { transform: undefined }
      )
    );
    objects.push(component(INVENTORY_COMPONENT_TYPE_PATH, INV, {}));
  }

  return {
    name: "test.sav",
    header: { saveVersion: 58 } as unknown,
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

const crateObjects = (save: SatisfactorySave): SaveObject[] =>
  save.levels.Persistent_Level.objects.filter(
    (o) => o.typePath === CRATE_TYPE_PATH
  );

const componentObjects = (save: SatisfactorySave): SaveObject[] =>
  save.levels.Persistent_Level.objects.filter(
    (o) =>
      o.typePath === INVENTORY_COMPONENT_TYPE_PATH &&
      o.instanceName.includes("BP_Crate_C_")
  );

type StackStruct = {
  properties: {
    Item: { value: { itemReference: { pathName: string } } };
    NumItems: { value: number };
  };
};

const stacksOf = (comp: SaveObject): Array<{ pathName: string; num: number }> => {
  const prop = comp.properties?.["mInventoryStacks"] as
    | { values?: unknown[] }
    | undefined;
  const values = (prop?.values ?? []) as StackStruct[];
  return values.map((v) => ({
    pathName: v.properties.Item.value.itemReference.pathName,
    num: v.properties.NumItems.value,
  }));
};

const IRON = "/Game/FactoryGame/Resource/Parts/IronPlate/Desc_IronPlate.Desc_IronPlate_C";
const NUT = "/Game/FactoryGame/Resource/Parts/Nut/Desc_Nut.Desc_Nut_C";

describe("listSpawnTargets", () => {
  test("reports players and whether they have a location", () => {
    const targets = listSpawnTargets(makeSave());
    expect(targets).toHaveLength(1);
    expect(targets[0].instanceName).toBe(PS);
    expect(targets[0].displayName).toBe("Pioneer");
    expect(targets[0].hasLocation).toBe(true);
  });

  test("hasLocation is false when the player has no spawned character", () => {
    const targets = listSpawnTargets(makeSave({ withCharacter: false }));
    expect(targets[0].hasLocation).toBe(false);
  });

  test("hasLocation is false when the character has no transform", () => {
    const targets = listSpawnTargets(makeSave({ withLocation: false }));
    expect(targets[0].hasLocation).toBe(false);
  });
});

describe("spawnItemsInCrates", () => {
  test("creates a crate actor + inventory component pair at the player's location", () => {
    const save = makeSave();
    const result = spawnItemsInCrates(save, {
      playerInstanceName: PS,
      items: [{ pathName: IRON, count: 10, stackSize: 200 }],
    });

    expect(result.crateCount).toBe(1);
    expect(result.totalItems).toBe(10);
    expect(result.totalStacks).toBe(1);

    const crates = crateObjects(save);
    expect(crates).toHaveLength(1);
    const crate = crates[0];
    // Placed at the character's translation.
    const t = (crate as unknown as { transform: { translation: { x: number } } })
      .transform;
    expect(t.translation.x).toBe(100);
    // Tagged as a dismantle crate, like the real in-game crate.
    const crateType = crate.properties?.["mCrateType"] as {
      value: { value: string };
    };
    expect(crateType.value.value).toBe("EFGCrateType::CT_DismantleCrate");
    // Finds its inventory through the components list (no mInventory property).
    expect(crate.properties?.["mInventory"]).toBeUndefined();
    const comps = componentObjects(save);
    expect(comps).toHaveLength(1);
    const components = (
      crate as unknown as { components: Array<{ pathName: string }> }
    ).components;
    expect(components[0].pathName).toBe(comps[0].instanceName);
    expect(comps[0].instanceName.endsWith(".inventory")).toBe(true);
    // Component points back at the crate.
    expect(
      (comps[0] as unknown as { parentEntityName: string }).parentEntityName
    ).toBe(crate.instanceName);

    const stacks = stacksOf(comps[0]);
    expect(stacks).toEqual([{ pathName: IRON, num: 10 }]);
    // Parallel allow-list + size diff mirror a real crate.
    const allowed = comps[0].properties?.["mAllowedItemDescriptors"] as {
      values: unknown[];
    };
    expect(allowed.values).toHaveLength(1);
  });

  test("splits a count larger than the stack size into multiple stacks", () => {
    const save = makeSave();
    spawnItemsInCrates(save, {
      playerInstanceName: PS,
      items: [{ pathName: IRON, count: 450, stackSize: 200 }],
    });
    const stacks = stacksOf(componentObjects(save)[0]);
    expect(stacks.map((s) => s.num)).toEqual([200, 200, 50]);
    expect(stacks.every((s) => s.pathName === IRON)).toBe(true);
  });

  test("keeps mArbitrarySlotSizes parallel to the stacks", () => {
    const save = makeSave();
    spawnItemsInCrates(save, {
      playerInstanceName: PS,
      items: [{ pathName: IRON, count: 450, stackSize: 200 }],
    });
    const comp = componentObjects(save)[0];
    const sizes = comp.properties?.["mArbitrarySlotSizes"] as {
      values: number[];
    };
    expect(sizes.values).toEqual([0, 0, 0]);
  });

  test("packs several items into a single crate", () => {
    const save = makeSave();
    const result = spawnItemsInCrates(save, {
      playerInstanceName: PS,
      items: [
        { pathName: IRON, count: 5, stackSize: 200 },
        { pathName: NUT, count: 5, stackSize: 100 },
      ],
    });
    expect(result.crateCount).toBe(1);
    const stacks = stacksOf(componentObjects(save)[0]);
    expect(stacks).toEqual([
      { pathName: IRON, num: 5 },
      { pathName: NUT, num: 5 },
    ]);
  });

  test("spills into extra crates past the per-crate cap", () => {
    const save = makeSave();
    // stackSize 1 → one stack per item; ask for one more than fits in a crate.
    const count = MAX_STACKS_PER_CRATE + 1;
    const result = spawnItemsInCrates(save, {
      playerInstanceName: PS,
      items: [{ pathName: NUT, count, stackSize: 1 }],
    });
    expect(result.totalStacks).toBe(count);
    expect(result.crateCount).toBe(2);
    expect(crateObjects(save)).toHaveLength(2);
    const comps = componentObjects(save);
    expect(comps).toHaveLength(2);
    expect(stacksOf(comps[0])).toHaveLength(MAX_STACKS_PER_CRATE);
    expect(stacksOf(comps[1])).toHaveLength(1);
  });

  test("uses unique instanceNames not already present in the save", () => {
    const save = makeSave();
    const result = spawnItemsInCrates(save, {
      playerInstanceName: PS,
      items: [
        { pathName: IRON, count: 1, stackSize: 200 },
        { pathName: NUT, count: MAX_STACKS_PER_CRATE, stackSize: 1 },
      ],
    });
    const names = result.spawnedInstanceNames;
    expect(new Set(names).size).toBe(names.length);
  });

  test("re-staging removes the previous crates first (idempotent)", () => {
    const save = makeSave();
    const first = spawnItemsInCrates(save, {
      playerInstanceName: PS,
      items: [{ pathName: IRON, count: 10, stackSize: 200 }],
    });
    expect(crateObjects(save)).toHaveLength(1);

    const second = spawnItemsInCrates(save, {
      playerInstanceName: PS,
      items: [{ pathName: NUT, count: 5, stackSize: 100 }],
      removeInstanceNames: first.spawnedInstanceNames,
    });
    // Old crate gone, only the new one remains.
    expect(crateObjects(save)).toHaveLength(1);
    expect(componentObjects(save)).toHaveLength(1);
    expect(stacksOf(componentObjects(save)[0])).toEqual([
      { pathName: NUT, num: 5 },
    ]);
    expect(second.totalItems).toBe(5);
  });

  test("removeSpawnedObjects clears the crates entirely", () => {
    const save = makeSave();
    const r = spawnItemsInCrates(save, {
      playerInstanceName: PS,
      items: [{ pathName: IRON, count: 10, stackSize: 200 }],
    });
    removeSpawnedObjects(save, r.spawnedInstanceNames);
    expect(crateObjects(save)).toHaveLength(0);
    expect(componentObjects(save)).toHaveLength(0);
  });

  test("rejects an empty selection", () => {
    const save = makeSave();
    expect(() =>
      spawnItemsInCrates(save, { playerInstanceName: PS, items: [] })
    ).toThrow(/No items/);
  });

  test("rejects items without a class path", () => {
    const save = makeSave();
    expect(() =>
      spawnItemsInCrates(save, {
        playerInstanceName: PS,
        items: [{ pathName: "", count: 1, label: "Mystery" }],
      })
    ).toThrow(/build:docs/);
  });

  test("rejects invalid counts", () => {
    const save = makeSave();
    expect(() =>
      spawnItemsInCrates(save, {
        playerInstanceName: PS,
        items: [{ pathName: IRON, count: 0 }],
      })
    ).toThrow(/Invalid count/);
  });

  test("errors when the player has no spawned character", () => {
    const save = makeSave({ withCharacter: false });
    expect(() =>
      spawnItemsInCrates(save, {
        playerInstanceName: PS,
        items: [{ pathName: IRON, count: 1, stackSize: 200 }],
      })
    ).toThrow(/no spawned character/);
  });
});
