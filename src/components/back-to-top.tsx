"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Floating "back to top" affordance for long scrollable lists. Window-level
// because the app's main scroller is the page itself.
export function BackToTop({ threshold = 600 }: { threshold?: number }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      aria-label="Back to top"
      onClick={() =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
      className={cn(
        "fixed bottom-6 right-6 z-40 size-10 rounded-full shadow-lg border transition-opacity",
        visible
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      )}
    >
      <ArrowUp className="size-5" />
    </Button>
  );
}
