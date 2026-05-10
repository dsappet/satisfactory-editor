"use client";

import { create } from "zustand";
import { getSaveWorker } from "@/lib/worker-client";
import type {
  LoadResult,
  SaveSummary,
} from "@/workers/save-worker";
import type { PurityState } from "@/lib/edits/purity";
import type { PlayerInventoryInfo } from "@/lib/edits/inventory";
import type { PurityTarget } from "@/lib/parser/types";

export type StagedEditKind = "purity" | "inventory";

export type StagedEdit =
  | {
      id: string;
      kind: "purity";
      label: string;
      target: PurityTarget;
      nodesChanged: number;
      worldSettingChanged: boolean;
    }
  | {
      id: string;
      kind: "inventory";
      label: string;
      instanceName: string;
      displayName: string;
      from: number;
      to: number;
    };

export type DownloadVerification =
  | { state: "idle" }
  | { state: "running" }
  | {
      state: "ok";
      purity: PurityState;
      players: PlayerInventoryInfo[];
      bytes: number;
    }
  | {
      state: "mismatch";
      purity: PurityState;
      message: string;
    }
  | { state: "error"; message: string };

export interface SaveState {
  loading: boolean;
  loadProgress: number;
  loadMessage: string;
  fileSize: number;
  errorMessage: string | null;

  summary: SaveSummary | null;
  purity: PurityState | null;
  players: PlayerInventoryInfo[];
  staged: StagedEdit[];
  verification: DownloadVerification;

  loadFromFile: (file: File) => Promise<void>;
  reset: () => Promise<void>;

  stagePurity: (target: PurityTarget) => Promise<void>;
  stageInventory: (instanceName: string, slots: number) => Promise<void>;
  removeStaged: (id: string) => void;

  verifyAndDownload: () => Promise<void>;
  verify: () => Promise<void>;
}

const SIZE_WARN_BYTES = 50 * 1024 * 1024;

let nextId = 0;
const newId = () => `edit-${++nextId}`;

export const useSaveStore = create<SaveState>((set, get) => ({
  loading: false,
  loadProgress: 0,
  loadMessage: "",
  fileSize: 0,
  errorMessage: null,
  summary: null,
  purity: null,
  players: [],
  staged: [],
  verification: { state: "idle" },

  async loadFromFile(file: File) {
    set({
      loading: true,
      loadProgress: 0,
      loadMessage: "Reading file…",
      fileSize: file.size,
      errorMessage: null,
      summary: null,
      purity: null,
      players: [],
      staged: [],
      verification: { state: "idle" },
    });
    try {
      const { api, worker } = getSaveWorker();

      // Hook unhandled worker errors.
      const onError = (e: ErrorEvent) => {
        set({
          loading: false,
          errorMessage: `Worker error: ${e.message ?? "unknown"}`,
        });
      };
      worker.addEventListener("error", onError, { once: true });

      const buf = await file.arrayBuffer();
      const Comlink = await import("comlink");
      const proxyProgress = Comlink.proxy(
        (progress: number, msg?: string) => {
          set({ loadProgress: progress, loadMessage: msg ?? "" });
        }
      );
      const result: LoadResult = await api.load(
        Comlink.transfer(buf, [buf]),
        file.name,
        proxyProgress
      );
      worker.removeEventListener("error", onError);
      set({
        loading: false,
        loadProgress: 1,
        loadMessage: "",
        summary: result.summary,
        purity: result.purity,
        players: result.players,
      });
      if (file.size > SIZE_WARN_BYTES) {
        // Just log; UI can also surface the size.
        console.warn(
          `Loaded large save (${(file.size / 1024 / 1024).toFixed(1)} MB).`
        );
      }
    } catch (err) {
      set({
        loading: false,
        errorMessage:
          err instanceof Error
            ? err.message
            : "Failed to load save (unknown error).",
      });
    }
  },

  async reset() {
    const { api } = getSaveWorker();
    try {
      await api.reset();
    } catch {
      /* ignore */
    }
    set({
      summary: null,
      purity: null,
      players: [],
      staged: [],
      verification: { state: "idle" },
      errorMessage: null,
      fileSize: 0,
    });
  },

  async stagePurity(target) {
    const { api } = getSaveWorker();
    const preview = await api.previewPurity(target);
    await api.applyPurity(target);
    const newPurity = await api.getPurity();
    const labels: Record<PurityTarget, string> = {
      AllPure: "All resource nodes → Pure",
      AllNormal: "All resource nodes → Normal",
      AllImpure: "All resource nodes → Impure",
      RestoreDefault: "World purity setting → Default",
    };
    const edit: StagedEdit = {
      id: newId(),
      kind: "purity",
      label: labels[target],
      target,
      nodesChanged: preview.nodesThatWillChange,
      worldSettingChanged: preview.worldSettingWillChange,
    };
    // Replace any prior purity edit — purity is a single conceptual choice.
    set((s) => ({
      purity: newPurity,
      staged: [...s.staged.filter((e) => e.kind !== "purity"), edit],
      verification: { state: "idle" },
    }));
  },

  async stageInventory(instanceName, slots) {
    const { api } = getSaveWorker();
    const before = get().players.find((p) => p.instanceName === instanceName);
    if (!before) throw new Error(`No such player ${instanceName}`);
    const players = await api.setInventorySlots({ instanceName, slots });
    const edit: StagedEdit = {
      id: newId(),
      kind: "inventory",
      label: `${before.displayName}: ${before.slots} → ${slots} slots`,
      instanceName,
      displayName: before.displayName,
      from: before.slots,
      to: slots,
    };
    set((s) => ({
      players,
      staged: [
        ...s.staged.filter(
          (e) => !(e.kind === "inventory" && e.instanceName === instanceName)
        ),
        edit,
      ],
      verification: { state: "idle" },
    }));
  },

  removeStaged(id) {
    // We can't trivially "undo" an edit on the in-worker save tree — the parser
    // is mutate-in-place and we'd have to re-load the original file. For v1 we
    // remove it from the staged list and warn the user via the UI that the
    // applied state still reflects the edit until reload.
    set((s) => ({ staged: s.staged.filter((e) => e.id !== id) }));
  },

  async verify() {
    const { api } = getSaveWorker();
    set({ verification: { state: "running" } });
    try {
      const result = await api.verifyRoundTrip();
      const intended = get().purity;
      // If the user's intent is captured in the live in-memory state, the
      // round-tripped state must match it.
      const match =
        intended &&
        intended.worldSetting === result.purity.worldSetting &&
        Object.keys(intended.perType).every((tp) => {
          const a = intended.perType[tp];
          const b = result.purity.perType[tp];
          return (
            a.Pure === b.Pure &&
            a.Normal === b.Normal &&
            a.Impure === b.Impure &&
            a.Unset === b.Unset
          );
        });
      if (!match) {
        set({
          verification: {
            state: "mismatch",
            purity: result.purity,
            message:
              "Round-trip verification disagrees with the intended edit. Do not download — please report this with your save version.",
          },
        });
        return;
      }
      set({
        verification: {
          state: "ok",
          purity: result.purity,
          players: result.players,
          bytes: result.bytes,
        },
      });
    } catch (err) {
      set({
        verification: {
          state: "error",
          message:
            err instanceof Error
              ? err.message
              : "Verification failed (unknown error).",
        },
      });
    }
  },

  async verifyAndDownload() {
    await get().verify();
    const v = get().verification;
    if (v.state !== "ok") return;
    const { api } = getSaveWorker();
    const { buffer, suggestedName } = await api.serialize();
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },
}));
