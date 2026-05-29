/**
 * End-to-end round-trip check for the item-spawn edit against a REAL save.
 * Parses the save, spawns a couple of items into a crate at the first player's
 * location, serializes, re-parses, and confirms the new crate + its inventory
 * survive the round-trip with their items intact.
 *
 *   bun run scripts/test-crate-roundtrip.ts test/dune.sav
 *
 * NOTE: a clean parser round-trip is necessary but NOT sufficient — only
 * loading the resulting .sav in Satisfactory confirms the crate actually
 * appears in-world. Use this to catch serialization breakage early, then test
 * the downloaded save in-game on a throwaway copy. If the crate doesn't appear,
 * dump it from a real dismantle-crate save and reconcile CRATE_TYPE_PATH /
 * CRATE_INVENTORY_COMPONENT_NAME in src/lib/edits/spawn-items.ts.
 */
import { readFileSync } from "node:fs";
import { parseSave } from "../src/lib/parser/load";
import { serializeSave } from "../src/lib/parser/save";
import {
  listSpawnTargets,
  spawnItemsInCrates,
  CRATE_TYPE_PATH,
  INVENTORY_COMPONENT_TYPE_PATH,
} from "../src/lib/edits/spawn-items";
import { gameData, itemPath, stackSizeLimit } from "../src/lib/game-data";

const path = process.argv[2] ?? "test/dune.sav";
const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const save = parseSave(path, ab);

const targets = listSpawnTargets(save);
console.log("spawn targets:", targets);
const target = targets.find((t) => t.hasLocation);
if (!target) {
  console.error("No player with a location found — can't test crate spawn.");
  process.exit(1);
}

// Pick two real items that have known paths in the bundled data.
const picks = ["Desc_IronPlate_C", "Desc_Cable_C", "Desc_IronIngot_C"]
  .filter((cn) => itemPath(cn))
  .slice(0, 2);
if (picks.length === 0) {
  console.error(
    "No item paths in game-data.json — run `bun run build:docs` first."
  );
  process.exit(1);
}
const items = picks.map((cn) => ({
  pathName: itemPath(cn)!,
  count: 250,
  stackSize: stackSizeLimit(cn) ?? 100,
  label: gameData.items[cn]?.name ?? cn,
}));

const result = spawnItemsInCrates(save, {
  playerInstanceName: target.instanceName,
  items,
});
console.log("spawn result:", result);

const countCrates = (s: ReturnType<typeof parseSave>) => {
  let crates = 0;
  let comps = 0;
  for (const lvl of Object.values(s.levels)) {
    for (const o of lvl.objects) {
      if (o.typePath === CRATE_TYPE_PATH) crates += 1;
      if (
        o.typePath === INVENTORY_COMPONENT_TYPE_PATH &&
        o.instanceName.includes("BP_Crate_C_")
      )
        comps += 1;
    }
  }
  return { crates, comps };
};

console.log("BEFORE round-trip:", countCrates(save));

const out = serializeSave(save);
const reparsed = parseSave(path, out.buffer);
const after = countCrates(reparsed);
console.log("AFTER round-trip: ", after);

if (after.crates === result.crateCount && after.comps === result.crateCount) {
  console.log(
    `OK — ${after.crates} crate(s) + ${after.comps} inventory component(s) survived serialize → parse.`
  );
} else {
  console.error("MISMATCH — crates did not round-trip cleanly.");
  process.exit(1);
}
