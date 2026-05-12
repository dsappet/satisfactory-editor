/**
 * Round-trip an alternate-recipe unlock through serialize + reparse on a
 * real save, to confirm the EST_Alternate code path works in production.
 *
 *   bun run scripts/test-alt-roundtrip.ts test/dune.sav
 */
import { readFileSync } from "node:fs";
import { parseSave } from "../src/lib/parser/load";
import { serializeSave } from "../src/lib/parser/save";
import {
  setSchematicUnlocked,
  getResearchState,
} from "../src/lib/edits/research";
import { getSlotsState } from "../src/lib/edits/inventory";

const path = process.argv[2] ?? "test/dune.sav";
const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const save = parseSave(path, ab);

// A reliable alt: Cast Screws unlocks Recipe_Alternate_Screw_C
const TARGET = "Schematic_Alternate_Screw_C";

console.log("BEFORE");
console.log("  alt unlocked:", getResearchState(save).unlockedClassNames.has(TARGET));

setSchematicUnlocked(save, { className: TARGET, unlocked: true });

console.log("\nAFTER (in-memory)");
console.log("  alt unlocked:", getResearchState(save).unlockedClassNames.has(TARGET));

const out = serializeSave(save);
const reparsed = parseSave(path, out.buffer);

console.log("\nAFTER round-trip");
console.log("  alt unlocked:", getResearchState(reparsed).unlockedClassNames.has(TARGET));
console.log("  slots:", getSlotsState(reparsed));
console.log("  bytes:", out.byteLength);

// Also try an inventory-slot alt (no recipe unlock)
const SLOT_ALT = "Schematic_Alternate_InventorySlots1_C";
const fresh = parseSave(path, ab);
const before = getSlotsState(fresh).inventorySlots;
setSchematicUnlocked(fresh, { className: SLOT_ALT, unlocked: true });
const after = getSlotsState(fresh).inventorySlots;
console.log("\nSlot-alt sanity:");
console.log("  before:", before, "after:", after, "delta:", after - before);
