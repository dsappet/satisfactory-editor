"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, HardDrive, Info, Search } from "lucide-react";
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

// FICSMAS alternate schematics are tagged via mRelevantEvents on the recipe
// side; the schematic itself rarely carries the tag. We also defensively
// check the className for "Xmas".
const isFicsmas = (s: Schematic): boolean =>
  s.event === "FICSMAS" || /xmas|ficsmas/i.test(s.className);

const ALL_ALTS = schematicsByType("EST_Alternate").sort((a, b) =>
  a.name.localeCompare(b.name)
);

/** Choose the item this alt is grouped under. For recipe alts, that's the
 *  first product of the first unlocked recipe. For utility alts (e.g.
 *  inventory-slot upgrades from hard drives), returns null → goes into the
 *  "Other unlocks" bucket. */
function primaryProductFor(s: Schematic): string | null {
  const firstRecipe = s.unlocks.recipes[0];
  if (!firstRecipe) return null;
  const r = gameData.recipes[firstRecipe];
  if (!r) return null;
  return r.products[0]?.className ?? null;
}

const OTHER_GROUP_KEY = "__other__";

type Group = {
  key: string;
  /** Item class name for the header icon, or null for the "Other" bucket. */
  itemClass: string | null;
  label: string;
  rows: Schematic[];
};

function RecipeIO({ recipeClass }: { recipeClass: string }) {
  const r = gameData.recipes[recipeClass];
  if (!r) {
    return (
      <span className="text-xs text-muted-foreground">
        Recipe {recipeClass} (data missing)
      </span>
    );
  }
  return (
    <div className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
      {r.ingredients.map((i, idx) => (
        <span key={`in-${idx}`} className="inline-flex items-center gap-1">
          <ItemIcon item={i.className} size={16} />
          {i.amount}× {itemName(i.className)}
        </span>
      ))}
      <ArrowRight className="size-3 text-muted-foreground" />
      {r.products.map((p, idx) => (
        <span key={`out-${idx}`} className="inline-flex items-center gap-1 font-medium">
          <ItemIcon item={p.className} size={16} />
          {p.amount}× {itemName(p.className)}
        </span>
      ))}
    </div>
  );
}

function AltRow({
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
  const recipeUnlocks = s.unlocks.recipes;
  // Strip the "Alternate: " prefix from row titles — the section header gives
  // the product context and the prefix is visually noisy.
  const trimmedName = s.name.replace(/^Alternate:\s*/i, "");
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
      <div className="grow min-w-0 space-y-1.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium">{trimmedName}</span>
          {s.techTier > 0 && (
            <span className="text-[0.65rem] text-muted-foreground">
              T{s.techTier}
            </span>
          )}
        </div>

        {recipeUnlocks.length > 0 ? (
          <div className="space-y-1">
            {recipeUnlocks.map((rc) => (
              <RecipeIO key={rc} recipeClass={rc} />
            ))}
          </div>
        ) : (
          // Utility alts (no recipe) — surface what they DO unlock instead.
          <div className="text-xs flex flex-wrap gap-1">
            {s.unlocks.inventorySlots > 0 && (
              <Badge variant="outline" className="font-normal">
                +{s.unlocks.inventorySlots} inventory slots
              </Badge>
            )}
            {s.unlocks.equipmentHandSlots > 0 && (
              <Badge variant="outline" className="font-normal">
                +{s.unlocks.equipmentHandSlots} hand slots
              </Badge>
            )}
          </div>
        )}
      </div>
    </label>
  );
}

export function HardDriveTab() {
  const research = useSaveStore((s) => s.research);
  const stage = useSaveStore((s) => s.stageSchematicUnlocked);
  const stageBulk = useSaveStore((s) => s.stageBulkSchematicUnlocked);
  const hideEvent = usePreferences((s) => s.hideEventContent);

  const [query, setQuery] = React.useState("");
  const [pendingClass, setPendingClass] = React.useState<string | null>(null);
  const [bulkPending, setBulkPending] = React.useState(false);

  const unlocked = React.useMemo(
    () => new Set(research?.unlockedClassNames ?? []),
    [research]
  );

  const alts = React.useMemo(
    () => (hideEvent ? ALL_ALTS.filter((s) => !isFicsmas(s)) : ALL_ALTS),
    [hideEvent]
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return alts;
    return alts.filter((s) => {
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.className.toLowerCase().includes(q)) return true;
      for (const rc of s.unlocks.recipes) {
        const r = gameData.recipes[rc];
        if (!r) continue;
        if (r.name.toLowerCase().includes(q)) return true;
        for (const ing of r.ingredients)
          if (itemName(ing.className).toLowerCase().includes(q)) return true;
        for (const p of r.products)
          if (itemName(p.className).toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [alts, query]);

  const groups = React.useMemo<Group[]>(() => {
    const byKey = new Map<string, Schematic[]>();
    for (const s of visible) {
      const product = primaryProductFor(s);
      const key = product ?? OTHER_GROUP_KEY;
      const arr = byKey.get(key) ?? [];
      arr.push(s);
      byKey.set(key, arr);
    }
    const groupArr: Group[] = [];
    for (const [key, rows] of byKey) {
      if (key === OTHER_GROUP_KEY) continue;
      groupArr.push({
        key,
        itemClass: key,
        label: itemName(key),
        rows,
      });
    }
    groupArr.sort((a, b) => a.label.localeCompare(b.label));
    if (byKey.has(OTHER_GROUP_KEY)) {
      groupArr.push({
        key: OTHER_GROUP_KEY,
        itemClass: null,
        label: "Other unlocks",
        rows: byKey.get(OTHER_GROUP_KEY)!,
      });
    }
    return groupArr;
  }, [visible]);

  const unlockedInScope = React.useMemo(
    () => alts.filter((s) => unlocked.has(s.className)).length,
    [alts, unlocked]
  );
  const totalInScope = alts.length;
  const allUnlocked = unlockedInScope === totalInScope;

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
      await stageBulk(
        next,
        alts.map((s) => s.className)
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
            <HardDrive className="size-5" />
            Hard Drive alternates
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
              Every alternate recipe unlock from hard-drive scans. Checking a
              row writes the schematic to{" "}
              <code>SchematicManager.mPurchasedSchematics</code> — the game
              re-derives the recipe list from that on load. Slot-upgrade alts
              also bump <code>UnlockSubsystem</code> aggregates.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative grow min-w-[200px]">
              <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name, recipe, ingredient, or product…"
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
                Save is missing SchematicManager / ResearchManager /
                UnlockSubsystem. Edits are disabled.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

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
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {g.itemClass ? (
                  <ItemIcon item={g.itemClass} size={24} />
                ) : (
                  <HardDrive className="size-5 text-muted-foreground" />
                )}
                {g.label}
                <Badge variant="secondary" className="font-normal">
                  {groupUnlocked} / {g.rows.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {g.rows.map((s) => (
                <AltRow
                  key={s.className}
                  s={s}
                  isUnlocked={unlocked.has(s.className)}
                  isPending={pendingClass === s.className || bulkPending}
                  ready={research?.ready ?? false}
                  onToggle={handleToggle}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
