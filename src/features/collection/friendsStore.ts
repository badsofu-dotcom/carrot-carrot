/**
 * Friends store — caches today's visitor bunny + wave state.
 *
 * Runtime-only (no localStorage). Hydrated from `/friends/today` on
 * FarmHub mount. The KST day boundary is the only invalidation hook
 * — when the date rolls over, the next mount fetches a fresh visitor.
 *
 * Wave action mirrors the server: marks the visitor `waved: true` and
 * increments the local `heart` item count optimistically so the bag
 * badge updates without waiting for the round-trip.
 */
import { create } from "zustand";
import { apiCall, apiBaseUrl, tokenStore } from "../../lib/api";
import { useItemsStore } from "./itemsStore";

export interface VisitorState {
  /** Bunny id from the worker's VISITOR_POOL (matches CHARACTER_BY_ID keys). */
  bunnyId: string;
  /** KST ymd "YYYY-MM-DD". */
  ymd: string;
  /** True once the user has waved today. */
  waved: boolean;
  /** Hearts gained on the wave (server-confirmed). null until first wave. */
  heartsGained: number | null;
}

interface FriendsState {
  visitor: VisitorState | null;
  /** True once the initial fetch has resolved (ok or noop). */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  wave: () => Promise<{ ok: true; hearts: number } | { ok: false; reason: string }>;
}

interface RemoteTodayPayload {
  visitor_bunny_id: string;
  ymd: string;
  waved: boolean;
  hearts_gained: number | null;
}

interface RemoteWavePayload {
  visitor_bunny_id: string;
  hearts_gained: number;
  already_waved: boolean;
}

function canCallServer(): boolean {
  if (!apiBaseUrl()) return false;
  if (!tokenStore.getAccess()) return false;
  return true;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  visitor: null,
  hydrated: false,

  hydrate: async () => {
    if (!canCallServer()) {
      set({ hydrated: true });
      return;
    }
    const r = await apiCall<RemoteTodayPayload>("/friends/today", { method: "GET" });
    if (r.ok) {
      set({
        visitor: {
          bunnyId: r.data.visitor_bunny_id,
          ymd: r.data.ymd,
          waved: r.data.waved,
          heartsGained: r.data.hearts_gained,
        },
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  wave: async () => {
    const cur = get().visitor;
    if (cur?.waved) {
      return { ok: false, reason: "already_waved" };
    }
    if (!canCallServer()) {
      // Optimistic offline path: mark waved + increment locally. The
      // server will reconcile on next hydrate.
      if (cur) {
        set({
          visitor: { ...cur, waved: true, heartsGained: 1 },
        });
        useItemsStore.getState().add("heart", 1);
        return { ok: true, hearts: 1 };
      }
      return { ok: false, reason: "no_visitor" };
    }
    const r = await apiCall<RemoteWavePayload>("/friends/wave", {
      method: "POST",
      body: {},
    });
    if (!r.ok) {
      return { ok: false, reason: r.error.code };
    }
    // Even when the server reports `already_waved: true`, we still mark
    // local state waved so subsequent taps short-circuit.
    if (cur) {
      set({
        visitor: {
          ...cur,
          waved: true,
          heartsGained: r.data.hearts_gained,
        },
      });
    }
    if (!r.data.already_waved) {
      useItemsStore.getState().add("heart", r.data.hearts_gained);
    }
    return { ok: true, hearts: r.data.hearts_gained };
  },
}));
