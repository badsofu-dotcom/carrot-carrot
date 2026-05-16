/**
 * Buffs store — one-shot consumable modifiers applied by bag items.
 *
 * Today's buffs (used by InventoryModal "사용" → buff activator):
 *   - `juice` (PR-8) — next harvest gacha gets +5%p candy rate.
 *   - `soup`  (PR-9, planned) — next watering-can refill grants +1
 *     charge over normal max.
 *   - `cake`  (PR-10, planned) — next focus completion grants +1 seed.
 *
 * Buffs are boolean flags here; their consumers (`FarmHub` harvest
 * path, `toolStore.refillFromAd`, focus-completion handler) read +
 * clear the flag at their trigger point.
 *
 * Persistence via `safeStorage` so a tab reload doesn't lose an
 * activated buff. The whole shape is tiny — single JSON object.
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";

export type BuffKind = "juice" | "soup" | "cake";

const STORAGE_KEY = "cc.buffs.v1";

interface BuffsState {
  juiceActive: boolean;
  soupActive: boolean;
  cakeActive: boolean;
  activate: (kind: BuffKind) => void;
  /** Atomically read+clear. Returns true iff the flag was set. */
  consume: (kind: BuffKind) => boolean;
  reset: () => void;
}

interface Persisted {
  j?: boolean;
  s?: boolean;
  c?: boolean;
}

function load(): Persisted {
  const raw = safeStorage.get(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Persisted;
  } catch {
    /* corrupted, reset */
  }
  return {};
}

function save(state: BuffsState) {
  const out: Persisted = {
    j: state.juiceActive || undefined,
    s: state.soupActive || undefined,
    c: state.cakeActive || undefined,
  };
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* ignore */
  }
}

export const useBuffsStore = create<BuffsState>((set, get) => {
  const init = load();
  return {
    juiceActive: !!init.j,
    soupActive: !!init.s,
    cakeActive: !!init.c,

    activate: (kind) => {
      const next = { ...get() };
      if (kind === "juice") next.juiceActive = true;
      else if (kind === "soup") next.soupActive = true;
      else if (kind === "cake") next.cakeActive = true;
      set(next);
      save(get());
    },

    consume: (kind) => {
      const cur = get();
      const flag =
        kind === "juice"
          ? cur.juiceActive
          : kind === "soup"
            ? cur.soupActive
            : cur.cakeActive;
      if (!flag) return false;
      if (kind === "juice") set({ juiceActive: false });
      else if (kind === "soup") set({ soupActive: false });
      else set({ cakeActive: false });
      save(get());
      return true;
    },

    reset: () => {
      set({ juiceActive: false, soupActive: false, cakeActive: false });
      save(get());
    },
  };
});
