"use client";

import * as React from "react";
import {
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSaveStore } from "@/store/save-store";
import type { PurityTarget } from "@/lib/parser/types";
import {
  PURITY_NODE_TYPE_PATHS,
  WORLD_PURITY_VALUES,
} from "@/lib/parser/types";
import type { PurityState } from "@/lib/edits/purity";

const TARGET_LABELS: Record<PurityTarget, string> = {
  AllPure: "All Pure",
  AllNormal: "All Normal",
  AllImpure: "All Impure",
  RestoreDefault: "Restore Default",
};

const TARGET_DESC: Record<PurityTarget, string> = {
  AllPure:
    "Sets the world toggle to NPS_Increase and overrides every node to RP_Pure.",
  AllNormal:
    "Sets the world toggle to NPS_Default and overrides every node to RP_Normal.",
  AllImpure:
    "Sets the world toggle to NPS_Decrease and overrides every node to RP_Impure.",
  RestoreDefault:
    "Sets the world toggle to NPS_Default. Per-node overrides are left as-is — uncheck them in-game if needed.",
};

const NODE_TYPE_LABEL: Record<string, string> = {
  "/Game/FactoryGame/Resource/BP_ResourceNode.BP_ResourceNode_C":
    "Solid resource nodes (BP_ResourceNode_C)",
  "/Game/FactoryGame/Resource/BP_FrackingSatellite.BP_FrackingSatellite_C":
    "Resource well satellites (BP_FrackingSatellite_C)",
};

function inferCurrentTarget(p: PurityState): PurityTarget | null {
  // Heuristic: if every per-node count is fully Pure / Normal / Impure AND the
  // world setting matches, that's the current target.
  const counts = Object.values(p.perType);
  const everyPure = counts.every((c) => c.Pure === c.total && c.total > 0);
  const everyNormal = counts.every((c) => c.Normal === c.total && c.total > 0);
  const everyImpure = counts.every((c) => c.Impure === c.total && c.total > 0);
  if (
    everyPure &&
    (!p.supportsWorldSetting || p.worldSetting === WORLD_PURITY_VALUES.Pure)
  )
    return "AllPure";
  if (
    everyNormal &&
    (!p.supportsWorldSetting || p.worldSetting === WORLD_PURITY_VALUES.Default)
  )
    return "AllNormal";
  if (
    everyImpure &&
    (!p.supportsWorldSetting || p.worldSetting === WORLD_PURITY_VALUES.Impure)
  )
    return "AllImpure";
  return null;
}

export function PurityTab() {
  const purity = useSaveStore((s) => s.purity);
  const stagePurity = useSaveStore((s) => s.stagePurity);

  // User-chosen target overrides the inferred-from-current-state default. Null
  // means "use whatever matches the current save state". Stays null after edits
  // are applied so the radio reflects the new current state automatically.
  const [override, setOverride] = React.useState<PurityTarget | null>(null);

  const target: PurityTarget = purity
    ? (override ?? inferCurrentTarget(purity) ?? "AllPure")
    : "AllPure";
  const setTarget = (v: PurityTarget) => setOverride(v);

  // We need a "what would happen if..." preview without committing. The store
  // mutates the worker's state, so for preview-only counts we recompute from
  // the live purity snapshot using the same pure helpers (no worker round-trip).
  // This means the preview count reflects the *current* (already-applied)
  // state, which is correct because the user can see the staged edit and the
  // before/after histogram below.
  const livePreview = React.useMemo(() => {
    if (!purity) return { nodesThatWillChange: 0, worldSettingWillChange: false };
    // We don't have the SatisfactorySave on main thread; recompute counts directly.
    let willChange = 0;
    for (const tp of PURITY_NODE_TYPE_PATHS) {
      const c = purity.perType[tp];
      if (!c) continue;
      const matches =
        target === "AllPure"
          ? c.Pure
          : target === "AllNormal"
            ? c.Normal
            : target === "AllImpure"
              ? c.Impure
              : c.total; // RestoreDefault — per-node not touched.
      willChange += c.total - matches;
    }
    if (target === "RestoreDefault") willChange = 0;
    const worldChanges =
      purity.supportsWorldSetting &&
      ((target === "AllPure" &&
        purity.worldSetting !== WORLD_PURITY_VALUES.Pure) ||
        (target === "AllImpure" &&
          purity.worldSetting !== WORLD_PURITY_VALUES.Impure) ||
        ((target === "AllNormal" || target === "RestoreDefault") &&
          purity.worldSetting !== WORLD_PURITY_VALUES.Default));
    return { nodesThatWillChange: willChange, worldSettingWillChange: worldChanges };
  }, [purity, target]);

  if (!purity) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Resource node purity
            {!purity.supportsWorldSetting && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="warning" className="cursor-help">
                      pre-1.2 save
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    The world-level <code>mNodePuritySettings</code> toggle is new in
                    Update 1.2. On this save only per-node values will be set.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <Info className="size-4 mt-0.5 shrink-0" aria-hidden />
            <span>
              Purity is stored in two places. The world-level setting on
              <code className="mx-1">BP_GameState_C</code> is the authoritative
              one — the game re-applies it on load. Per-node overrides alone are
              silently reverted. This editor sets both on 1.2 saves; on pre-1.2
              saves only per-node values are set.
            </span>
          </div>

          <RadioGroup
            value={target}
            onValueChange={(v) => setTarget(v as PurityTarget)}
            className="grid sm:grid-cols-2 gap-3"
          >
            {(Object.keys(TARGET_LABELS) as PurityTarget[]).map((t) => (
              <label
                key={t}
                className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-accent/40"
              >
                <RadioGroupItem value={t} id={`purity-${t}`} className="mt-1" />
                <div className="text-sm">
                  <Label htmlFor={`purity-${t}`} className="font-medium">
                    {TARGET_LABELS[t]}
                  </Label>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {TARGET_DESC[t]}
                  </div>
                </div>
              </label>
            ))}
          </RadioGroup>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex items-center justify-between">
            <span>
              <strong>{livePreview.nodesThatWillChange}</strong> nodes will
              change
              {livePreview.worldSettingWillChange &&
                "; world-level setting will change"}
              .
            </span>
            <Button
              size="sm"
              onClick={() => void stagePurity(target)}
              disabled={
                livePreview.nodesThatWillChange === 0 &&
                !livePreview.worldSettingWillChange
              }
            >
              Apply
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="text-sm font-semibold">Current state</div>
            <div className="text-sm">
              World setting:{" "}
              {purity.supportsWorldSetting ? (
                <code>{purity.worldSetting ?? "(unset)"}</code>
              ) : (
                <span className="text-muted-foreground">
                  not applicable on this save version
                </span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {PURITY_NODE_TYPE_PATHS.map((tp) => {
                const c = purity.perType[tp];
                return (
                  <div key={tp} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">{NODE_TYPE_LABEL[tp]}</div>
                    <div className="mt-1 text-muted-foreground text-xs">
                      total: {c.total}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                      <Histogram color="bg-emerald-500" label="Pure" n={c.Pure} total={c.total} />
                      <Histogram color="bg-sky-500" label="Normal" n={c.Normal} total={c.total} />
                      <Histogram color="bg-amber-500" label="Impure" n={c.Impure} total={c.total} />
                      <Histogram color="bg-zinc-400" label="Unset" n={c.Unset} total={c.total} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {purity.supportsWorldSetting && purity.worldSetting === null && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>
                <code>mNodePuritySettings</code> is missing from this save&apos;s
                <code> BP_GameState_C</code>. Applying any preset will synthesize it.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Histogram({
  color,
  label,
  n,
  total,
}: {
  color: string;
  label: string;
  n: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{n}</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-muted rounded">
        <div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

