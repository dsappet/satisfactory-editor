/**
 * Resource node purity edit.
 *
 * GOTCHA — and the reason this file has its own integration test:
 * purity is stored in TWO places, and the game re-applies the world setting
 * on load. Setting only the per-node values without the world-level toggle
 * does nothing — the game silently reverts the edit. Both writes are required
 * on 1.2 saves. The per-node write alone is insufficient.
 *
 *   1. World-level toggle on BP_GameState_C.mNodePuritySettings
 *      (EnumProperty of type ENodePuritySettings). NEW IN 1.2 — do not
 *      synthesize on pre-1.2 saves.
 *   2. Per-node mPurityOverride (ByteProperty / EResourcePurity) on every
 *      object whose typePath is BP_ResourceNode_C or BP_FrackingSatellite_C.
 *      Do NOT touch BP_FrackingCore, BP_ResourceNodeGeyser, BP_ResourceDeposit.
 */
import { SaveReader } from "@etothepii/satisfactory-file-parser";
import type {
  SatisfactorySave,
  SaveObject,
  EnumProperty,
  ByteProperty,
  PurityTarget,
  WorldPurity,
  NodePurity,
} from "@/lib/parser/types";
import {
  GAME_STATE_TYPE_PATH,
  PURITY_NODE_TYPE_PATHS,
  WORLD_PURITY_VALUES,
  NODE_PURITY_VALUES,
} from "@/lib/parser/types";

export type NodePurityCounts = {
  Pure: number;
  Normal: number;
  Impure: number;
  Unset: number;
  total: number;
};

export type PerTypeCounts = Record<string, NodePurityCounts>;

export type PurityState = {
  /** Save's reported version (header.saveVersion). */
  saveVersion: number;
  /** True if the save's version supports the world-level mNodePuritySettings. */
  supportsWorldSetting: boolean;
  /** Current world-level setting, or null if missing/unsupported. */
  worldSetting: WorldPurity | null;
  perType: PerTypeCounts;
  totalNodes: number;
};

export type PurityPreview = {
  before: PurityState;
  after: PurityState;
  worldSettingWillChange: boolean;
  nodesThatWillChange: number;
};

const supportsWorldPurity = (saveVersion: number): boolean =>
  SaveReader.IsGameVersionAtLeast_U1_2(saveVersion);

const isPurityNode = (obj: SaveObject): boolean =>
  (PURITY_NODE_TYPE_PATHS as readonly string[]).includes(obj.typePath);

const allObjects = (save: SatisfactorySave): SaveObject[] => {
  const out: SaveObject[] = [];
  for (const level of Object.values(save.levels)) {
    for (const obj of level.objects) out.push(obj);
  }
  return out;
};

const findGameState = (save: SatisfactorySave): SaveObject | undefined =>
  allObjects(save).find((o) => o.typePath === GAME_STATE_TYPE_PATH);

const emptyCounts = (): NodePurityCounts => ({
  Pure: 0,
  Normal: 0,
  Impure: 0,
  Unset: 0,
  total: 0,
});

const readNodePurity = (obj: SaveObject): NodePurity | null => {
  // The parser may give us a property under the name 'mPurityOverride' as
  // ByteProperty whose value is { type: 'EResourcePurity', value: 'EResourcePurity::RP_Pure' }
  const prop = obj.properties?.["mPurityOverride"] as
    | ByteProperty
    | ByteProperty[]
    | undefined;
  if (!prop) return null;
  const single = Array.isArray(prop) ? prop[0] : prop;
  const v = single?.value?.value;
  if (typeof v === "string") return v as NodePurity;
  return null;
};

export function getPurityState(save: SatisfactorySave): PurityState {
  const saveVersion = save.header?.saveVersion ?? 0;
  const supportsWorldSetting = supportsWorldPurity(saveVersion);

  const gs = findGameState(save);
  let worldSetting: WorldPurity | null = null;
  if (gs) {
    const prop = gs.properties?.["mNodePuritySettings"] as
      | EnumProperty
      | EnumProperty[]
      | undefined;
    if (prop) {
      const single = Array.isArray(prop) ? prop[0] : prop;
      const v = single?.value?.value;
      if (typeof v === "string") worldSetting = v as WorldPurity;
    }
  }

  const perType: PerTypeCounts = {};
  for (const tp of PURITY_NODE_TYPE_PATHS) perType[tp] = emptyCounts();

  let totalNodes = 0;
  for (const obj of allObjects(save)) {
    if (!isPurityNode(obj)) continue;
    totalNodes += 1;
    const counts = perType[obj.typePath];
    counts.total += 1;
    const purity = readNodePurity(obj);
    if (purity === NODE_PURITY_VALUES.Pure) counts.Pure += 1;
    else if (purity === NODE_PURITY_VALUES.Normal) counts.Normal += 1;
    else if (purity === NODE_PURITY_VALUES.Impure) counts.Impure += 1;
    else counts.Unset += 1;
  }

  return { saveVersion, supportsWorldSetting, worldSetting, perType, totalNodes };
}

const targetToWorld = (target: PurityTarget): WorldPurity => {
  switch (target) {
    case "AllPure":
      return WORLD_PURITY_VALUES.Pure;
    case "AllImpure":
      return WORLD_PURITY_VALUES.Impure;
    case "AllNormal":
    case "RestoreDefault":
      return WORLD_PURITY_VALUES.Default;
  }
};

const targetToNode = (target: PurityTarget): NodePurity | null => {
  switch (target) {
    case "AllPure":
      return NODE_PURITY_VALUES.Pure;
    case "AllNormal":
      return NODE_PURITY_VALUES.Normal;
    case "AllImpure":
      return NODE_PURITY_VALUES.Impure;
    case "RestoreDefault":
      // Don't touch per-node values; let the world-level setting control it.
      return null;
  }
};

const synthesizeWorldPurityProperty = (value: WorldPurity): EnumProperty => ({
  type: "EnumProperty",
  name: "mNodePuritySettings",
  propertyTagType: {
    name: "EnumProperty",
    children: [
      {
        name: "ENodePuritySettings",
        children: [{ name: "/Script/FactoryGame", children: [] }],
      },
      { name: "ByteProperty", children: [] },
    ],
  },
  value: { name: "ENodePuritySettings", value },
});

const synthesizeNodePurityProperty = (value: NodePurity): ByteProperty => ({
  type: "ByteProperty",
  name: "mPurityOverride",
  propertyTagType: {
    name: "ByteProperty",
    children: [{ name: "EResourcePurity", children: [] }],
  },
  value: { type: "EResourcePurity", value },
});

export function previewPurity(
  save: SatisfactorySave,
  target: PurityTarget
): PurityPreview {
  const before = getPurityState(save);
  const desiredWorld = targetToWorld(target);
  const desiredNode = targetToNode(target);

  const worldSettingWillChange =
    before.supportsWorldSetting && before.worldSetting !== desiredWorld;

  let nodesThatWillChange = 0;
  if (desiredNode !== null) {
    for (const obj of allObjects(save)) {
      if (!isPurityNode(obj)) continue;
      if (readNodePurity(obj) !== desiredNode) nodesThatWillChange += 1;
    }
  }

  // Compute the after-state without mutating: build perType counts as if we'd applied.
  const after: PurityState = {
    ...before,
    worldSetting: before.supportsWorldSetting
      ? desiredWorld
      : before.worldSetting,
    perType: {},
  };
  for (const tp of PURITY_NODE_TYPE_PATHS) {
    const cur = before.perType[tp];
    if (desiredNode === NODE_PURITY_VALUES.Pure) {
      after.perType[tp] = { ...emptyCounts(), Pure: cur.total, total: cur.total };
    } else if (desiredNode === NODE_PURITY_VALUES.Normal) {
      after.perType[tp] = {
        ...emptyCounts(),
        Normal: cur.total,
        total: cur.total,
      };
    } else if (desiredNode === NODE_PURITY_VALUES.Impure) {
      after.perType[tp] = {
        ...emptyCounts(),
        Impure: cur.total,
        total: cur.total,
      };
    } else {
      after.perType[tp] = { ...cur };
    }
  }

  return { before, after, worldSettingWillChange, nodesThatWillChange };
}

export function applyPurity(save: SatisfactorySave, target: PurityTarget): void {
  const desiredWorld = targetToWorld(target);
  const desiredNode = targetToNode(target);
  const supportsWorld = supportsWorldPurity(save.header?.saveVersion ?? 0);

  // 1) World-level write — only on 1.2+ saves.
  if (supportsWorld) {
    const gs = findGameState(save);
    if (!gs) {
      // Should never happen on a real save but bail loudly rather than silently.
      throw new Error(
        "Save has no BP_GameState_C object; cannot set world-level purity."
      );
    }
    const existing = gs.properties?.["mNodePuritySettings"] as
      | EnumProperty
      | EnumProperty[]
      | undefined;
    if (existing) {
      const single = Array.isArray(existing) ? existing[0] : existing;
      single.value = { ...single.value, value: desiredWorld };
    } else {
      gs.properties = gs.properties ?? {};
      gs.properties["mNodePuritySettings"] = synthesizeWorldPurityProperty(
        desiredWorld
      );
    }
  }

  // 2) Per-node writes — every node of the two known type paths.
  if (desiredNode !== null) {
    for (const obj of allObjects(save)) {
      if (!isPurityNode(obj)) continue;
      const existing = obj.properties?.["mPurityOverride"] as
        | ByteProperty
        | ByteProperty[]
        | undefined;
      if (existing) {
        const single = Array.isArray(existing) ? existing[0] : existing;
        single.value = {
          type: single.value?.type ?? "EResourcePurity",
          value: desiredNode,
        };
      } else {
        obj.properties = obj.properties ?? {};
        obj.properties["mPurityOverride"] =
          synthesizeNodePurityProperty(desiredNode);
      }
    }
  }
  // RestoreDefault deliberately does not clear per-node values — the world-level
  // Default setting tells the game to use vanilla, and per-node overrides remain
  // as a tiebreaker the player set deliberately. Matches the spec.
}
