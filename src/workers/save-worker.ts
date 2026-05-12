/// <reference lib="webworker" />
/**
 * Save worker.
 *
 * Approach: the parsed SatisfactorySave is kept in worker memory. The main
 * thread receives only lightweight summaries and calls into the worker via
 * Comlink RPC for queries and edits. We never structured-clone the parsed
 * tree — it's class-instance heavy and many MB.
 *
 * Tradeoff: every read/edit is an async round-trip. For the kinds of edits
 * this app does (one bulk write, a few queries) that's negligible compared to
 * the ~500ms-5s parse time. The win is no main-thread freeze and no
 * 50–500 MB clone over postMessage.
 */
import * as Comlink from "comlink";
import { parseSave } from "@/lib/parser/load";
import { serializeSave } from "@/lib/parser/save";
import type { SatisfactorySave } from "@/lib/parser/types";
import {
  applyPurity,
  getPurityState,
  previewPurity,
  type PurityPreview,
  type PurityState,
} from "@/lib/edits/purity";
import {
  getSlotsState,
  setInventorySlots as applyInventorySlots,
  setArmSlots as applyArmSlots,
  type SlotsState,
} from "@/lib/edits/inventory";
import {
  getResearchState as readResearchState,
  setSchematicUnlocked as applySchematicUnlocked,
  setBulkSchematicUnlocked as applyBulkSchematicUnlocked,
} from "@/lib/edits/research";
import type { PurityTarget } from "@/lib/parser/types";

export type ResearchSnapshot = {
  ready: boolean;
  /** Class names of MAM schematics currently in mPurchasedSchematics. */
  unlockedClassNames: string[];
};

const snapshotResearch = (save: SatisfactorySave): ResearchSnapshot => {
  const s = readResearchState(save);
  return {
    ready: s.ready,
    unlockedClassNames: [...s.unlockedClassNames],
  };
};

export type SaveSummary = {
  name: string;
  saveVersion: number;
  buildVersion: number;
  sessionName: string;
  saveName: string | null;
  saveDateTime: string;
  playDurationSeconds: number;
  mapName: string;
  isModded: boolean;
  creativeMode: boolean;
};

export type LoadResult = {
  summary: SaveSummary;
  purity: PurityState;
  slots: SlotsState;
  research: ResearchSnapshot;
};

let current: SatisfactorySave | null = null;
let originalFileName = "save";

const requireSave = (): SatisfactorySave => {
  if (!current) throw new Error("No save loaded.");
  return current;
};

const summarize = (save: SatisfactorySave, name: string): SaveSummary => ({
  name,
  saveVersion: save.header.saveVersion,
  buildVersion: save.header.buildVersion,
  sessionName: save.header.sessionName,
  saveName: save.header.saveName ?? null,
  saveDateTime: save.header.saveDateTime,
  playDurationSeconds: save.header.playDurationSeconds,
  mapName: save.header.mapName,
  isModded: !!save.header.isModdedSave && save.header.isModdedSave !== 0,
  creativeMode: !!save.header.creativeModeEnabled,
});

const api = {
  async load(
    bytes: ArrayBuffer,
    fileName: string,
    onProgress?: (progress: number, msg?: string) => void
  ): Promise<LoadResult> {
    originalFileName = fileName;
    const save = parseSave(
      fileName,
      bytes,
      onProgress ? (p, m) => onProgress(p, m) : undefined
    );
    current = save;
    return {
      summary: summarize(save, fileName),
      purity: getPurityState(save),
      slots: getSlotsState(save),
      research: snapshotResearch(save),
    };
  },

  async getSummary(): Promise<SaveSummary> {
    return summarize(requireSave(), originalFileName);
  },

  async getPurity(): Promise<PurityState> {
    return getPurityState(requireSave());
  },

  async previewPurity(target: PurityTarget): Promise<PurityPreview> {
    return previewPurity(requireSave(), target);
  },

  async applyPurity(target: PurityTarget): Promise<PurityState> {
    applyPurity(requireSave(), target);
    return getPurityState(requireSave());
  },

  async getSlots(): Promise<SlotsState> {
    return getSlotsState(requireSave());
  },

  async setInventorySlots(slots: number): Promise<SlotsState> {
    applyInventorySlots(requireSave(), slots);
    return getSlotsState(requireSave());
  },

  async setArmSlots(slots: number): Promise<SlotsState> {
    applyArmSlots(requireSave(), slots);
    return getSlotsState(requireSave());
  },

  async getResearch(): Promise<ResearchSnapshot> {
    return snapshotResearch(requireSave());
  },

  async setSchematicUnlocked(args: {
    className: string;
    unlocked: boolean;
  }): Promise<{ research: ResearchSnapshot; slots: SlotsState }> {
    const save = requireSave();
    applySchematicUnlocked(save, args);
    return { research: snapshotResearch(save), slots: getSlotsState(save) };
  },

  async setBulkSchematicUnlocked(
    unlocked: boolean,
    classNames: string[]
  ): Promise<{ research: ResearchSnapshot; slots: SlotsState }> {
    const save = requireSave();
    applyBulkSchematicUnlocked(save, unlocked, classNames);
    return { research: snapshotResearch(save), slots: getSlotsState(save) };
  },

  /**
   * Re-serialize the in-memory save, then re-parse the result and return the
   * resulting purity state. Used to verify edits actually round-trip cleanly
   * before the user downloads. If the returned state disagrees with the
   * intended state, the UI should warn loudly.
   */
  async verifyRoundTrip(): Promise<{
    purity: PurityState;
    slots: SlotsState;
    research: ResearchSnapshot;
    bytes: number;
  }> {
    const save = requireSave();
    const out = serializeSave(save);
    const reparsed = parseSave(originalFileName, out.buffer);
    return {
      purity: getPurityState(reparsed),
      slots: getSlotsState(reparsed),
      research: snapshotResearch(reparsed),
      bytes: out.byteLength,
    };
  },

  async serialize(): Promise<{ buffer: ArrayBuffer; suggestedName: string }> {
    const save = requireSave();
    const out = serializeSave(save);
    const dot = originalFileName.lastIndexOf(".");
    const base = dot === -1 ? originalFileName : originalFileName.slice(0, dot);
    const suggested = `${base}.edited.sav`;
    // Copy into a fresh ArrayBuffer so the returned type is a true ArrayBuffer
    // (Uint8Array.buffer is ArrayBufferLike, which may include SharedArrayBuffer).
    const buffer = new ArrayBuffer(out.byteLength);
    new Uint8Array(buffer).set(out);
    // Transfer ownership of the buffer back to the main thread.
    return Comlink.transfer({ buffer, suggestedName: suggested }, [buffer]);
  },

  async reset(): Promise<void> {
    current = null;
  },
};

export type SaveWorkerApi = typeof api;

Comlink.expose(api);
