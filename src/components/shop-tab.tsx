"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Coins,
  Info,
  Search,
  ShoppingCart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ItemIcon, SchematicIcon } from "@/components/item-icon";
import { BackToTop } from "@/components/back-to-top";
import {
  gameData,
  itemName,
  schematicsByType,
  type Schematic,
} from "@/lib/game-data";
import { useSaveStore } from "@/store/save-store";

type ShopCategoryKey =
  | "buildings"
  | "customizer"
  | "patterns"
  | "decorations"
  | "parts"
  | "tapes"
  | "other";

type ShopCategory = {
  key: ShopCategoryKey;
  label: string;
  /** Whether this category contains BP_UnlockGiveItem_C entries that this
   *  editor cannot grant. UI surfaces a warning. */
  warnGiveItems: boolean;
};

const CATEGORIES: Record<ShopCategoryKey, ShopCategory> = {
  buildings: { key: "buildings", label: "Building Sets", warnGiveItems: false },
  customizer: {
    key: "customizer",
    label: "Customizer Materials",
    warnGiveItems: false,
  },
  patterns: {
    key: "patterns",
    label: "Customizer Patterns",
    warnGiveItems: false,
  },
  decorations: {
    key: "decorations",
    label: "Decorations",
    warnGiveItems: true,
  },
  parts: { key: "parts", label: "Parts & Bundles", warnGiveItems: true },
  tapes: { key: "tapes", label: "FICSIT Records (Tapes)", warnGiveItems: false },
  other: { key: "other", label: "Other", warnGiveItems: false },
};

// Path-based categorization. The /ResourceSink/ tree is structured well enough
// that the parent directory is a strong proxy for what kind of purchase the
// schematic represents. Top-level /ResourceSink/ entries split between
// recipe-only "Building Sets" and giveItem-only "Decorations" (statues,
// trinkets) — we use the unlock shape to disambiguate.
function categoryFor(s: Schematic): ShopCategoryKey {
  const path = s.pathName;
  if (path.includes("/Schematics/Tapes/")) return "tapes";
  if (path.includes("/ResourceSink/Customizer/")) return "customizer";
  if (path.includes("/ResourceSink/Patterns/")) return "patterns";
  if (path.includes("/ResourceSink/Parts/")) return "parts";
  if (path.includes("/ResourceSink/")) {
    if (s.unlocks.giveItems.length > 0 && s.unlocks.recipes.length === 0) {
      return "decorations";
    }
    return "buildings";
  }
  return "other";
}

const ALL_SHOP = schematicsByType("EST_ResourceSink").sort((a, b) =>
  a.name.localeCompare(b.name)
);

function CostLine({ s }: { s: Schematic }) {
  if (s.cost.length === 0) {
    return <span className="text-muted-foreground">Free</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {s.cost.map((c) => (
        <span key={c.className} className="inline-flex items-center gap-1">
          <ItemIcon item={c.className} size={14} />
          {c.amount}
          {c.className === "Desc_ResourceSinkCoupon_C" ? null : (
            <span className="text-muted-foreground">
              × {itemName(c.className)}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function UnlockSummary({ s }: { s: Schematic }) {
  const parts: React.ReactNode[] = [];
  for (const r of s.unlocks.recipes) {
    const recipe = gameData.recipes[r];
    if (!recipe) continue;
    parts.push(
      <span
        key={`r-${r}`}
        className="inline-flex items-center gap-1 text-xs"
      >
        {recipe.products.slice(0, 1).map((p, i) => (
          <ItemIcon key={i} item={p.className} size={14} />
        ))}
        {recipe.name}
      </span>
    );
  }
  for (const g of s.unlocks.giveItems) {
    parts.push(
      <span
        key={`g-${g.className}`}
        className="inline-flex items-center gap-1 text-xs"
      >
        <ItemIcon item={g.className} size={14} />
        {g.amount}× {itemName(g.className)}
      </span>
    );
  }
  if (s.unlocks.schematics.length > 0) {
    parts.push(
      <Badge
        key="children"
        variant="outline"
        className="font-normal text-[0.65rem]"
      >
        +{s.unlocks.schematics.length} sub-recipes
      </Badge>
    );
  }
  if (s.unlocks.recipes.length === 0 && s.unlocks.giveItems.length === 0) {
    parts.push(
      <span key="none" className="text-xs text-muted-foreground italic">
        Marks the schematic as purchased
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{parts}</div>
  );
}

function ShopRow({
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
      <div className="grow min-w-0 space-y-1.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium">{s.name}</span>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Coins className="size-3" />
            <CostLine s={s} />
          </span>
        </div>
        <UnlockSummary s={s} />
      </div>
    </label>
  );
}

export function ShopTab() {
  const research = useSaveStore((s) => s.research);
  const stage = useSaveStore((s) => s.stageSchematicUnlocked);
  const stageBulk = useSaveStore((s) => s.stageBulkSchematicUnlocked);

  const [query, setQuery] = React.useState("");
  const [pendingClass, setPendingClass] = React.useState<string | null>(null);
  const [bulkPending, setBulkPending] = React.useState(false);

  const unlocked = React.useMemo(
    () => new Set(research?.unlockedClassNames ?? []),
    [research]
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_SHOP;
    return ALL_SHOP.filter((s) => {
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.className.toLowerCase().includes(q)) return true;
      for (const u of s.unlocks.recipes) {
        const r = gameData.recipes[u];
        if (!r) continue;
        if (r.name.toLowerCase().includes(q)) return true;
        for (const p of r.products)
          if (itemName(p.className).toLowerCase().includes(q)) return true;
      }
      for (const g of s.unlocks.giveItems) {
        if (itemName(g.className).toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [query]);

  const groups = React.useMemo(() => {
    const byKey = new Map<ShopCategoryKey, Schematic[]>();
    for (const s of visible) {
      const k = categoryFor(s);
      const arr = byKey.get(k) ?? [];
      arr.push(s);
      byKey.set(k, arr);
    }
    const order: ShopCategoryKey[] = [
      "buildings",
      "customizer",
      "patterns",
      "tapes",
      "decorations",
      "parts",
      "other",
    ];
    return order
      .map((k) => ({
        category: CATEGORIES[k],
        rows: byKey.get(k) ?? [],
      }))
      .filter((g) => g.rows.length > 0);
  }, [visible]);

  const totalInScope = ALL_SHOP.length;
  const unlockedInScope = ALL_SHOP.filter((s) =>
    unlocked.has(s.className)
  ).length;
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
        ALL_SHOP.map((s) => s.className)
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
            <ShoppingCart className="size-5" />
            AWESOME Shop
            <Badge variant="secondary" className="font-normal">
              {unlockedInScope} / {totalInScope} purchased
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <Info className="size-4 mt-0.5 shrink-0" />
            <span>
              Every AWESOME Shop entry the game ships in 1.2. Checking a row
              writes the schematic to{" "}
              <code>SchematicManager.mPurchasedSchematics</code> so the game
              treats it as purchased on next load. Customizer bundles also
              unlock their nested build-gun schematics.
            </span>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>
              Decorations (statues, trinkets) and Parts (hard drives, ammo
              packs) only mark the schematic as purchased — the items are NOT
              added to your inventory, and Parts schematics that are normally
              repeatable purchases will be locked off in-game once marked.
              Coupon balance is unchanged.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative grow min-w-[200px]">
              <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name, recipe, or item…"
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
          <Card key={g.category.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {g.category.label}
                <Badge variant="secondary" className="font-normal">
                  {groupUnlocked} / {g.rows.length}
                </Badge>
              </CardTitle>
              {g.category.warnGiveItems && (
                <div className="text-xs text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 mt-1">
                  <ArrowRight className="size-3" />
                  Items granted by these schematics aren&apos;t added to your
                  inventory.
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {g.rows.map((s) => (
                <ShopRow
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

      <BackToTop />
    </div>
  );
}
