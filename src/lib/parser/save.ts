import { Parser } from "@etothepii/satisfactory-file-parser";
import type { SatisfactorySave } from "@/lib/parser/types";

/**
 * Serialize a parsed save back to a single Uint8Array (header + body chunks).
 */
export function serializeSave(save: SatisfactorySave): Uint8Array {
  let header: Uint8Array | null = null;
  const chunks: Uint8Array[] = [];

  Parser.WriteSave(
    save,
    (h) => {
      header = h;
    },
    (chunk) => {
      chunks.push(chunk);
    }
  );

  if (!header) throw new Error("Save serialization produced no header.");
  let total = (header as Uint8Array).byteLength;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  out.set(header as Uint8Array, offset);
  offset += (header as Uint8Array).byteLength;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
