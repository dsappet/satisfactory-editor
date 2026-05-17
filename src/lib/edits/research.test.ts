/**
 * Lock-down tests for the MAM research unlock edit. Validates the three
 * writes (purchased list, tree list, unlock subsystem) and undo behavior.
 *
 * These tests use real schematic class names from game-data.json — they
 * verify behavior against real data shape, not synthesized fixtures.
 */
import {
  getResearchState,
  setBulkSchematicUnlocked,
  setSchematicUnlocked,
} from "./research";
import {
  PLAYER_STATE_TYPE_PATH,
  UNLOCK_SUBSYSTEM_TYPE_PATH,
} from "./inventory";
import { gameData } from "@/lib/game-data";
import type { SatisfactorySave } from "@/lib/parser/types";

const SCHEMATIC_MANAGER_TYPE_PATH =
  "/Game/FactoryGame/Schematics/Progression/BP_SchematicManager.BP_SchematicManager_C";
const RESEARCH_MANAGER_TYPE_PATH =
  "/Game/FactoryGame/Recipes/Research/BP_ResearchManager.BP_ResearchManager_C";

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
  startingInv?: number;
  startingArm?: number;
  alreadyPurchased?: string[];
  alreadyUnlockedTrees?: string[];
}): SatisfactorySave => {
  const inv = opts.startingInv ?? 18;
  const arm = opts.startingArm ?? 1;
  const objects: any[] = [
    obj(
      SCHEMATIC_MANAGER_TYPE_PATH,
      "Persistent_Level:PersistentLevel.SchematicManager",
      opts.alreadyPurchased
        ? {
            mPurchasedSchematics: {
              type: "ArrayProperty",
              name: "mPurchasedSchematics",
              propertyTagType: {
                name: "ArrayProperty",
                children: [{ name: "ObjectProperty", children: [] }],
              },
              values: opts.alreadyPurchased.map((path) => ({
                levelName: "",
                pathName: path,
              })),
            },
          }
        : {}
    ),
    obj(
      RESEARCH_MANAGER_TYPE_PATH,
      "Persistent_Level:PersistentLevel.ResearchManager",
      opts.alreadyUnlockedTrees
        ? {
            mUnlockedResearchTrees: {
              type: "ArrayProperty",
              name: "mUnlockedResearchTrees",
              propertyTagType: {
                name: "ArrayProperty",
                children: [{ name: "ObjectProperty", children: [] }],
              },
              values: opts.alreadyUnlockedTrees.map((path) => ({
                levelName: "",
                pathName: path,
              })),
            },
          }
        : {}
    ),
    obj(
      UNLOCK_SUBSYSTEM_TYPE_PATH,
      "Persistent_Level:PersistentLevel.unlockSubsystem",
      {
        mNumTotalInventorySlots: intProp("mNumTotalInventorySlots", inv),
        mNumTotalArmEquipmentSlots: intProp("mNumTotalArmEquipmentSlots", arm),
      }
    ),
    obj(
      PLAYER_STATE_TYPE_PATH,
      "Persistent_Level:PersistentLevel.BP_PlayerState_C_1",
      {
        mNumObservedInventorySlots: intProp("mNumObservedInventorySlots", inv),
      }
    ),
  ];
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

const findObj = (save: SatisfactorySave, typePath: string) =>
  Object.values(save.levels)[0].objects.find((o) => o.typePath === typePath)!;

const readArr = (o: any, name: string): string[] => {
  const p = o.properties?.[name];
  if (!p) return [];
  const single = Array.isArray(p) ? p[0] : p;
  return ((single.values ?? []) as { pathName: string }[]).map((r) => r.pathName);
};

const readInt = (o: any, name: string): number | null => {
  const p = o.properties?.[name];
  if (!p) return null;
  const single = Array.isArray(p) ? p[0] : p;
  return typeof single.value === "number" ? single.value : null;
};

const readBool = (o: any, name: string): boolean | null => {
  const p = o.properties?.[name];
  if (!p) return null;
  return Boolean(p.value);
};

// Pick a real MAM schematic with a known slot effect.
const EXPANDED_TOOLBELT = "Research_Sulfur_5_C"; // +1 hand slot
const INFLATED_POCKET = "Research_Sulfur_6_C"; // +6 inventory slots

describe("setSchematicUnlocked", () => {
  test("apply: pushes into purchased, adds tree, increments slot counts, syncs player observed", () => {
    const save = makeSave({});
    const sch = gameData.schematics[INFLATED_POCKET];
    expect(sch).toBeDefined();
    expect(sch.unlocks.inventorySlots).toBe(6);

    setSchematicUnlocked(save, {
      className: INFLATED_POCKET,
      unlocked: true,
    });

    const schMgr = findObj(save, SCHEMATIC_MANAGER_TYPE_PATH);
    const resMgr = findObj(save, RESEARCH_MANAGER_TYPE_PATH);
    const unlock = findObj(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
    const ps = findObj(save, PLAYER_STATE_TYPE_PATH);

    expect(readArr(schMgr, "mPurchasedSchematics")).toContain(sch.pathName);
    expect(readArr(resMgr, "mUnlockedResearchTrees")).toContain(
      sch.researchTreePath!
    );
    expect(readInt(unlock, "mNumTotalInventorySlots")).toBe(18 + 6);
    expect(readInt(ps, "mNumObservedInventorySlots")).toBe(18 + 6);
  });

  test("undo: removes from purchased, decrements slot counts, removes tree only when last node in tree", () => {
    const save = makeSave({});
    // Unlock two MAMs in the SAME tree (Sulfur).
    setSchematicUnlocked(save, {
      className: INFLATED_POCKET,
      unlocked: true,
    });
    setSchematicUnlocked(save, {
      className: EXPANDED_TOOLBELT,
      unlocked: true,
    });
    const resMgr = findObj(save, RESEARCH_MANAGER_TYPE_PATH);
    const treePath = gameData.schematics[INFLATED_POCKET].researchTreePath!;
    expect(readArr(resMgr, "mUnlockedResearchTrees")).toContain(treePath);

    // Undo one — tree should remain because the other is still purchased.
    setSchematicUnlocked(save, {
      className: INFLATED_POCKET,
      unlocked: false,
    });
    expect(readArr(resMgr, "mUnlockedResearchTrees")).toContain(treePath);
    const unlock = findObj(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
    expect(readInt(unlock, "mNumTotalInventorySlots")).toBe(18);

    // Undo the second — tree should now be removed.
    setSchematicUnlocked(save, {
      className: EXPANDED_TOOLBELT,
      unlocked: false,
    });
    expect(readArr(resMgr, "mUnlockedResearchTrees")).not.toContain(treePath);
    expect(readInt(unlock, "mNumTotalArmEquipmentSlots")).toBe(1);
  });

  test("idempotent: applying an already-unlocked schematic is a no-op", () => {
    const save = makeSave({});
    setSchematicUnlocked(save, {
      className: INFLATED_POCKET,
      unlocked: true,
    });
    const unlock = findObj(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
    const before = readInt(unlock, "mNumTotalInventorySlots");
    setSchematicUnlocked(save, {
      className: INFLATED_POCKET,
      unlocked: true,
    });
    setSchematicUnlocked(save, {
      className: INFLATED_POCKET,
      unlocked: true,
    });
    expect(readInt(unlock, "mNumTotalInventorySlots")).toBe(before);
  });

  test("panel toggles flip on but never off — guard against multi-source unlocks", () => {
    // Find a MAM schematic that unlocks a panel.
    const panel = Object.values(gameData.schematics).find(
      (s) =>
        s.type === "EST_MAM" &&
        (s.unlocks.efficiencyPanel || s.unlocks.overclockPanel || s.unlocks.map)
    );
    if (!panel) return; // skip — depends on game-data content

    const save = makeSave({});
    setSchematicUnlocked(save, { className: panel.className, unlocked: true });
    const unlock = findObj(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
    const flag = panel.unlocks.efficiencyPanel
      ? "mIsBuildingEfficiencyUnlocked"
      : panel.unlocks.overclockPanel
        ? "mIsBuildingOverclockUnlocked"
        : "mIsMapUnlocked";
    expect(readBool(unlock, flag)).toBe(true);

    setSchematicUnlocked(save, {
      className: panel.className,
      unlocked: false,
    });
    // Undo MUST NOT flip the panel off.
    expect(readBool(unlock, flag)).toBe(true);
  });

  test("rejects schematic types that aren't editable", () => {
    const save = makeSave({});
    const tutorial = Object.values(gameData.schematics).find(
      (s) => s.type === "EST_Tutorial"
    )!;
    expect(() =>
      setSchematicUnlocked(save, {
        className: tutorial.className,
        unlocked: true,
      })
    ).toThrow(/not editable/);
  });

  test("accepts EST_ResourceSink (shop) schematics", () => {
    const save = makeSave({});
    const shopBuilding = Object.values(gameData.schematics).find(
      (s) =>
        s.type === "EST_ResourceSink" &&
        s.unlocks.recipes.length > 0 &&
        s.unlocks.schematics.length === 0
    );
    if (!shopBuilding) return;
    expect(() =>
      setSchematicUnlocked(save, {
        className: shopBuilding.className,
        unlocked: true,
      })
    ).not.toThrow();
    const schMgr = findObj(save, SCHEMATIC_MANAGER_TYPE_PATH);
    expect(readArr(schMgr, "mPurchasedSchematics")).toContain(
      shopBuilding.pathName
    );
  });

  test("shop bundle: nested EST_Custom children are added on apply", () => {
    const save = makeSave({});
    const bundle =
      gameData.schematics["ResourceSink_Customizer_Asphalt_FoundationMaterial_C"];
    expect(bundle).toBeDefined();
    expect(bundle.unlocks.schematics.length).toBeGreaterThan(0);

    setSchematicUnlocked(save, {
      className: bundle.className,
      unlocked: true,
    });

    const schMgr = findObj(save, SCHEMATIC_MANAGER_TYPE_PATH);
    const purchased = readArr(schMgr, "mPurchasedSchematics");
    expect(purchased).toContain(bundle.pathName);
    for (const childCls of bundle.unlocks.schematics) {
      const child = gameData.schematics[childCls];
      if (!child?.pathName) continue;
      expect(purchased).toContain(child.pathName);
    }
  });

  test("shop bundle undo: removes children NOT shared with another unlocked bundle", () => {
    const a =
      gameData.schematics["ResourceSink_Customizer_Asphalt_FoundationMaterial_C"];
    const b = gameData.schematics["ResourceSink_DiagonalRamps_C"];
    expect(a).toBeDefined();
    expect(b).toBeDefined();

    // Pick a child that BOTH bundles reference, and one only `a` references.
    const aChildren = new Set(a.unlocks.schematics);
    const bChildren = new Set(b.unlocks.schematics);
    const shared = [...aChildren].find((c) => bChildren.has(c));
    const onlyA = [...aChildren].find((c) => !bChildren.has(c));
    if (!shared || !onlyA) return;
    const sharedPath = gameData.schematics[shared].pathName;
    const onlyAPath = gameData.schematics[onlyA].pathName;

    const save = makeSave({});
    setSchematicUnlocked(save, { className: a.className, unlocked: true });
    setSchematicUnlocked(save, { className: b.className, unlocked: true });

    setSchematicUnlocked(save, { className: a.className, unlocked: false });

    const schMgr = findObj(save, SCHEMATIC_MANAGER_TYPE_PATH);
    const purchased = readArr(schMgr, "mPurchasedSchematics");
    expect(purchased).not.toContain(a.pathName);
    expect(purchased).toContain(b.pathName);
    expect(purchased).toContain(sharedPath);
    expect(purchased).not.toContain(onlyAPath);
  });

  test("accepts EST_Milestone schematics — no tree, same effect path as MAM", () => {
    // Schematic_1-3_C (Field Research) grants +10 inventory slots and the map.
    const save = makeSave({ startingInv: 18 });
    const ms = gameData.schematics["Schematic_1-3_C"];
    expect(ms).toBeDefined();
    expect(ms.type).toBe("EST_Milestone");

    setSchematicUnlocked(save, { className: ms.className, unlocked: true });

    const schMgr = findObj(save, SCHEMATIC_MANAGER_TYPE_PATH);
    const resMgr = findObj(save, RESEARCH_MANAGER_TYPE_PATH);
    const unlock = findObj(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
    expect(readArr(schMgr, "mPurchasedSchematics")).toContain(ms.pathName);
    // Milestones have no researchTreePath — the tree array should stay empty.
    expect(readArr(resMgr, "mUnlockedResearchTrees")).toHaveLength(0);
    expect(readInt(unlock, "mNumTotalInventorySlots")).toBe(
      18 + ms.unlocks.inventorySlots
    );
    if (ms.unlocks.map) expect(readBool(unlock, "mIsMapUnlocked")).toBe(true);

    // Undo path works.
    setSchematicUnlocked(save, { className: ms.className, unlocked: false });
    expect(readArr(schMgr, "mPurchasedSchematics")).not.toContain(ms.pathName);
    expect(readInt(unlock, "mNumTotalInventorySlots")).toBe(18);
  });

  test("accepts EST_Alternate schematics (hard-drive alts) and applies slot unlocks", () => {
    // Schematic_Alternate_InventorySlots1_C unlocks +6 inventory slots via
    // hard drive — same effect path as a MAM, no research tree involved.
    const save = makeSave({ startingInv: 18 });
    const alt = gameData.schematics["Schematic_Alternate_InventorySlots1_C"];
    expect(alt).toBeDefined();
    expect(alt.type).toBe("EST_Alternate");
    expect(() =>
      setSchematicUnlocked(save, {
        className: alt.className,
        unlocked: true,
      })
    ).not.toThrow();
    const unlock = findObj(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
    expect(readInt(unlock, "mNumTotalInventorySlots")).toBe(18 + alt.unlocks.inventorySlots);
  });
});

describe("setBulkSchematicUnlocked", () => {
  const allMamClasses = Object.values(gameData.schematics)
    .filter((s) => s.type === "EST_MAM")
    .map((s) => s.className);

  test("apply-all marks every MAM purchased; total inventory delta sums correctly", () => {
    const save = makeSave({ startingInv: 18, startingArm: 1 });
    setBulkSchematicUnlocked(save, true, allMamClasses);
    const state = getResearchState(save);
    // 7 MAM schematics wrap nested children via BP_UnlockSchematic_C (e.g.
    // Research_Sulfur_TurboFuel → Schematic_Alternate_TurboFuel) — those get
    // pulled into mPurchasedSchematics too, so the unique-class count is the
    // MAM total plus those nested children.
    for (const cn of allMamClasses) {
      expect(state.unlockedClassNames.has(cn)).toBe(true);
    }
    expect(state.unlockedClassNames.size).toBeGreaterThanOrEqual(
      allMamClasses.length
    );

    const allMam = allMamClasses.map((c) => gameData.schematics[c]);
    const expectedInv =
      18 + allMam.reduce((n, s) => n + s.unlocks.inventorySlots, 0);
    const expectedArm =
      1 + allMam.reduce((n, s) => n + s.unlocks.equipmentHandSlots, 0);
    const unlock = findObj(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
    expect(readInt(unlock, "mNumTotalInventorySlots")).toBe(expectedInv);
    expect(readInt(unlock, "mNumTotalArmEquipmentSlots")).toBe(expectedArm);
  });

  test("apply-all then unlock-none returns to vanilla counts", () => {
    const save = makeSave({ startingInv: 18, startingArm: 1 });
    setBulkSchematicUnlocked(save, true, allMamClasses);
    setBulkSchematicUnlocked(save, false, allMamClasses);
    const unlock = findObj(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
    expect(readInt(unlock, "mNumTotalInventorySlots")).toBe(18);
    expect(readInt(unlock, "mNumTotalArmEquipmentSlots")).toBe(1);
    expect(getResearchState(save).unlockedClassNames.size).toBe(0);
  });

  test("works for EST_Alternate schematics too", () => {
    const save = makeSave({ startingInv: 18 });
    setBulkSchematicUnlocked(save, true, [
      "Schematic_Alternate_InventorySlots1_C",
      "Schematic_Alternate_InventorySlots2_C",
    ]);
    const unlock = findObj(save, UNLOCK_SUBSYSTEM_TYPE_PATH);
    const expected =
      18 +
      gameData.schematics["Schematic_Alternate_InventorySlots1_C"].unlocks
        .inventorySlots +
      gameData.schematics["Schematic_Alternate_InventorySlots2_C"].unlocks
        .inventorySlots;
    expect(readInt(unlock, "mNumTotalInventorySlots")).toBe(expected);
  });
});
