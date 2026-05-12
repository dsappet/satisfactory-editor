"use client";

import * as React from "react";
import { Backpack, Grip, AlertTriangle, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSaveStore } from "@/store/save-store";
import { SchematicIcon } from "@/components/item-icon";
import {
  MAX_ARM_SLOTS,
  MAX_INVENTORY_SLOTS,
  VANILLA_ARM_SLOTS,
  VANILLA_INVENTORY_SLOTS,
} from "@/lib/edits/inventory";

// Pull the schematic icons whose unlock effects line up with each control —
// the in-game art for "Inflated Pocket Dimension" / "Expanded Toolbelt" is the
// best signifier we have for the slot/hand concept.
const INVENTORY_VISUAL_SCHEMATIC = "Research_Sulfur_6_C";
const HAND_VISUAL_SCHEMATIC = "Research_Sulfur_5_C";

type SlotPanelProps = {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  draft: number | null;
  setDraft: (v: number | null) => void;
  apply: (v: number) => Promise<void>;
  disabled: boolean;
  max: number;
  vanilla: number;
};

function SlotPanel({
  icon,
  label,
  hint,
  value,
  draft,
  setDraft,
  apply,
  disabled,
  max,
  vanilla,
}: SlotPanelProps) {
  const [busy, setBusy] = React.useState(false);
  const current = draft ?? value;
  const dirty = draft !== null && draft !== value;
  const valid =
    Number.isInteger(current) && current >= 1 && current <= max;

  const handleApply = async () => {
    setBusy(true);
    try {
      await apply(current);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-md bg-muted/60 flex items-center justify-center text-foreground">
          {icon}
        </div>
        <div className="grow min-w-0">
          <Label className="text-sm font-medium">{label}</Label>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="grow">
          <Input
            type="number"
            min={1}
            max={max}
            value={current}
            disabled={disabled || busy}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isNaN(v)) return;
              setDraft(v);
            }}
            className="w-full"
          />
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              disabled={disabled || busy || current === vanilla}
              onClick={() => setDraft(vanilla)}
              className="text-[0.7rem] underline-offset-2 text-muted-foreground hover:underline disabled:no-underline disabled:opacity-50"
            >
              vanilla {vanilla}
            </button>
            <button
              type="button"
              disabled={disabled || busy || current === max}
              onClick={() => setDraft(max)}
              className="text-[0.7rem] underline-offset-2 text-muted-foreground hover:underline disabled:no-underline disabled:opacity-50"
            >
              max {max}
            </button>
          </div>
        </div>
        <Button
          size="sm"
          disabled={disabled || busy || !dirty || !valid}
          onClick={() => void handleApply()}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

export function InventoryTab() {
  const slots = useSaveStore((s) => s.slots);
  const stageInventory = useSaveStore((s) => s.stageInventory);
  const stageArmSlots = useSaveStore((s) => s.stageArmSlots);

  const [invDraft, setInvDraft] = React.useState<number | null>(null);
  const [armDraft, setArmDraft] = React.useState<number | null>(null);

  if (!slots) return null;

  const disabled = !slots.hasUnlockSubsystem;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Player slots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            World-level unlock counts on <code>BP_UnlockSubsystem_C</code>.
            Edits apply to every player in the session.
          </div>

          {disabled && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>
                This save has no BP_UnlockSubsystem_C — slot edits are
                unavailable. Try a different save.
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <SlotPanel
              icon={
                <SchematicIcon
                  schematic={INVENTORY_VISUAL_SCHEMATIC}
                  size={28}
                />
              }
              label="Inventory slots"
              hint="Backpack capacity, shared by all players."
              value={slots.inventorySlots}
              draft={invDraft}
              setDraft={setInvDraft}
              apply={(v) => stageInventory(v)}
              disabled={disabled}
              max={MAX_INVENTORY_SLOTS}
              vanilla={VANILLA_INVENTORY_SLOTS}
            />
            <SlotPanel
              icon={
                <SchematicIcon schematic={HAND_VISUAL_SCHEMATIC} size={28} />
              }
              label="Hand slots"
              hint="Toolbelt / equipment slot count."
              value={slots.armSlots}
              draft={armDraft}
              setDraft={setArmDraft}
              apply={(v) => stageArmSlots(v)}
              disabled={disabled}
              max={MAX_ARM_SLOTS}
              vanilla={VANILLA_ARM_SLOTS}
            />
          </div>

          <div className="text-[0.7rem] text-muted-foreground flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1">
              <Backpack className="size-3" /> Inventory icons are placeholders
              from the Pocket Dimension / Expanded Toolbelt research.
            </span>
            <span className="inline-flex items-center gap-1">
              <Grip className="size-3" /> Hand slot icon ditto.
            </span>
          </div>
        </CardContent>
      </Card>

      {slots.players.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4" />
              Players in save
              <Badge variant="secondary" className="font-normal">
                {slots.players.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Per-player observed inventory count, re-synced from the world
              value on save load. A yellow value means the observed copy
              disagrees with the master — usually harmless.
            </p>
            {slots.players.map((p) => {
              const observed = p.observedInventorySlots;
              const mismatch =
                observed !== null && observed !== slots.inventorySlots;
              return (
                <div
                  key={p.instanceName}
                  className="rounded-md border p-2 flex flex-wrap items-center gap-3 text-sm"
                >
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0 grow">
                    <div className="font-medium truncate">{p.displayName}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {p.instanceName}
                    </div>
                  </div>
                  <div className="text-xs">
                    observed:{" "}
                    <span
                      className={
                        mismatch
                          ? "font-semibold text-amber-700 dark:text-amber-400"
                          : "font-mono"
                      }
                    >
                      {observed ?? "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
