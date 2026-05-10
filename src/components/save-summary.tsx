"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSaveStore } from "@/store/save-store";
import { formatDuration } from "@/lib/utils";

const SUPPORTS_PURITY_VERSION_TEXT = "U1.2+";

export function SaveSummary() {
  const summary = useSaveStore((s) => s.summary);
  const purity = useSaveStore((s) => s.purity);
  const reset = useSaveStore((s) => s.reset);

  if (!summary) return null;

  const supportsWorldPurity = purity?.supportsWorldSetting ?? false;
  const versionLabel = supportsWorldPurity
    ? `Save v${summary.saveVersion} (${SUPPORTS_PURITY_VERSION_TEXT})`
    : `Save v${summary.saveVersion} (pre-1.2)`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">
              {summary.sessionName || summary.saveName || summary.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.name}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reset()}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <Field label="Playtime" value={formatDuration(summary.playDurationSeconds)} />
        <Field label="Build" value={`${summary.buildVersion}`} />
        <Field
          label="Save version"
          value={
            <span className="flex items-center gap-2">
              {versionLabel}
              {!supportsWorldPurity && (
                <Badge variant="warning">no world purity</Badge>
              )}
            </span>
          }
        />
        <Field label="Saved" value={summary.saveDateTime} />
        <Field label="Map" value={summary.mapName} />
        <Field
          label="Mode"
          value={
            <span className="flex flex-wrap gap-1">
              {summary.creativeMode && <Badge variant="secondary">Creative</Badge>}
              {summary.isModded && <Badge variant="secondary">Modded</Badge>}
              {!summary.creativeMode && !summary.isModded && (
                <span>Standard</span>
              )}
            </span>
          }
        />
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate">{value}</div>
    </div>
  );
}
