"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * App-wide user preferences. Persisted to localStorage so settings survive
 * reloads. Independent of the per-session save-edit store.
 */
export type PreferencesState = {
  /** Hide FICSMAS / limited-time-event content (items + schematics).
   *  Defaults to true — most users aren't playing during the event. */
  hideEventContent: boolean;
  setHideEventContent: (v: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      hideEventContent: true,
      setHideEventContent: (v) => set({ hideEventContent: v }),
    }),
    {
      name: "satisfactory-editor.prefs",
      version: 1,
    }
  )
);
