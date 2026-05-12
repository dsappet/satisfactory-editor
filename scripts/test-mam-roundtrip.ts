/**
 * End-to-end smoke test: unlock a MAM in a real save, serialize, re-parse,
 * confirm the state survives the round trip.
 *
 *   bun run scripts/test-mam-roundtrip.ts test/dune.sav
 */
import { readFileSync } from "node:fs";
import { parseSave } from "../src/lib/parser/load";
import { serializeSave } from "../src/lib/parser/save";
import { setSchematicUnlocked, getResearchState } from "../src/lib/edits/research";
import { getSlotsState } from "../src/lib/edits/inventory";

const path = process.argv[2] ?? "test/dune.sav";
const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const save = parseSave(path, ab);

const TARGET = "Research_Sulfur_6_C"; // Inflated Pocket Dimension, +6 inv

console.log("BEFORE");
console.log("  slots:", getSlotsState(save));
console.log("  Sulfur_6 unlocked:", getResearchState(save).unlockedClassNames.has(TARGET));

setSchematicUnlocked(save, { className: TARGET, unlocked: true });

console.log("\nAFTER (in-memory)");
console.log("  slots:", getSlotsState(save));
console.log("  Sulfur_6 unlocked:", getResearchState(save).unlockedClassNames.has(TARGET));

const out = serializeSave(save);
const reparsed = parseSave(path, out.buffer);

console.log("\nAFTER round-trip");
console.log("  slots:", getSlotsState(reparsed));
console.log("  Sulfur_6 unlocked:", getResearchState(reparsed).unlockedClassNames.has(TARGET));
console.log("  bytes:", out.byteLength);
