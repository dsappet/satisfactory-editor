/**
 * Lock-down tests for the purity edit. The biggest risk for the project is
 * silently producing a save that *looks* edited but the game reverts on load
 * because the world-level toggle wasn't written. Every test here is designed
 * to fail loudly if either of the two writes is missing or hits the wrong
 * objects.
 */
import { applyPurity, getPurityState } from "./purity";
import {
  GAME_STATE_TYPE_PATH,
  PURITY_NODE_TYPE_PATHS,
  WORLD_PURITY_VALUES,
  NODE_PURITY_VALUES,
} from "@/lib/parser/types";
import type { SatisfactorySave } from "@/lib/parser/types";

// SaveCustomVersion.FixNewPlayerInfoHandleSerializationFormat = 58 → U1.2 floor.
// SaveCustomVersion.SerializePerStreamableLevelTOCVersion = 51 → U1.1 floor.
const SAVE_VERSION_1_2 = 58;
const SAVE_VERSION_1_1 = 51;

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

const makeSave = (saveVersion: number, options?: { withWorldSetting?: string }): SatisfactorySave => {
  const properties: any = {};
  if (options?.withWorldSetting !== undefined) {
    properties.mNodePuritySettings = {
      type: "EnumProperty",
      name: "mNodePuritySettings",
      propertyTagType: {
        name: "EnumProperty",
        children: [
          { name: "ENodePuritySettings", children: [] },
          { name: "ByteProperty", children: [] },
        ],
      },
      value: { name: "ENodePuritySettings", value: options.withWorldSetting },
    };
  }
  const gameState = obj(GAME_STATE_TYPE_PATH, "GameState_0", properties);

  const nodes = [
    // Touch these:
    obj(PURITY_NODE_TYPE_PATHS[0], "Node_Iron_1"),
    obj(PURITY_NODE_TYPE_PATHS[0], "Node_Copper_2"),
    obj(PURITY_NODE_TYPE_PATHS[1], "Sat_Oil_1"),
    // Do NOT touch these:
    obj(
      "/Game/FactoryGame/Resource/BP_FrackingCore.BP_FrackingCore_C",
      "Core_Oil_1"
    ),
    obj(
      "/Game/FactoryGame/Resource/BP_ResourceNodeGeyser.BP_ResourceNodeGeyser_C",
      "Geyser_1"
    ),
    obj(
      "/Game/FactoryGame/Resource/BP_ResourceDeposit.BP_ResourceDeposit_C",
      "Deposit_1"
    ),
  ];

  return {
    name: "test.sav",
    header: { saveVersion } as any,
    saveBodyValidation: {} as any,
    levels: {
      Persistent_Level: {
        name: "Persistent_Level",
        objects: [gameState, ...nodes],
        collectables: [],
        writesDestroyedActorsInTOCBlob: false,
      },
    },
  } as unknown as SatisfactorySave;
};

const findGameStatePurity = (save: SatisfactorySave) => {
  const lvl = Object.values(save.levels)[0];
  const gs = lvl.objects.find((o) => o.typePath === GAME_STATE_TYPE_PATH);
  if (!gs) return null;
  const prop: any = gs.properties?.["mNodePuritySettings"];
  if (!prop) return null;
  return Array.isArray(prop) ? prop[0]?.value?.value : prop.value?.value;
};

const findNodePurity = (save: SatisfactorySave, instanceName: string) => {
  const lvl = Object.values(save.levels)[0];
  const node = lvl.objects.find((o) => o.instanceName === instanceName);
  if (!node) return undefined;
  const prop: any = node.properties?.["mPurityOverride"];
  if (!prop) return null;
  return Array.isArray(prop) ? prop[0]?.value?.value : prop.value?.value;
};

describe("applyPurity (1.2 save)", () => {
  test("AllPure synthesizes mNodePuritySettings AND writes per-node — both must happen", () => {
    const save = makeSave(SAVE_VERSION_1_2);

    expect(findGameStatePurity(save)).toBeNull();
    expect(findNodePurity(save, "Node_Iron_1")).toBeNull();

    applyPurity(save, "AllPure");

    // (1) World-level: this is the write whose absence was the v1 bug.
    expect(findGameStatePurity(save)).toBe(WORLD_PURITY_VALUES.Pure);

    // (2) Per-node: every node of the right type was written.
    expect(findNodePurity(save, "Node_Iron_1")).toBe(NODE_PURITY_VALUES.Pure);
    expect(findNodePurity(save, "Node_Copper_2")).toBe(NODE_PURITY_VALUES.Pure);
    expect(findNodePurity(save, "Sat_Oil_1")).toBe(NODE_PURITY_VALUES.Pure);
  });

  test("AllPure does NOT touch FrackingCore / Geyser / ResourceDeposit — corruption guard", () => {
    const save = makeSave(SAVE_VERSION_1_2);
    applyPurity(save, "AllPure");

    // findNodePurity returns null when mPurityOverride is missing.
    expect(findNodePurity(save, "Core_Oil_1")).toBeNull();
    expect(findNodePurity(save, "Geyser_1")).toBeNull();
    expect(findNodePurity(save, "Deposit_1")).toBeNull();
  });

  test("AllImpure → world setting NPS_Decrease, per-node RP_Impure", () => {
    const save = makeSave(SAVE_VERSION_1_2, { withWorldSetting: WORLD_PURITY_VALUES.Default });
    applyPurity(save, "AllImpure");
    expect(findGameStatePurity(save)).toBe(WORLD_PURITY_VALUES.Impure);
    expect(findNodePurity(save, "Node_Iron_1")).toBe(NODE_PURITY_VALUES.Impure);
  });

  test("AllNormal → world setting NPS_Default, per-node RP_Normal", () => {
    const save = makeSave(SAVE_VERSION_1_2, { withWorldSetting: WORLD_PURITY_VALUES.Pure });
    applyPurity(save, "AllNormal");
    expect(findGameStatePurity(save)).toBe(WORLD_PURITY_VALUES.Default);
    expect(findNodePurity(save, "Node_Iron_1")).toBe(NODE_PURITY_VALUES.Normal);
  });

  test("RestoreDefault writes the world setting only, leaves per-node values alone", () => {
    const save = makeSave(SAVE_VERSION_1_2, { withWorldSetting: WORLD_PURITY_VALUES.Pure });
    // Pre-set a per-node override; RestoreDefault must NOT overwrite it.
    applyPurity(save, "AllPure");
    expect(findNodePurity(save, "Node_Iron_1")).toBe(NODE_PURITY_VALUES.Pure);

    applyPurity(save, "RestoreDefault");
    expect(findGameStatePurity(save)).toBe(WORLD_PURITY_VALUES.Default);
    // Per-node value is intentionally preserved.
    expect(findNodePurity(save, "Node_Iron_1")).toBe(NODE_PURITY_VALUES.Pure);
  });

  test("Existing mNodePuritySettings is updated in place, not duplicated", () => {
    const save = makeSave(SAVE_VERSION_1_2, { withWorldSetting: WORLD_PURITY_VALUES.Default });
    applyPurity(save, "AllPure");
    const gs = Object.values(save.levels)[0].objects.find(
      (o) => o.typePath === GAME_STATE_TYPE_PATH
    )!;
    expect(gs.properties["mNodePuritySettings"]).toBeDefined();
    // Should still be a single property, not an array.
    expect(Array.isArray(gs.properties["mNodePuritySettings"])).toBe(false);
    expect(findGameStatePurity(save)).toBe(WORLD_PURITY_VALUES.Pure);
  });
});

describe("applyPurity (pre-1.2 save)", () => {
  test("does NOT synthesize mNodePuritySettings on 1.1 saves — spec anti-goal", () => {
    const save = makeSave(SAVE_VERSION_1_1);
    applyPurity(save, "AllPure");

    // World-level write must be skipped on pre-1.2.
    expect(findGameStatePurity(save)).toBeNull();
    // Per-node values still get written.
    expect(findNodePurity(save, "Node_Iron_1")).toBe(NODE_PURITY_VALUES.Pure);
  });
});

describe("getPurityState", () => {
  test("counts before/after correctly and reports version compatibility", () => {
    const save = makeSave(SAVE_VERSION_1_2);

    const before = getPurityState(save);
    expect(before.supportsWorldSetting).toBe(true);
    expect(before.worldSetting).toBeNull();
    expect(before.totalNodes).toBe(3);
    expect(before.perType[PURITY_NODE_TYPE_PATHS[0]].total).toBe(2);
    expect(before.perType[PURITY_NODE_TYPE_PATHS[1]].total).toBe(1);
    expect(before.perType[PURITY_NODE_TYPE_PATHS[0]].Unset).toBe(2);

    applyPurity(save, "AllPure");

    const after = getPurityState(save);
    expect(after.worldSetting).toBe(WORLD_PURITY_VALUES.Pure);
    expect(after.perType[PURITY_NODE_TYPE_PATHS[0]].Pure).toBe(2);
    expect(after.perType[PURITY_NODE_TYPE_PATHS[0]].Unset).toBe(0);
    expect(after.perType[PURITY_NODE_TYPE_PATHS[1]].Pure).toBe(1);
  });

  test("pre-1.2 save reports supportsWorldSetting=false", () => {
    const save = makeSave(SAVE_VERSION_1_1);
    const state = getPurityState(save);
    expect(state.supportsWorldSetting).toBe(false);
  });
});
