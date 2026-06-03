"use client";

import * as React from "react";
import { Search, Plus, Minus, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ItemIcon } from "@/components/item-icon";
import { cn } from "@/lib/utils";
import { useSaveStore } from "@/store/save-store";
import {
  spawnableItems,
  itemName,
  itemPath,
  stackSizeLimit,
} from "@/lib/game-data";
import { MAX_STACKS_PER_CRATE } from "@/lib/edits/spawn-items";

const stacksFor = (count: number, stackSize: number | null): number =>
  Math.ceil(count / (stackSize && stackSize > 0 ? stackSize : count || 1));

export function ItemSpawnTab() {
  const spawnTargets = useSaveStore((s) => s.spawnTargets);
  const stageSpawnItems = useSaveStore((s) => s.stageSpawnItems);

  const items = React.useMemo(() => spawnableItems(), []);

  const targetsWithLocation = React.useMemo(
    () => spawnTargets.filter((t) => t.hasLocation),
    [spawnTargets]
  );

  const [player, setPlayer] = React.useState<string>("");
  const [query, setQuery] = React.useState("");
  // className → desired total count
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Effective selection: the explicit choice, else the first player with a
  // known location. Derived (not stored) so we don't setState in an effect.
  const effectivePlayer =
    player || targetsWithLocation[0]?.instanceName || "";

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            it.className.toLowerCase().includes(q)
        )
      : items;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query]);

  const selected = React.useMemo(
    () => Object.entries(counts).filter(([, n]) => n > 0),
    [counts]
  );

  const totals = React.useMemo(() => {
    let totalItems = 0;
    let totalStacks = 0;
    for (const [className, count] of selected) {
      totalItems += count;
      totalStacks += stacksFor(count, stackSizeLimit(className));
    }
    const crates = Math.ceil(totalStacks / MAX_STACKS_PER_CRATE) || 0;
    return { totalItems, totalStacks, crates };
  }, [selected]);

  const setCount = (className: string, next: number) => {
    setCounts((prev) => {
      const v = Math.max(0, Math.floor(Number.isFinite(next) ? next : 0));
      const copy = { ...prev };
      if (v === 0) delete copy[className];
      else copy[className] = v;
      return copy;
    });
  };

  const bump = (className: string, by: number) => {
    const cur = counts[className] ?? 0;
    const stack = stackSizeLimit(className) ?? 100;
    setCount(className, cur + by * stack);
  };

  const clearAll = () => setCounts({});

  const handleStage = async () => {
    if (!effectivePlayer || selected.length === 0) return;
    setPending(true);
    setError(null);
    try {
      const payload = selected.map(([className, count]) => ({
        pathName: itemPath(className) ?? "",
        count,
        stackSize: stackSizeLimit(className) ?? count,
        label: itemName(className),
      }));
      await stageSpawnItems(effectivePlayer, payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  // No spawn paths in the bundled data → the data pipeline hasn't been
  // regenerated since this feature landed. Spawning would write broken item
  // references, so we refuse and explain.
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spawn Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
            <div>
              Item spawn data is unavailable. The bundled game data has no item
              class paths — regenerate it with{" "}
              <code className="font-mono">bun run build:docs</code> and reload.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Spawn Items
            {totals.totalItems > 0 && (
              <Badge variant="secondary" className="font-normal">
                {totals.totalItems} item{totals.totalItems === 1 ? "" : "s"} ·{" "}
                {totals.crates} crate{totals.crates === 1 ? "" : "s"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick a player and the items you want, then stage the edit. The items
            are placed in a dismantle-style crate on the ground at that
            player&apos;s location — exactly like the crate the game drops when
            your inventory is full. Quantities are split across stacks (and
            extra crates) automatically.
          </p>

          {targetsWithLocation.length === 0 ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
              <div>
                No player in this save has a spawned character with a known
                location, so there&apos;s nowhere to drop a crate. Load a save
                where the player has entered the world at least once.
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Drop at</span>
                <Select value={effectivePlayer} onValueChange={setPlayer}>
                  <SelectTrigger className="min-w-[220px]">
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                  <SelectContent>
                    {spawnTargets.map((t) => (
                      <SelectItem
                        key={t.instanceName}
                        value={t.instanceName}
                        disabled={!t.hasLocation}
                      >
                        {t.displayName}
                        {!t.hasLocation ? " (no location)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={pending || !effectivePlayer || selected.length === 0}
                onClick={() => void handleStage()}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Staging…
                  </>
                ) : (
                  `Stage spawn (${totals.totalItems})`
                )}
              </Button>
              {selected.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearAll}
                  disabled={pending}
                >
                  <Trash2 className="size-4" /> Clear
                </Button>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative">
            <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter items by name…"
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1 pt-4">
          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No items match &ldquo;{query}&rdquo;.
            </p>
          )}
          {visible.map((it) => {
            const count = counts[it.className] ?? 0;
            const stack = stackSizeLimit(it.className) ?? 0;
            return (
              <div
                key={it.className}
                className={cn(
                  "rounded-md border p-2 flex items-center gap-3 transition-colors",
                  count > 0
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "hover:bg-muted/40"
                )}
              >
                <ItemIcon item={it.className} size={32} />
                <div className="grow min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Stack: {stack || "?"}
                    {it.event === "FICSMAS" ? " · FICSMAS" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label="Remove one stack"
                    disabled={count === 0}
                    onClick={() => bump(it.className, -1)}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={count === 0 ? "" : count}
                    placeholder="0"
                    onChange={(e) =>
                      setCount(it.className, parseInt(e.target.value, 10))
                    }
                    className="w-20 text-center"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label="Add one stack"
                    onClick={() => bump(it.className, 1)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
