"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSaveStore } from "@/store/save-store";
import {
  MAX_INVENTORY_SLOTS,
  VANILLA_INVENTORY_SLOTS,
} from "@/lib/edits/inventory";

export function InventoryTab() {
  const players = useSaveStore((s) => s.players);
  const stageInventory = useSaveStore((s) => s.stageInventory);

  const [edits, setEdits] = React.useState<Record<string, number>>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player inventory slots</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Vanilla default is {VANILLA_INVENTORY_SLOTS}. Capped at{" "}
          {MAX_INVENTORY_SLOTS}.
        </div>
        {players.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No <code>BP_PlayerState_C</code> entries found in this save.
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((p) => {
              const draft = edits[p.instanceName] ?? p.slots;
              const dirty = draft !== p.slots;
              return (
                <div
                  key={p.instanceName}
                  className="rounded-md border p-3 flex flex-wrap items-end gap-3"
                >
                  <div className="min-w-0 grow">
                    <Label className="text-xs text-muted-foreground">
                      Player
                    </Label>
                    <div className="font-medium truncate">{p.displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.instanceName}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Slots
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_INVENTORY_SLOTS}
                      value={draft}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (Number.isNaN(v)) return;
                        setEdits((s) => ({ ...s, [p.instanceName]: v }));
                      }}
                      className="w-24"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={
                      !dirty || draft < 1 || draft > MAX_INVENTORY_SLOTS
                    }
                    onClick={() =>
                      void stageInventory(p.instanceName, draft).then(() =>
                        setEdits((s) => {
                          const next = { ...s };
                          delete next[p.instanceName];
                          return next;
                        })
                      )
                    }
                  >
                    Apply
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
