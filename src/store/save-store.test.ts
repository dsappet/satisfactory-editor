/**
 * Tests for the save-store inventory / hand-slot staging logic.
 *
 * Specifically: an edit that returns the slot count to its load-time value
 * must NOT leave a phantom staged edit behind. (Edits that change the value
 * leave a single staged edit whose "from" is the baseline, not whichever
 * intermediate value the user passed through.)
 */
import type { SlotsState } from "@/lib/edits/inventory";

const initialSlots: SlotsState = {
  hasUnlockSubsystem: true,
  inventorySlots: 18,
  armSlots: 1,
  players: [],
};

let mockSlots: SlotsState = { ...initialSlots };

// Mock the worker-client module before importing the store.
jest.mock("@/lib/worker-client", () => ({
  getSaveWorker: () => ({
    worker: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    api: {
      setInventorySlots: async (slots: number) => {
        mockSlots = { ...mockSlots, inventorySlots: slots };
        return mockSlots;
      },
      setArmSlots: async (slots: number) => {
        mockSlots = { ...mockSlots, armSlots: slots };
        return mockSlots;
      },
      reset: async () => {
        mockSlots = { ...initialSlots };
      },
    },
  }),
}));

import { useSaveStore } from "./save-store";

const primeStoreFromLoad = (slots: Partial<SlotsState> = {}) => {
  const merged: SlotsState = { ...initialSlots, ...slots };
  mockSlots = { ...merged };
  useSaveStore.setState({
    slots: merged,
    inventoryBaseline: merged.inventorySlots,
    armSlotsBaseline: merged.armSlots,
    staged: [],
    verification: { state: "idle" },
  });
};

describe("stageInventory", () => {
  beforeEach(() => {
    primeStoreFromLoad();
  });

  test("creates a staged edit when the value changes from baseline", async () => {
    await useSaveStore.getState().stageInventory(50);
    const staged = useSaveStore.getState().staged;
    expect(staged).toHaveLength(1);
    expect(staged[0].kind).toBe("inventory");
    if (staged[0].kind === "inventory") {
      expect(staged[0].from).toBe(18);
      expect(staged[0].to).toBe(50);
    }
    expect(useSaveStore.getState().slots?.inventorySlots).toBe(50);
  });

  test("staged edit's 'from' uses the load-time baseline, not the prior staged 'to'", async () => {
    // 18 (baseline) → 30 → 50. The visible edit should still be "18 → 50",
    // not "30 → 50", so the user can trust the displayed delta.
    await useSaveStore.getState().stageInventory(30);
    await useSaveStore.getState().stageInventory(50);
    const staged = useSaveStore.getState().staged;
    expect(staged).toHaveLength(1);
    if (staged[0].kind === "inventory") {
      expect(staged[0].from).toBe(18);
      expect(staged[0].to).toBe(50);
      expect(staged[0].label).toBe("Inventory slots: 18 → 50");
    }
  });

  test("DROPS the staged edit when the value returns to the baseline", async () => {
    // The bug we're fixing: edit then revert leaves a phantom "30 → 18"
    // staged edit even though the save is back to its original state.
    await useSaveStore.getState().stageInventory(30);
    expect(useSaveStore.getState().staged).toHaveLength(1);
    await useSaveStore.getState().stageInventory(18);
    expect(useSaveStore.getState().staged).toHaveLength(0);
    expect(useSaveStore.getState().slots?.inventorySlots).toBe(18);
  });

  test("preserves unrelated staged edits when collapsing to no-op", async () => {
    // Add an unrelated armSlots edit, then make a no-op inventory edit.
    await useSaveStore.getState().stageArmSlots(6);
    await useSaveStore.getState().stageInventory(30);
    await useSaveStore.getState().stageInventory(18); // back to baseline
    const staged = useSaveStore.getState().staged;
    expect(staged).toHaveLength(1);
    expect(staged[0].kind).toBe("armSlots");
  });
});

describe("stageArmSlots", () => {
  beforeEach(() => {
    primeStoreFromLoad();
  });

  test("creates a staged edit when the value changes from baseline", async () => {
    await useSaveStore.getState().stageArmSlots(6);
    const staged = useSaveStore.getState().staged;
    expect(staged).toHaveLength(1);
    expect(staged[0].kind).toBe("armSlots");
    if (staged[0].kind === "armSlots") {
      expect(staged[0].from).toBe(1);
      expect(staged[0].to).toBe(6);
    }
  });

  test("staged edit's 'from' uses the load-time baseline", async () => {
    await useSaveStore.getState().stageArmSlots(4);
    await useSaveStore.getState().stageArmSlots(6);
    const staged = useSaveStore.getState().staged;
    expect(staged).toHaveLength(1);
    if (staged[0].kind === "armSlots") {
      expect(staged[0].from).toBe(1);
      expect(staged[0].to).toBe(6);
      expect(staged[0].label).toBe("Hand slots: 1 → 6");
    }
  });

  test("DROPS the staged edit when the value returns to the baseline", async () => {
    await useSaveStore.getState().stageArmSlots(6);
    expect(useSaveStore.getState().staged).toHaveLength(1);
    await useSaveStore.getState().stageArmSlots(1);
    expect(useSaveStore.getState().staged).toHaveLength(0);
  });
});
