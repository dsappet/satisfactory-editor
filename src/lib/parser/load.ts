import { Parser } from "@etothepii/satisfactory-file-parser";
import type { SatisfactorySave } from "@/lib/parser/types";

export type ParseProgress = (progress: number, msg?: string) => void;

// `throwErrors: false` is deliberate: per the parser's own docs, unknown
// properties (common when a new patch ships before we can rebuild) land in
// a `rawBytes` field instead of failing the whole parse. Structural errors
// — truncated header, corrupted body framing — still throw, and we surface
// those with a clearer message than the underlying parser's stack.
export function parseSave(
  name: string,
  bytes: ArrayBufferLike,
  onProgress?: ParseProgress
): SatisfactorySave {
  try {
    return Parser.ParseSave(name, bytes, {
      onProgressCallback: onProgress,
      throwErrors: false,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not parse save file. The file may be corrupt or from an ` +
        `unsupported version. Details: ${detail}`
    );
  }
}
