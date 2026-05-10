"use client";

import * as React from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
};

const STORAGE_KEY = "se-theme";

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readSavedTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage may be unavailable */
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer reads localStorage once on the first client render,
  // avoiding the cascading-render lint and a flash of the default theme.
  const [theme, setTheme] = React.useState<Theme>(readSavedTheme);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      set: setTheme,
      toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
