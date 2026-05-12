/**
 * Inspect the research manager / unlock subsystem state in a save.
 * Handles arrays/structs better than naive `.value` access.
 *
 *   bun run scripts/dump-research.ts test/dune.sav
 */
import { readFileSync } from "node:fs";
import { parseSave } from "../src/lib/parser/load";

const path = process.argv[2] ?? "test/dune.sav";
const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const save = parseSave(path, ab);

const interesting = [
  "ResearchManager",
  "UnlockSubsystem",
  "SchematicManager",
];

const summarize = (prop: any): string => {
  if (Array.isArray(prop)) prop = prop[0];
  if (!prop) return "undefined";
  if (prop.type === "ArrayProperty") {
    const vals = prop.values ?? prop.value?.values ?? prop.value;
    if (Array.isArray(vals)) {
      const head = vals.slice(0, 4).map((v: any) => {
        if (v && typeof v === "object") {
          if ("pathName" in v) return v.pathName;
          return JSON.stringify(v).slice(0, 120);
        }
        return String(v);
      });
      return `Array(${vals.length}) [${head.join(", ")}${vals.length > 4 ? ", …" : ""}]`;
    }
    return `Array(?) ${JSON.stringify(prop).slice(0, 200)}`;
  }
  const v = prop.value;
  if (v && typeof v === "object") return JSON.stringify(v).slice(0, 240);
  return String(v);
};

for (const level of Object.values(save.levels)) {
  for (const obj of level.objects) {
    if (!interesting.some((kw) => obj.typePath.includes(kw))) continue;
    console.log("\n===", obj.typePath);
    console.log("instanceName:", obj.instanceName);
    const props = obj.properties ?? {};
    for (const [k, raw] of Object.entries(props)) {
      const r = raw as any;
      const t = Array.isArray(r) ? r[0]?.type : r?.type;
      console.log(`  ${k} <${t}>: ${summarize(r)}`);
    }
  }
}
