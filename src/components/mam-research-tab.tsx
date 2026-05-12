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
import {
  gameData,
  itemName,
  schematicsByType,
  type Schematic,
} from "@/lib/game-data";
import { useSaveStore } from "@/store/save-store";
import { usePreferences } from "@/store/preferences-store";

// "/Game/.../BPD_ResearchTree_AlienOrganisms_C" → "AlienOrganisms"
const treeKeyFromPath = (path: string | undefined): string => {
  if (!path) return "Unknown";
  const m = /BPD_ResearchTree_([\w-]+)_C$/.exec(path);
  return m ? m[1] : "Unknown";
};

// Hardcoded display names — the game's research trees aren't exported in
// the docs JSON, so we can't pull them dynamically.
const TREE_LABELS: Record<string, string> = {
  AlienOrganisms: "Alien Organisms",
  AlienTech: "Alien Tech",
  Caterium: "Caterium",
  Mycelia: "Mycelia",
  Nutrients: "Nutrients",
  PowerSlugs: "Power Slugs",
  Quartz: "Quartz",
  Sulfur: "Sulfur",
  XMas: "FICSMAS",
};

const treeLabel = (key: string): string => TREE_LABELS[key] ?? key;

const isDiscontinued = (s: Schematic): boolean =>
  /^discontinued/i.test(s.name) ||
  /\bold\b.*no longer in use/i.test(s.description);

const ALL_MAMS = schematicsByType("EST_MAM")
  .filter((s) => !isDiscontinued(s))
  .sort((a, b) => a.name.localeCompare(b.name));

const isFicsmas = (s: Schematic): boolean =>
  s.event === "FICSMAS" || treeKeyFromPath(s.researchTreePath) === "XMas";

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
  for (const e of s.unlocks.emotes) {
    const display = e.replace(/^Emote_/, "").replace(/_C$/, "");
    out.push(
      <Badge key={`emote-${e}`} variant="outline" className="font-normal">
        Emote · {display}
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
  if (s.unlocks.scannerObject)
    out.push(
      <Badge key="scn" variant="outline" className="font-normal">
        Scanner object
      </Badge>
    );
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
  if (s.unlocks.tape)
    out.push(
      <Badge key="tape" variant="outline" className="font-normal">
        Tape
      </Badge>
    );
  return out;
}

type TreeFilter = "all" | string;

function MamRow({
  s,
  isUnlocked,
  isPending,
  ready,
  onToggle,
  showTreeBadge,
}: {
  s: Schematic;
  isUnlocked: boolean;
  isPending: boolean;
  ready: boolean;
  onToggle: (className: string, next: boolean) => void;
  showTreeBadge: boolean;
}) {
  const tree = treeKeyFromPath(s.researchTreePath);
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
          {showTreeBadge && (
            <Badge variant="secondary" className="font-normal text-[0.65rem]">
              {treeLabel(tree)}
            </Badge>
          )}
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

export function MamResearchTab() {
  const research = useSaveStore((s) => s.research);
  const stage = useSaveStore((s) => s.stageSchematicUnlocked);
  const stageAll = useSaveStore((s) => s.stageBulkSchematicUnlocked);
  const hideEvent = usePreferences((s) => s.hideEventContent);

  const [query, setQuery] = React.useState("");
  const [treeFilter, setTreeFilter] = React.useState<TreeFilter>("all");
  const [pendingClass, setPendingClass] = React.useState<string | null>(null);
  const [bulkPending, setBulkPending] = React.useState(false);

  const unlocked = React.useMemo(
    () => new Set(research?.unlockedClassNames ?? []),
    [research]
  );

  // Master list, after the global hide-event preference. Everything below
  // computes against this — pill counts, filter, bulk actions.
  const mams = React.useMemo(
    () => (hideEvent ? ALL_MAMS.filter((s) => !isFicsmas(s)) : ALL_MAMS),
    [hideEvent]
  );

  // Tree keys present in the (possibly filtered) master list, alphabetized.
  const treeKeys = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of mams) set.add(treeKeyFromPath(s.researchTreePath));
    return [...set].sort((a, b) => treeLabel(a).localeCompare(treeLabel(b)));
  }, [mams]);

  // If the user had FICSMAS selected and then turned off event content, the
  // stored value would dangle. Use an effective value during render so we
  // don't have to setState-during-effect to sync it.
  const effectiveTreeFilter: TreeFilter =
    treeFilter !== "all" && !treeKeys.includes(treeFilter) ? "all" : treeFilter;

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return mams.filter((s) => {
      if (effectiveTreeFilter !== "all") {
        if (treeKeyFromPath(s.researchTreePath) !== effectiveTreeFilter)
          return false;
      }
      if (!q) return true;
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.className.toLowerCase().includes(q)) return true;
      for (const u of s.unlocks.recipes)
        if (u.toLowerCase().includes(q)) return true;
      for (const c of s.cost)
        if (itemName(c.className).toLowerCase().includes(q)) return true;
      return false;
    });
  }, [query, effectiveTreeFilter, mams]);

  // When viewing "All trees", group rows by tree. Otherwise show a single
  // flat group (no extra heading).
  const groups = React.useMemo(() => {
    if (effectiveTreeFilter !== "all") {
      return [
        {
          key: effectiveTreeFilter,
          label: treeLabel(effectiveTreeFilter),
          rows: visible,
        },
      ];
    }
    const byTree = new Map<string, Schematic[]>();
    for (const s of visible) {
      const k = treeKeyFromPath(s.researchTreePath);
      const arr = byTree.get(k) ?? [];
      arr.push(s);
      byTree.set(k, arr);
    }
    return treeKeys
      .map((k) => ({ key: k, label: treeLabel(k), rows: byTree.get(k) ?? [] }))
      .filter((g) => g.rows.length > 0);
  }, [visible, effectiveTreeFilter, treeKeys]);

  // Unlock counts are computed against the FILTERED master (mams) so the
  // header chip and bulk buttons honour the event filter.
  const unlockedInScope = React.useMemo(
    () => mams.filter((s) => unlocked.has(s.className)).length,
    [mams, unlocked]
  );
  const totalInScope = mams.length;
  const allUnlocked = unlockedInScope === totalInScope;

  const perTreeCounts = React.useMemo(() => {
    const totals = new Map<string, number>();
    const unlockedT = new Map<string, number>();
    for (const s of mams) {
      const k = treeKeyFromPath(s.researchTreePath);
      totals.set(k, (totals.get(k) ?? 0) + 1);
      if (unlocked.has(s.className))
        unlockedT.set(k, (unlockedT.get(k) ?? 0) + 1);
    }
    return { totals, unlockedT };
  }, [unlocked, mams]);

  const handleToggle = async (className: string, next: boolean) => {
    setPendingClass(className);
    try {
      await stage(className, next);
    } finally {
      setPendingClass(null);
    }
  };

  const handleBulk = async (next: boolean) => {
    setBulkPending(true);
    try {
      await stageAll(
        next,
        mams.map((s) => s.className)
      );
    } finally {
      setBulkPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            MAM Research
            <Badge variant="secondary" className="font-normal">
              {unlockedInScope} / {totalInScope} unlocked
            </Badge>
            {hideEvent && (
              <Badge variant="outline" className="font-normal text-[0.65rem]">
                FICSMAS hidden
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <Info className="size-4 mt-0.5 shrink-0" />
            <span>
              Game data from version <strong>{gameData.gameVersion}</strong>.
              Each checkbox writes to{" "}
              <code>SchematicManager.mPurchasedSchematics</code> and applies the
              schematic&apos;s unlock effects to <code>UnlockSubsystem</code>.
              Panel toggles (map, efficiency, overclock, customizer) flip on
              but never off on undo.
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
              onClick={() => void handleBulk(true)}
            >
              Unlock all
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkPending || unlockedInScope === 0}
              onClick={() => void handleBulk(false)}
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

      {/* Tree picker — horizontally scrolls on narrow screens. */}
      <div className="-mx-1 overflow-x-auto">
        <div className="flex gap-1 px-1 pb-1 min-w-min">
          <TreePill
            active={effectiveTreeFilter === "all"}
            onClick={() => setTreeFilter("all")}
            label="All trees"
            count={unlockedInScope}
            total={totalInScope}
          />
          {treeKeys.map((k) => (
            <TreePill
              key={k}
              active={effectiveTreeFilter === k}
              onClick={() => setTreeFilter(k)}
              label={treeLabel(k)}
              count={perTreeCounts.unlockedT.get(k) ?? 0}
              total={perTreeCounts.totals.get(k) ?? 0}
            />
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="text-sm text-muted-foreground py-6">
            No matches.
          </CardContent>
        </Card>
      )}

      {groups.map((g) => {
        const groupUnlocked = g.rows.filter((s) =>
          unlocked.has(s.className)
        ).length;
        return (
          <Card key={g.key}>
            {/* Suppress the per-group header when there's only one group —
                the page already says which tree you're on via the pill. */}
            {groups.length > 1 && (
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {g.label}
                  <Badge variant="secondary" className="font-normal">
                    {groupUnlocked} / {g.rows.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className="space-y-2 pt-4">
              {g.rows.map((s) => (
                <MamRow
                  key={s.className}
                  s={s}
                  isUnlocked={unlocked.has(s.className)}
                  isPending={pendingClass === s.className || bulkPending}
                  ready={research?.ready ?? false}
                  onToggle={handleToggle}
                  showTreeBadge={false}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TreePill({
  active,
  onClick,
  label,
  count,
  total,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
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
