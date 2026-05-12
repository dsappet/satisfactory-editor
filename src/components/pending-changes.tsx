"use client";

import { Download, X, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaveStore } from "@/store/save-store";

export function PendingChanges() {
  const staged = useSaveStore((s) => s.staged);
  const remove = useSaveStore((s) => s.removeStaged);
  const verifyAndDownload = useSaveStore((s) => s.verifyAndDownload);
  const verify = useSaveStore((s) => s.verify);
  const verification = useSaveStore((s) => s.verification);
  const summary = useSaveStore((s) => s.summary);

  if (!summary) return null;

  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm font-semibold">
          Pending edits: {staged.length}
        </div>
        <div className="grow flex flex-wrap gap-2">
          {staged.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs"
            >
              <span>{e.label}</span>
              {e.kind === "purity" && (
                <span className="text-muted-foreground">
                  ({e.nodesChanged} nodes
                  {e.worldSettingChanged ? ", world setting" : ""})
                </span>
              )}
              {(e.kind === "inventory" || e.kind === "armSlots") && (
                <span className="text-muted-foreground">
                  ({e.from} → {e.to})
                </span>
              )}
              {e.kind === "research" && (
                <span className="text-muted-foreground">
                  ({e.delta > 0 ? `+${e.delta}` : e.delta} net)
                </span>
              )}
              <button
                aria-label="Remove from list"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => remove(e.id)}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void verify()}
            disabled={verification.state === "running"}
          >
            {verification.state === "running" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Verifying…
              </>
            ) : (
              "Verify"
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => void verifyAndDownload()}
            disabled={verification.state === "running"}
          >
            <Download className="size-4" /> Download modified save
          </Button>
        </div>
      </div>
      {staged.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Removing a pending edit takes it out of this list, but the in-memory
          save still reflects it. To start over, click <strong>Close</strong> on the
          summary card and re-load the file.
        </p>
      )}
      {verification.state === "ok" && (
        <div className="mt-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="size-4" /> Round-trip verified — save body{" "}
          {(verification.bytes / 1024 / 1024).toFixed(1)} MB.
        </div>
      )}
      {verification.state === "mismatch" && (
        <div className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>{verification.message}</span>
        </div>
      )}
      {verification.state === "error" && (
        <div className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>{verification.message}</span>
        </div>
      )}
    </div>
  );
}
