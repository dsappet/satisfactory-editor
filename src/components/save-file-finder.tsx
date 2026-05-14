"use client";

/**
 * Helper UI that sits under the file picker. Non-technical players often
 * don't know where Satisfactory writes its `.sav` files — especially with
 * Proton (Steam Deck / Linux) hiding everything inside a fake Windows
 * drive. We can't open File Explorer for them from a browser, but we can
 * give them a path they can paste into the address bar.
 */

import * as React from "react";
import { Check, ChevronDown, Copy, FolderSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  detectOS,
  SAVE_LOCATIONS,
  type OS,
  type SaveLocation,
} from "@/lib/save-locations";
import { cn } from "@/lib/utils";

const TIPS: Record<OS, React.ReactNode> = {
  windows: (
    <>
      Press <Kbd>Win</Kbd> + <Kbd>E</Kbd> to open File Explorer, paste the
      path into the address bar, and press <Kbd>Enter</Kbd>. Your saves are
      inside the numbered subfolder (your FICSIT user id). Works the same
      for Steam, Epic, and Game Pass installs.
    </>
  ),
  linux: (
    <>
      Satisfactory runs through Proton, so saves live inside a virtual
      Windows drive. On Steam Deck switch to Desktop Mode, open the Files
      app, and paste the path. The numbered subfolder inside is yours.
    </>
  ),
  macos: (
    <>
      Satisfactory has no native macOS build, so the exact path depends on
      your translation layer (CrossOver, Whisky, Parallels…). The path
      below is the typical CrossOver bottle location — adjust the bottle
      name if yours differs. In Finder press <Kbd>Cmd</Kbd> +{" "}
      <Kbd>Shift</Kbd> + <Kbd>G</Kbd> to paste it.
    </>
  ),
};

// useSyncExternalStore lets us read `navigator.userAgent` after hydration
// without a setState-in-effect cascade. We never need to re-subscribe —
// the UA doesn't change — so the subscribe function is a no-op.
const noopSubscribe = () => () => {};
const getServerOS = (): OS => "windows";

export function SaveFileFinder() {
  const [open, setOpen] = React.useState(false);
  const detected = React.useSyncExternalStore(
    noopSubscribe,
    () => detectOS(navigator.userAgent),
    getServerOS
  );
  // User's explicit pick (if any) overrides the detected default.
  const [override, setOverride] = React.useState<OS | null>(null);
  const os = override ?? detected;

  const platform = SAVE_LOCATIONS[os];

  return (
    <div className="rounded-lg border bg-card text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-medium cursor-pointer"
      >
        <FolderSearch
          className="size-4 text-muted-foreground"
          aria-hidden
        />
        Can&apos;t find your save file? Show me where it lives.
        <ChevronDown
          className={cn(
            "ml-auto size-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t px-4 py-3 flex flex-col gap-3">
          <div role="tablist" aria-label="Operating system" className="flex flex-wrap gap-1.5">
            {(Object.values(SAVE_LOCATIONS) as SaveLocation[]).map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === os}
                onClick={() => setOverride(p.id)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-colors",
                  p.id === os
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <PathRow path={platform.path} />

          <p className="text-xs text-muted-foreground leading-relaxed">
            {TIPS[os]}
          </p>

          <p className="text-xs text-muted-foreground">
            Save files end in <code className="font-mono">.sav</code>. The
            file with the most recent timestamp is usually your latest
            auto-save.
          </p>
        </div>
      )}
    </div>
  );
}

function PathRow({ path }: { path: string }) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be blocked (e.g. http or restricted iframe);
      // user can still select and copy manually.
    }
  };

  return (
    <div className="flex items-stretch gap-2">
      <code
        className="flex-1 min-w-0 overflow-x-auto rounded-md border bg-muted px-3 py-2 text-xs font-mono whitespace-nowrap"
        aria-label="Save folder path"
      >
        {path}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCopy}
        className="shrink-0 gap-1.5"
        aria-label={copied ? "Path copied" : "Copy path to clipboard"}
      >
        {copied ? (
          <>
            <Check className="size-3.5" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" aria-hidden />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold">
      {children}
    </kbd>
  );
}
