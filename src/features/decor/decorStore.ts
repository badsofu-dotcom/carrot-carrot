/**
 * decorStore (Round 22, PR-145) — furniture inventory + placement.
 *
 * Beta scope:
 *   - Direct carrot debit on `buy()` (no separate furniture coin)
 *   - 4 outdoor slots in `farm_outdoor` room (PHASE 4)
 *   - `mushroom_house` room reserved for PHASE 5 (Round 23+)
 *
 * Persistence: localStorage `cc.decor.v1` (Set 직렬화 → string[]).
 *
 * Why this lives client-side: furniture is cosmetic, no server-side
 * economy implications. Carrots are still locally tracked; the worker
 * `/economy/grant` flow records lifetime totals but does not gate
 * spending.
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import { useFarmStore } from "../collection/farmStore";
import { FURNITURE_BY_ID } from "./catalog";
import type { BuyResult, Placement, Room, Rotation } from "./types";

const STORAGE_KEY = "cc.decor.v1";

interface PersistShape {
  owned: string[];
  placements: Placement[];
  carrotsSpent: number;
}

function loadPersist(): PersistShape {
  const raw = safeStorage.get(STORAGE_KEY);
  const blank: PersistShape = { owned: [], placements: [], carrotsSpent: 0 };
  if (!raw) return blank;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return blank;
    return {
      owned: Array.isArray(parsed.owned)
        ? parsed.owned.filter((x: unknown): x is string => typeof x === "string")
        : [],
      placements: Array.isArray(parsed.placements)
        ? (parsed.placements as Placement[]).filter(
            (p) =>
              p &&
              typeof p === "object" &&
              typeof p.furnitureId === "string" &&
              typeof p.room === "string" &&
              Number.isFinite(p.x) &&
              Number.isFinite(p.y),
          )
        : [],
      carrotsSpent:
        typeof parsed.carrotsSpent === "number" && parsed.carrotsSpent >= 0
          ? Math.floor(parsed.carrotsSpent)
          : 0,
    };
  } catch {
    return blank;
  }
}

function savePersist(state: {
  owned: Set<string>;
  placements: Placement[];
  carrotsSpent: number;
}) {
  try {
    const shape: PersistShape = {
      owned: Array.from(state.owned),
      placements: state.placements,
      carrotsSpent: state.carrotsSpent,
    };
    safeStorage.set(STORAGE_KEY, JSON.stringify(shape));
  } catch {
    /* ignore */
  }
}

interface DecorState {
  /** All furniture IDs the player owns (whether placed or not). */
  owned: Set<string>;
  /** Active placements (one row per placed instance). */
  placements: Placement[];
  /** Lifetime carrots spent on furniture (stats). */
  carrotsSpent: number;
  buy: (id: string) => BuyResult;
  /** Place an owned piece. Removes any prior placement of the same id. */
  place: (
    id: string,
    room: Room,
    x: number,
    y: number,
    rotation?: Rotation,
  ) => boolean;
  /** Remove placement (owned status preserved). */
  removePlacement: (id: string) => void;
  /** Wipe placements (owned items preserved). */
  resetPlacements: () => void;
}

export const useDecorStore = create<DecorState>((set, get) => {
  const init = loadPersist();
  return {
    owned: new Set(init.owned),
    placements: init.placements,
    carrotsSpent: init.carrotsSpent,

    buy: (id) => {
      const def = FURNITURE_BY_ID[id];
      if (!def) return { ok: false, reason: "unknown" };
      const cur = get();
      if (cur.owned.has(id)) {
        // Already owned — buy is a no-op (cosmetic — 1 of each for beta).
        return {
          ok: false,
          reason: "already_owned",
          remainingCarrots: useFarmStore.getState().carrots,
        };
      }
      const farm = useFarmStore.getState();
      if (farm.carrots < def.price) {
        return {
          ok: false,
          reason: "insufficient",
          remainingCarrots: farm.carrots,
        };
      }
      // Atomic: debit + add to owned + bump stat.
      useFarmStore.setState({ carrots: farm.carrots - def.price });
      const ownedNext = new Set(cur.owned);
      ownedNext.add(id);
      const carrotsSpentNext = cur.carrotsSpent + def.price;
      set({ owned: ownedNext, carrotsSpent: carrotsSpentNext });
      savePersist({
        owned: ownedNext,
        placements: cur.placements,
        carrotsSpent: carrotsSpentNext,
      });
      return { ok: true, remainingCarrots: farm.carrots - def.price };
    },

    place: (id, room, x, y, rotation = 0) => {
      const cur = get();
      if (!cur.owned.has(id)) return false;
      // Remove any prior placement of this id, then push new.
      const filtered = cur.placements.filter((p) => p.furnitureId !== id);
      const next: Placement[] = [
        ...filtered,
        { furnitureId: id, room, x, y, rotation },
      ];
      set({ placements: next });
      savePersist({
        owned: cur.owned,
        placements: next,
        carrotsSpent: cur.carrotsSpent,
      });
      return true;
    },

    removePlacement: (id) => {
      const cur = get();
      const next = cur.placements.filter((p) => p.furnitureId !== id);
      if (next.length === cur.placements.length) return;
      set({ placements: next });
      savePersist({
        owned: cur.owned,
        placements: next,
        carrotsSpent: cur.carrotsSpent,
      });
    },

    resetPlacements: () => {
      const cur = get();
      set({ placements: [] });
      savePersist({
        owned: cur.owned,
        placements: [],
        carrotsSpent: cur.carrotsSpent,
      });
    },
  };
});

/** Selector helper — placements scoped to a room. */
export function placementsForRoom(room: Room): Placement[] {
  return useDecorStore.getState().placements.filter((p) => p.room === room);
}
