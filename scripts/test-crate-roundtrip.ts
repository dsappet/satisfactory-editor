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

// Use literal full item paths so the script works without a regenerated
// game-data.json (these are stable 1.x item descriptor paths).
const items = [
  {
    pathName:
      "/Game/FactoryGame/Resource/Parts/IronPlate/Desc_IronPlate.Desc_IronPlate_C",
    count: 250,
    stackSize: 200,
    label: "Iron Plate",
  },
  {
    pathName:
      "/Game/FactoryGame/Resource/Parts/Cable/Desc_Cable.Desc_Cable_C",
    count: 75,
    stackSize: 100,
    label: "Cable",
  },
];

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

const before = countCrates(save);
const result = spawnItemsInCrates(save, {
  playerInstanceName: target.instanceName,
  items,
});
console.log("spawn result:", result);
const afterSpawn = countCrates(save);
console.log("crates before spawn:", before, "after spawn:", afterSpawn);

const out = serializeSave(save);
const reparsed = parseSave(path, out.buffer);
const afterRT = countCrates(reparsed);
console.log("crates after round-trip:", afterRT);

// Find our exact spawned crate + its inventory in the re-parsed save and
// confirm the items came back intact.
const crateName = result.spawnedInstanceNames[0];
const compName = result.spawnedInstanceNames[1];
let foundCrate = false;
let stacks: Array<{ pathName: string; num: number }> = [];
for (const lvl of Object.values(reparsed.levels)) {
  for (const o of lvl.objects) {
    if (o.instanceName === crateName) foundCrate = true;
    if (o.instanceName === compName) {
      const arr = (o.properties as Record<string, unknown>)["mInventoryStacks"] as
        | { values?: unknown[] }
        | undefined;
      stacks = ((arr?.values ?? []) as Array<{
        properties: {
          Item: { value: { itemReference: { pathName: string } } };
          NumItems: { value: number };
        };
      }>).map((v) => ({
        pathName: v.properties.Item.value.itemReference.pathName,
        num: v.properties.NumItems.value,
      }));
    }
  }
}
console.log("our spawned crate survived:", foundCrate);
console.log("our crate's stacks after round-trip:", stacks);

const expectedTotal = items.reduce((a, it) => a + it.count, 0);
const gotTotal = stacks.reduce((a, s) => a + s.num, 0);
const ok =
  afterRT.crates === afterSpawn.crates &&
  afterRT.comps === afterSpawn.comps &&
  foundCrate &&
  gotTotal === expectedTotal;

if (ok) {
  console.log(
    `OK — spawned crate + ${stacks.length} stack(s) totalling ${gotTotal} items survived serialize → parse (counts ${afterSpawn.crates}→${afterRT.crates}).`
  );
} else {
  console.error(
    `MISMATCH — expected ${expectedTotal} items in the round-tripped crate, got ${gotTotal}.`
  );
  process.exit(1);
}
