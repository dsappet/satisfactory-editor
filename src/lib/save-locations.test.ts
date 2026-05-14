import { describe, expect, test } from "@jest/globals";
import { detectOS, SAVE_LOCATIONS } from "./save-locations";

describe("detectOS", () => {
  test("Windows 11 Chrome", () => {
    expect(
      detectOS(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
      )
    ).toBe("windows");
  });

  test("macOS Safari", () => {
    expect(
      detectOS(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
      )
    ).toBe("macos");
  });

  test("Linux Firefox", () => {
    expect(
      detectOS(
        "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0"
      )
    ).toBe("linux");
  });

  test("Steam Deck (reports as Linux)", () => {
    expect(
      detectOS(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) SteamDeck Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("linux");
  });

  test("ChromeOS", () => {
    expect(
      detectOS(
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("linux");
  });

  test("undefined falls back to Windows (the most common case)", () => {
    expect(detectOS(undefined)).toBe("windows");
  });

  test("unknown UA falls back to Windows", () => {
    expect(detectOS("Mozilla/5.0 (PlayStation; PlayStation 5/2.50)")).toBe(
      "windows"
    );
  });
});

describe("SAVE_LOCATIONS", () => {
  test("covers every OS the type allows", () => {
    expect(Object.keys(SAVE_LOCATIONS).sort()).toEqual([
      "linux",
      "macos",
      "windows",
    ]);
  });

  test("Windows path uses the env-var form Explorer can expand", () => {
    expect(SAVE_LOCATIONS.windows.path).toContain("%LOCALAPPDATA%");
    expect(SAVE_LOCATIONS.windows.path).toContain("FactoryGame\\Saved\\SaveGames");
  });

  test("Linux path points at the Satisfactory Proton prefix (Steam appid 526870)", () => {
    expect(SAVE_LOCATIONS.linux.path).toContain("compatdata/526870");
    expect(SAVE_LOCATIONS.linux.path).toContain("FactoryGame/Saved/SaveGames");
  });
});
