/**
 * Lock-down tests over the bundled game data. These pin item presence that the
 * build pipeline has historically gotten wrong, so a future `bun run build:docs`
 * regression can't silently drop them again.
 *
 * Somersloop (Desc_WAT1_C) and Power Shard (Desc_CrystalShard_C) live under the
 * FGPowerShardDescriptor native class. That class was missing from
 * scripts/build-docs.ts, so both items never made it into game-data.json and the
 * spawn tab couldn't offer them — while Mercer Sphere (Desc_WAT2_C, a plain
 * FGItemDescriptor) was present, which masked the gap.
 */
import { spawnableItems, itemPath, itemName } from "./game-data";

describe("game-data special alien / power items", () => {
  const SPAWNABLE = [
    {
      className: "Desc_WAT1_C",
      name: "Somersloop",
      pathName: "/Game/FactoryGame/Prototype/WAT/Desc_WAT1.Desc_WAT1_C",
    },
    {
      className: "Desc_WAT2_C",
      name: "Mercer Sphere",
      pathName: "/Game/FactoryGame/Prototype/WAT/Desc_WAT2.Desc_WAT2_C",
    },
    {
      className: "Desc_CrystalShard_C",
      name: "Power Shard",
      pathName:
        "/Game/FactoryGame/Resource/Environment/Crystal/Desc_CrystalShard.Desc_CrystalShard_C",
    },
  ];

  it.each(SPAWNABLE)(
    "$name ($className) is spawnable with the expected class path",
    ({ className, name, pathName }) => {
      expect(itemName(className)).toBe(name);
      expect(itemPath(className)).toBe(pathName);
      const spawnable = spawnableItems();
      expect(spawnable.some((it) => it.className === className)).toBe(true);
    }
  );
});
