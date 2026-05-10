import { Parser } from "@etothepii/satisfactory-file-parser";
import type { SatisfactorySave } from "@/lib/parser/types";

export type ParseProgress = (progress: number, msg?: string) => void;

export function parseSave(
  name: string,
  bytes: ArrayBufferLike,
  onProgress?: ParseProgress
): SatisfactorySave {
  return Parser.ParseSave(name, bytes, {
    onProgressCallback: onProgress,
    throwErrors: false,
  });
}
