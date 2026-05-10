"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaveStore } from "@/store/save-store";
import { formatBytes } from "@/lib/utils";

export function FilePicker() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const loadFromFile = useSaveStore((s) => s.loadFromFile);
  const loading = useSaveStore((s) => s.loading);
  const loadProgress = useSaveStore((s) => s.loadProgress);
  const loadMessage = useSaveStore((s) => s.loadMessage);
  const fileSize = useSaveStore((s) => s.fileSize);
  const errorMessage = useSaveStore((s) => s.errorMessage);

  const onFiles = React.useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.name.toLowerCase().endsWith(".sav")) {
        alert("Please select a .sav file.");
        return;
      }
      void loadFromFile(file);
    },
    [loadFromFile]
  );

  return (
    <div className="rounded-xl border-2 border-dashed p-8 text-center">
      <Upload className="mx-auto size-10 text-muted-foreground" aria-hidden />
      <h2 className="mt-4 font-semibold">Open a Satisfactory save</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Drag a <code>.sav</code> file anywhere on this page, or click below.
      </p>
      <div className="mt-4 flex items-center justify-center">
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Choose .sav file"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".sav"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      {loading && (
        <div className="mt-4 text-xs text-muted-foreground">
          <div className="h-1.5 w-full bg-muted rounded">
            <div
              className="h-full bg-primary rounded transition-[width] duration-150"
              style={{ width: `${Math.round(loadProgress * 100)}%` }}
            />
          </div>
          <div className="mt-2">
            {loadMessage || "Parsing…"}{" "}
            {fileSize > 0 && <span>({formatBytes(fileSize)})</span>}
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="mt-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
      {fileSize > 50 * 1024 * 1024 && !loading && (
        <div className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          Heads up: this save is larger than 50 MB. If your browser tab runs
          out of memory, try desktop Chrome with more RAM available.
        </div>
      )}
    </div>
  );
}

/**
 * Drag-drop overlay covering the whole page. Ignored when a save is already
 * loading.
 */
export function PageDropTarget({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState(false);
  const loadFromFile = useSaveStore((s) => s.loadFromFile);
  const loading = useSaveStore((s) => s.loading);

  const onDragOver = (e: React.DragEvent) => {
    if (loading) return;
    if (e.dataTransfer?.types.includes("Files")) {
      e.preventDefault();
      setActive(true);
    }
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (e.target === e.currentTarget) setActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setActive(false);
    if (loading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".sav")) {
      alert("Please drop a .sav file.");
      return;
    }
    void loadFromFile(file);
  };

  return (
    <div
      className="relative min-h-screen"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {active && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="rounded-2xl border-4 border-dashed border-primary px-12 py-10 text-2xl font-semibold">
            Drop your .sav file
          </div>
        </div>
      )}
    </div>
  );
}
