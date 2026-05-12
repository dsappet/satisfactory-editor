/**
 * End-to-end smoke test of getSlotsState / setInventorySlots / setArmSlots
 * against a real save. Reads the save, applies edits, serializes, re-parses,
 * and prints both states for visual comparison.
 *
 *   bun run scripts/dump-slots.ts test/dune.sav
 */
import { readFileSync } from "node:fs";
import { parseSave } from "../src/lib/parser/load";
import { serializeSave } from "../src/lib/parser/save";
import {
  getSlotsState,
  setArmSlots,
  setInventorySlots,
} from "../src/lib/edits/inventory";

const path = process.argv[2] ?? "test/dune.sav";
const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const save = parseSave(path, ab);

console.log("BEFORE:", getSlotsState(save));

setInventorySlots(save, 96);
setArmSlots(save, 5);

console.log("AFTER (in-memory):", getSlotsState(save));

const out = serializeSave(save);
const reparsed = parseSave(path, out.buffer);
console.log("AFTER round-trip:", getSlotsState(reparsed));
