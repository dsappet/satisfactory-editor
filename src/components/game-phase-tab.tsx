"use client";

import * as React from "react";
import { AlertTriangle, Info, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ItemIcon, SchematicIcon } from "@/components/item-icon";
import { BackToTop } from "@/components/back-to-top";
import {
  itemName,
  schematicsByType,
  type Schematic,
} from "@/lib/game-data";
import { useSaveStore } from "@/store/save-store";

// Space-Elevator phases group HUB tiers. 1.0/1.2 layout. Phase 5 (Project
// Assembly) was added with the 1.0 release and contains only Tier 9.
const PHASES: Array<{ phase: number; label: string; tiers: number[] }> = [
  { phase: 1, label: "Distribution Platform", tiers: [1, 2] },
  { phase: 2, label: "Construction Dock", tiers: [3, 4] },
  { phase: 3, label: "Production Bay", tiers: [5, 6] },
  { phase: 4, label: "Assembly Director System", tiers: [7, 8] },
  { phase: 5, label: "Project Assembly", tiers: [9] },
];

const ALL_MILESTONES = schematicsByType("EST_Milestone").sort(
  (a, b) => a.techTier - b.techTier || a.name.localeCompare(b.name)
);

function describeUnlocks(s: Schematic): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (const r of s.unlocks.recipes) {
    const display = r.replace(/^Recipe_/, "").replace(/_C$/, "");
    out.push(
      <Badge key={`recipe-${r}`} variant="outline" className="font-normal">
        Recipe · {display}
      </Badge>
    );
  }
  for (const r of s.unlocks.scannerResources) {
    out.push(
      <Badge
        key={`scan-${r}`}
        variant="outline"
        className="font-normal gap-1 pl-1"
      >
        <ItemIcon item={r} size={14} />
        Scanner · {itemName(r)}
      </Badge>
    );
  }
  for (const i of s.unlocks.giveItems) {
    out.push(
      <Badge
        key={`item-${i.className}`}
        variant="outline"
        className="font-normal gap-1 pl-1"
      >
        <ItemIcon item={i.className} size={14} />
        {i.amount}× {itemName(i.className)}
      </Badge>
    );
  }
  if (s.unlocks.inventorySlots > 0) {
    out.push(
      <Badge key="inv" variant="outline" className="font-normal">
        +{s.unlocks.inventorySlots} inventory slots
      </Badge>
    );
  }
  if (s.unlocks.equipmentHandSlots > 0) {
    out.push(
      <Badge key="arm" variant="outline" className="font-normal">
        +{s.unlocks.equipmentHandSlots} hand slots
      </Badge>
    );
  }
  if (s.unlocks.efficiencyPanel)
    out.push(
      <Badge key="eff" variant="outline" className="font-normal">
        Efficiency panel
      </Badge>
    );
  if (s.unlocks.overclockPanel)
    out.push(
      <Badge key="oc" variant="outline" className="font-normal">
        Overclock panel
      </Badge>
    );
  if (s.unlocks.map)
    out.push(
      <Badge key="map" variant="outline" className="font-normal">
        Map
      </Badge>
    );
  if (s.unlocks.customizer)
    out.push(
      <Badge key="cust" variant="outline" className="font-normal">
        Customizer
      </Badge>
    );
  return out;
}

type PhaseFilter = "all" | number;

function MilestoneRow({
  s,
  isUnlocked,
  isPending,
  ready,
  onToggle,
}: {
  s: Schematic;
  isUnlocked: boolean;
  isPending: boolean;
  ready: boolean;
  onToggle: (className: string, next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "rounded-md border p-3 flex gap-3 items-start cursor-pointer transition-colors",
        isUnlocked
          ? "bg-emerald-500/5 border-emerald-500/30"
          : "hover:bg-muted/40",
        isPending && "opacity-50"
      )}
    >
      <Checkbox
        checked={isUnlocked}
        disabled={isPending || !ready}
        onCheckedChange={(v) => onToggle(s.className, v === true)}
        className="mt-0.5"
      />
      <SchematicIcon schematic={s.className} size={36} />
      <div className="grow min-w-0 space-y-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium">{s.name}</span>
        </div>

        {s.cost.length > 0 && (
          <div className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-muted-foreground">Cost:</span>
            {s.cost.map((c) => (
              <span
                key={c.className}
                className="inline-flex items-center gap-1"
              >
                <ItemIcon item={c.className} size={16} />
                {c.amount}× {itemName(c.className)}
              </span>
            ))}
          </div>
        )}

        <div className="text-xs flex flex-wrap gap-1">{describeUnlocks(s)}</div>
      </div>
    </label>
  );
}

export function GamePhaseTab() {
  const research = useSaveStore((s) => s.research);
  const stage = useSaveStore((s) => s.stageSchematicUnlocked);
  const stageAll = useSaveStore((s) => s.stageBulkSchematicUnlocked);

  const [query, setQuery] = React.useState("");
  const [phaseFilter, setPhaseFilter] = React.useState<PhaseFilter>("all");
  const [pendingClass, setPendingClass] = React.useState<string | null>(null);
  const [bulkPending, setBulkPending] = React.useState(false);

  const unlocked = React.useMemo(
    () => new Set(research?.unlockedClassNames ?? []),
    [research]
  );

  // Stable per-tier groups derived from techTier.
  const byTier = React.useMemo(() => {
    const m = new Map<number, Schematic[]>();
    for (const s of ALL_MILESTONES) {
      const arr = m.get(s.techTier) ?? [];
      arr.push(s);
      m.set(s.techTier, arr);
    }
    return m;
  }, []);

  // Stable phase → milestones map.
  const milestonesByPhase = React.useMemo(() => {
    const out = new Map<number, Schematic[]>();
    for (const p of PHASES) {
      const list: Schematic[] = [];
      for (const t of p.tiers) {
        for (const s of byTier.get(t) ?? []) list.push(s);
      }
      out.set(p.phase, list);
    }
    return out;
  }, [byTier]);

  // Phase to show when "All phases" is selected = every phase that has at
  // least one matching row after the text query.
  const q = query.trim().toLowerCase();
  const matchesQuery = (s: Schematic): boolean => {
    if (!q) return true;
    if (s.name.toLowerCase().includes(q)) return true;
    if (s.className.toLowerCase().includes(q)) return true;
    for (const u of s.unlocks.recipes)
      if (u.toLowerCase().includes(q)) return true;
    for (const c of s.cost)
      if (itemName(c.className).toLowerCase().includes(q)) return true;
    return false;
  };

  const visiblePhases = React.useMemo(() => {
    return PHASES.filter((p) => {
      if (phaseFilter !== "all" && phaseFilter !== p.phase) return false;
      const list = milestonesByPhase.get(p.phase) ?? [];
      return list.some(matchesQuery);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseFilter, milestonesByPhase, q]);

  const totalCount = ALL_MILESTONES.length;
  const unlockedCount = ALL_MILESTONES.filter((s) =>
    unlocked.has(s.className)
  ).length;
  const allUnlocked = unlockedCount === totalCount;

  const phaseCounts = React.useMemo(() => {
    const totals = new Map<number, number>();
    const u = new Map<number, number>();
    for (const p of PHASES) {
      const list = milestonesByPhase.get(p.phase) ?? [];
      totals.set(p.phase, list.length);
      u.set(p.phase, list.filter((s) => unlocked.has(s.className)).length);
    }
    return { totals, unlocked: u };
  }, [milestonesByPhase, unlocked]);

  const handleToggle = async (className: string, next: boolean) => {
    setPendingClass(className);
    try {
      await stage(className, next);
    } finally {
      setPendingClass(null);
    }
  };

  const runBulk = async (classNames: string[], next: boolean) => {
    if (classNames.length === 0) return;
    setBulkPending(true);
    try {
      await stageAll(next, classNames);
    } finally {
      setBulkPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Game Phases
            <Badge variant="secondary" className="font-normal">
              {unlockedCount} / {totalCount} milestones unlocked
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <Info className="size-4 mt-0.5 shrink-0" />
            <span>
              HUB milestones are grouped by Space Elevator phase. Each
              checkbox writes to <code>SchematicManager.mPurchasedSchematics</code>{" "}
              and applies the milestone&apos;s unlock effects (recipes,
              inventory/hand slots, panel toggles) to <code>UnlockSubsystem</code>.
              Panel toggles (map, efficiency, overclock, customizer) flip on
              but never off on undo. This does <em>not</em> bump the Space
              Elevator phase pointer itself — only the per-milestone unlock
              state.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative grow min-w-[200px]">
              <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name, recipe, or cost item…"
                className="pl-8"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkPending || allUnlocked}
              onClick={() =>
                void runBulk(
                  ALL_MILESTONES.map((s) => s.className),
                  true
                )
              }
            >
              Unlock all
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkPending || unlockedCount === 0}
              onClick={() =>
                void runBulk(
                  ALL_MILESTONES.map((s) => s.className),
                  false
                )
              }
            >
              Lock all
            </Button>
          </div>
          {!research?.ready && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>
                Save is missing SchematicManager, ResearchManager, or
                UnlockSubsystem. Edits are disabled.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase picker — horizontally scrolls on narrow screens. */}
      <div className="-mx-1 overflow-x-auto">
        <div className="flex gap-1 px-1 pb-1 min-w-min">
          <PhasePill
            active={phaseFilter === "all"}
            onClick={() => setPhaseFilter("all")}
            label="All phases"
            count={unlockedCount}
            total={totalCount}
          />
          {PHASES.map((p) => (
            <PhasePill
              key={p.phase}
              active={phaseFilter === p.phase}
              onClick={() => setPhaseFilter(p.phase)}
              label={`Phase ${p.phase}`}
              sublabel={p.label}
              count={phaseCounts.unlocked.get(p.phase) ?? 0}
              total={phaseCounts.totals.get(p.phase) ?? 0}
            />
          ))}
        </div>
      </div>

      {visiblePhases.length === 0 && (
        <Card>
          <CardContent className="text-sm text-muted-foreground py-6">
            No matches.
          </CardContent>
        </Card>
      )}

      {visiblePhases.map((p) => {
        const phaseList = milestonesByPhase.get(p.phase) ?? [];
        const phaseUnlocked = phaseList.filter((s) =>
          unlocked.has(s.className)
        ).length;
        const phaseAllUnlocked =
          phaseList.length > 0 && phaseUnlocked === phaseList.length;
        return (
          <Card key={p.phase}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                Phase {p.phase} · {p.label}
                <Badge variant="secondary" className="font-normal">
                  {phaseUnlocked} / {phaseList.length}
                </Badge>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkPending || phaseAllUnlocked}
                    onClick={() =>
                      void runBulk(
                        phaseList.map((s) => s.className),
                        true
                      )
                    }
                  >
                    Unlock phase
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkPending || phaseUnlocked === 0}
                    onClick={() =>
                      void runBulk(
                        phaseList.map((s) => s.className),
                        false
                      )
                    }
                  >
                    Lock phase
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {p.tiers.map((tier) => {
                const tierAll = byTier.get(tier) ?? [];
                const tierRows = tierAll.filter(matchesQuery);
                if (tierRows.length === 0) return null;
                const tierUnlocked = tierAll.filter((s) =>
                  unlocked.has(s.className)
                ).length;
                const tierAllUnlocked =
                  tierAll.length > 0 && tierUnlocked === tierAll.length;
                return (
                  <div key={tier} className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold">Tier {tier}</h3>
                      <Badge
                        variant="secondary"
                        className="font-normal text-[0.65rem]"
                      >
                        {tierUnlocked} / {tierAll.length}
                      </Badge>
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={bulkPending || tierAllUnlocked}
                          onClick={() =>
                            void runBulk(
                              tierAll.map((s) => s.className),
                              true
                            )
                          }
                        >
                          Unlock tier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={bulkPending || tierUnlocked === 0}
                          onClick={() =>
                            void runBulk(
                              tierAll.map((s) => s.className),
                              false
                            )
                          }
                        >
                          Lock tier
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {tierRows.map((s) => (
                        <MilestoneRow
                          key={s.className}
                          s={s}
                          isUnlocked={unlocked.has(s.className)}
                          isPending={
                            pendingClass === s.className || bulkPending
                          }
                          ready={research?.ready ?? false}
                          onToggle={handleToggle}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <BackToTop />
    </div>
  );
}

function PhasePill({
  active,
  onClick,
  label,
  sublabel,
  count,
  total,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel?: string;
  count: number;
  total: number;
}) {
  const complete = total > 0 && count === total;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors flex items-center gap-1.5",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted/60"
      )}
    >
      <span className={active ? "font-medium" : ""}>{label}</span>
      {sublabel && <span className="text-muted-foreground">· {sublabel}</span>}
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[0.65rem] tabular-nums",
          complete
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            : "bg-muted text-muted-foreground"
        )}
      >
        {count}/{total}
      </span>
    </button>
  );
}
