"use client";

import { Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/store/preferences-store";

/**
 * Toggles the app-wide hideEventContent preference. When ON (default), FICSMAS
 * content is filtered out of tabs that consume `gameData.items` /
 * `gameData.schematics`. The button visually reflects the *filter* state, not
 * the visibility state — when hidden, the snowflake is dimmed.
 */
export function EventFilterToggle() {
  const hide = usePreferences((s) => s.hideEventContent);
  const setHide = usePreferences((s) => s.setHideEventContent);
  const label = hide ? "Show holiday content" : "Hide holiday content";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={!hide}
      onClick={() => setHide(!hide)}
      className={
        hide
          ? "text-white/40 hover:text-white/70"
          : "text-cyan-300 hover:text-cyan-200"
      }
    >
      <Snowflake />
    </Button>
  );
}
