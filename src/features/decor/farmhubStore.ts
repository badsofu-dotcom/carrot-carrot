/**
 * farmhubStore v2 (Round 25, PR-152) — 9-step 인테리어 진행 상태.
 *
 * 사용자 의도:
 *   1. 외부 트리거 (R26 결정 — 도감 N마리 / 광고 / 미션) 가 `grantNext()` 호출
 *   2. pendingFurnitureId 에 step+1 의 가구 id 저장 ("보관함 도착")
 *   3. 사용자가 보관함 strip 에서 가구 탭 → `place()` → step++ / pending null
 *   4. step 8 도달 시 풀세트, grantNext 항상 fail
 *
 * 영속: localStorage `cc.farmhub.v2`
 *   { step: 0..8, pendingFurnitureId: string|null, onboardingShown: number[] }
 *
 * R22~R24 의 `cc.decor.v1` / `cc.fragment.v1` 키는 그대로 두고 무시 — 기존
 * 사용자 데이터 보존.
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import {
  FARMHUB_BY_STEP,
  FARMHUB_FINAL_STEP,
} from "./farmhubCatalog";

const STORAGE_KEY = "cc.farmhub.v2";

export type FarmhubStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface PersistShape {
  step: FarmhubStep;
  pendingFurnitureId: string | null;
  onboardingShown: number[];
}

function loadPersist(): PersistShape {
  const raw = safeStorage.get(STORAGE_KEY);
  const blank: PersistShape = {
    step: 0,
    pendingFurnitureId: null,
    onboardingShown: [],
  };
  if (!raw) return blank;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return blank;
    const step =
      typeof parsed.step === "number" &&
      parsed.step >= 0 &&
      parsed.step <= FARMHUB_FINAL_STEP
        ? (Math.floor(parsed.step) as FarmhubStep)
        : 0;
    const pendingFurnitureId =
      typeof parsed.pendingFurnitureId === "string" &&
      parsed.pendingFurnitureId.length > 0
        ? parsed.pendingFurnitureId
        : null;
    const onboardingShown = Array.isArray(parsed.onboardingShown)
      ? parsed.onboardingShown
          .filter((n: unknown): n is number => typeof n === "number")
          .map((n: number) => Math.floor(n))
      : [];
    return { step, pendingFurnitureId, onboardingShown };
  } catch {
    return blank;
  }
}

function savePersist(s: PersistShape): void {
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export interface GrantResult {
  ok: boolean;
  furnitureId?: string;
  reason?: "all_placed" | "already_pending";
}

export interface PlaceResult {
  ok: boolean;
  reason?: "no_pending";
  /** Step after place (so callers can show celebration without re-reading store). */
  newStep?: FarmhubStep;
}

interface FarmhubState {
  step: FarmhubStep;
  pendingFurnitureId: string | null;
  onboardingShown: number[];
  /** Grant next-step furniture into pending slot. */
  grantNext: () => GrantResult;
  /** User taps pending furniture in storage strip → place into room. */
  place: () => PlaceResult;
  /** Mark a step's onboarding speech as shown (no re-show). */
  markOnboardingShown: (step: number) => void;
  /** Wipe progress (dev / debug only). */
  reset: () => void;
}

export const useFarmhubStore = create<FarmhubState>((set, get) => {
  const init = loadPersist();
  return {
    step: init.step,
    pendingFurnitureId: init.pendingFurnitureId,
    onboardingShown: init.onboardingShown,

    grantNext: () => {
      const cur = get();
      if (cur.step >= FARMHUB_FINAL_STEP) {
        return { ok: false, reason: "all_placed" };
      }
      if (cur.pendingFurnitureId !== null) {
        return { ok: false, reason: "already_pending" };
      }
      const nextStep = (cur.step + 1) as FarmhubStep;
      const def = FARMHUB_BY_STEP[nextStep];
      if (!def) return { ok: false, reason: "all_placed" };
      const next: PersistShape = {
        step: cur.step,
        pendingFurnitureId: def.id,
        onboardingShown: cur.onboardingShown,
      };
      set({ pendingFurnitureId: def.id });
      savePersist(next);
      return { ok: true, furnitureId: def.id };
    },

    place: () => {
      const cur = get();
      if (cur.pendingFurnitureId === null) {
        return { ok: false, reason: "no_pending" };
      }
      const newStep = Math.min(
        FARMHUB_FINAL_STEP,
        cur.step + 1,
      ) as FarmhubStep;
      const next: PersistShape = {
        step: newStep,
        pendingFurnitureId: null,
        onboardingShown: cur.onboardingShown,
      };
      set({ step: newStep, pendingFurnitureId: null });
      savePersist(next);
      return { ok: true, newStep };
    },

    markOnboardingShown: (step) => {
      const cur = get();
      if (cur.onboardingShown.includes(step)) return;
      const onboardingShown = [...cur.onboardingShown, step];
      const next: PersistShape = {
        step: cur.step,
        pendingFurnitureId: cur.pendingFurnitureId,
        onboardingShown,
      };
      set({ onboardingShown });
      savePersist(next);
    },

    reset: () => {
      const blank: PersistShape = {
        step: 0,
        pendingFurnitureId: null,
        onboardingShown: [],
      };
      set(blank);
      savePersist(blank);
    },
  };
});
