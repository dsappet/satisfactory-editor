/**
 * Strongly-typed re-exports of the bits of `@etothepii/satisfactory-file-parser`
 * we touch. The parser's own types are loose (PropertiesMap is `{ [name]: any }`)
 * — we keep the casts isolated in the edit modules and surface clean types here.
 */
export type {
  SatisfactorySave,
  SatisfactorySaveHeader,
  Level,
  Levels,
  SaveEntity,
  SaveComponent,
  SaveObject,
  EnumProperty,
  ByteProperty,
  IntProperty,
  ObjectProperty,
  ArrayProperty,
  ObjectReference,
} from "@etothepii/satisfactory-file-parser";

/**
 * Resource node typePaths that carry `mPurityOverride`. Nothing else should be
 * touched — `BP_FrackingCore`, `BP_ResourceNodeGeyser`, `BP_ResourceDeposit`
 * have no purity field and editing them risks corruption.
 */
export const PURITY_NODE_TYPE_PATHS = [
  "/Game/FactoryGame/Resource/BP_ResourceNode.BP_ResourceNode_C",
  "/Game/FactoryGame/Resource/BP_FrackingSatellite.BP_FrackingSatellite_C",
] as const;

export type PurityNodeTypePath = (typeof PURITY_NODE_TYPE_PATHS)[number];

export const GAME_STATE_TYPE_PATH =
  "/Game/FactoryGame/-Shared/Blueprint/BP_GameState.BP_GameState_C";

export type WorldPurity =
  | "ENodePuritySettings::NPS_Default"
  | "ENodePuritySettings::NPS_Increase"
  | "ENodePuritySettings::NPS_Decrease";

export type NodePurity =
  | "EResourcePurity::RP_Pure"
  | "EResourcePurity::RP_Normal"
  | "EResourcePurity::RP_Impure";

export const WORLD_PURITY_VALUES = {
  Default: "ENodePuritySettings::NPS_Default",
  Pure: "ENodePuritySettings::NPS_Increase",
  Impure: "ENodePuritySettings::NPS_Decrease",
} as const satisfies Record<string, WorldPurity>;

export const NODE_PURITY_VALUES = {
  Pure: "EResourcePurity::RP_Pure",
  Normal: "EResourcePurity::RP_Normal",
  Impure: "EResourcePurity::RP_Impure",
} as const satisfies Record<string, NodePurity>;

export type PurityTarget = "AllPure" | "AllNormal" | "AllImpure" | "RestoreDefault";
