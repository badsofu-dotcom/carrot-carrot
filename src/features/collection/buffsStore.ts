/**
 * Buffs store — one-shot consumable modifiers applied by bag items.
 *
 * Buffs:
 *   - `juice` (PR-8): next harvest gacha gets +5%p candy.
 *   - `soup`  (PR-9): next watering-can refill grants +1 charge.
 *   - `cake`  (PR-10): next focus completion grants +1 seed.
 *
 * PR-59 — expiresAt 도입. 활성 후 `BUFF_META.durationMs` 안에 trigger
 * 일어나지 않으면 자동 만료. `consume` / `isActive` / `remainingMs` 가
 * 호출 시 expiresAt 검사로 self-clear. BuffChip 의 1초 tick 이
 * `pruneExpired` 로 stale timestamp 청소.
 *
 * Trigger 사이트 (기존 그대로):
 *   - `juice`: FarmHub harvest path
 *   - `soup` : AdRewardChannelModal watering / InventoryModal bolt
 *   - `cake` : HomePage focus-complete (≥5분 valid)
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import { BUFF_META } from "../buffs/buffEffects";

export type BuffKind = "juice" | "soup" | "cake" | "heart";

const STORAGE_KEY = "cc.buffs.v2";

interface BuffsState {
  /** 만료 epoch ms. 0 = 비활성. */
  juiceExpiresAt: number;
  soupExpiresAt: number;
  cakeExpiresAt: number;
  /** R33 PR-191 — heart buff: 다음 수확 candy +10%p. */
  heartExpiresAt: number;

  activate: (kind: BuffKind) => void;
  /** Atomically read+clear. active 면 true + clear; expired 면 false + clear. */
  consume: (kind: BuffKind) => boolean;
  isActive: (kind: BuffKind) => boolean;
  remainingMs: (kind: BuffKind) => number;
  /** Expired timestamp 들을 0 으로 정리 (BuffChip tick 이 호출). */
  pruneExpired: () => void;
  reset: () => void;
}

interface Persisted {
  je?: number;
  se?: number;
  ce?: number;
  he?: number;
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
    je: state.juiceExpiresAt || undefined,
    se: state.soupExpiresAt || undefined,
    ce: state.cakeExpiresAt || undefined,
    he: state.heartExpiresAt || undefined,
  };
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* ignore */
  }
}

function fieldOf(
  kind: BuffKind,
): "juiceExpiresAt" | "soupExpiresAt" | "cakeExpiresAt" | "heartExpiresAt" {
  if (kind === "juice") return "juiceExpiresAt";
  if (kind === "soup") return "soupExpiresAt";
  if (kind === "cake") return "cakeExpiresAt";
  return "heartExpiresAt";
}

export const useBuffsStore = create<BuffsState>((set, get) => {
  const init = load();
  const now = Date.now();
  // 부팅 시 이미 만료된 timestamp 는 0 으로 reset.
  const safeJ = init.je && init.je > now ? init.je : 0;
  const safeS = init.se && init.se > now ? init.se : 0;
  const safeC = init.ce && init.ce > now ? init.ce : 0;
  const safeH = init.he && init.he > now ? init.he : 0;
  return {
    juiceExpiresAt: safeJ,
    soupExpiresAt: safeS,
    cakeExpiresAt: safeC,
    heartExpiresAt: safeH,

    activate: (kind) => {
      const expiresAt = Date.now() + BUFF_META[kind].durationMs;
      const field = fieldOf(kind);
      set({ [field]: expiresAt } as Partial<BuffsState>);
      save(get());
    },

    consume: (kind) => {
      const field = fieldOf(kind);
      const current = get()[field];
      const expired = !current || current <= Date.now();
      if (expired) {
        if (current) {
          set({ [field]: 0 } as Partial<BuffsState>);
          save(get());
        }
        return false;
      }
      set({ [field]: 0 } as Partial<BuffsState>);
      save(get());
      return true;
    },

    isActive: (kind) => {
      const v = get()[fieldOf(kind)];
      return !!v && v > Date.now();
    },

    remainingMs: (kind) => {
      const v = get()[fieldOf(kind)];
      if (!v) return 0;
      return Math.max(0, v - Date.now());
    },

    pruneExpired: () => {
      const now = Date.now();
      const s = get();
      const patch: Partial<BuffsState> = {};
      if (s.juiceExpiresAt && s.juiceExpiresAt <= now)
        patch.juiceExpiresAt = 0;
      if (s.soupExpiresAt && s.soupExpiresAt <= now)
        patch.soupExpiresAt = 0;
      if (s.cakeExpiresAt && s.cakeExpiresAt <= now)
        patch.cakeExpiresAt = 0;
      if (s.heartExpiresAt && s.heartExpiresAt <= now)
        patch.heartExpiresAt = 0;
      if (Object.keys(patch).length > 0) {
        set(patch);
        save(get());
      }
    },

    reset: () => {
      set({
        juiceExpiresAt: 0,
        soupExpiresAt: 0,
        cakeExpiresAt: 0,
        heartExpiresAt: 0,
      });
      save(get());
    },
  };
});
