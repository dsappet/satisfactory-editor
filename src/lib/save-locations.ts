/**
 * Where Satisfactory 1.2 stores `.sav` files on disk per platform.
 *
 * The game has no native macOS or Linux build; the non-Windows paths are
 * the Proton / CrossOver prefixes that real users actually see. Steam,
 * Epic, and Game Pass installs all share the same Windows path because
 * the game itself writes to `%LOCALAPPDATA%` regardless of storefront.
 */

export type OS = "windows" | "macos" | "linux";

export type SaveLocation = {
  id: OS;
  label: string;
  /**
   * Path that's useful to copy-paste into the platform's file manager
   * address bar. Saves themselves live in a numbered subfolder (the
   * player's user id) we can't predict.
   */
  path: string;
};

export const SAVE_LOCATIONS: Record<OS, SaveLocation> = {
  windows: {
    id: "windows",
    label: "Windows",
    path: "%LOCALAPPDATA%\\FactoryGame\\Saved\\SaveGames",
  },
  linux: {
    id: "linux",
    label: "Linux / Steam Deck",
    path: "~/.steam/steam/steamapps/compatdata/526870/pfx/drive_c/users/steamuser/AppData/Local/FactoryGame/Saved/SaveGames",
  },
  macos: {
    id: "macos",
    label: "macOS",
    path: "~/Library/Application Support/CrossOver/Bottles/Satisfactory/drive_c/users/crossover/AppData/Local/FactoryGame/Saved/SaveGames",
  },
};

/**
 * Best-effort OS guess from a UA string. We don't need to be perfect —
 * users see all three options as toggles, this just picks the default.
 * Steam Deck and ChromeOS both report as Linux, which matches the right
 * panel for them.
 */
export function detectOS(userAgent: string | undefined): OS {
  if (!userAgent) return "windows";
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macos";
  if (/Linux|X11|CrOS|Android/i.test(userAgent)) return "linux";
  return "windows";
}
