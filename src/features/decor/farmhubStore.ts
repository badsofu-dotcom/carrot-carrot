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
import { useFarmStore } from "../collection/farmStore";
import { useCollectionStore } from "../collection/collectionStore";
import {
  evaluateBuyNextStep,
  type BuyEval,
  type BuyReason,
} from "./farmhubBuyLogic";

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

export interface BuyResult {
  ok: boolean;
  reason?: BuyReason;
  /** 통과 시: 차감된 가격. */
  spent?: number;
  /** 통과 시: 보관함에 입고된 가구 id. */
  furnitureId?: string;
}

interface FarmhubState {
  step: FarmhubStep;
  pendingFurnitureId: string | null;
  onboardingShown: number[];
  /** Grant next-step furniture into pending slot. */
  grantNext: () => GrantResult;
  /**
   * R27 PHASE 2.B — 사용자가 BuyFurnitureModal 의 "✨ 구매하기" 탭.
   * 도감 자격 + 당근 잔액 + pending/max 가드 통과 시 farmStore 에서
   * 가격만큼 당근 차감 + pendingFurnitureId 설정 (한 트랜잭션, 실패
   * 시 farmStore 변경 X).
   *
   * 도감 자격 (dogamCount) 은 useCollectionStore 에서 직접 읽음.
   */
  buyNextStep: () => BuyResult;
  /**
   * R27 PHASE 3 — DEV 치트. 가격 무시 + 도감 자격 무시 + pending
   * 무시하고 다음 step 의 가구를 보관함에 즉시 입고. step 8 도달 시
   * no-op. production 빌드에서 IS_DEV 가드로 차단되어야 함 (호출처
   * 책임).
   */
  devGrantFreeNext: () => GrantResult;
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

    buyNextStep: () => {
      const cur = get();
      const dogamCount =
        useCollectionStore.getState().ownedCharacters.length;
      const farm = useFarmStore.getState();
      const evalResult: BuyEval = evaluateBuyNextStep({
        step: cur.step,
        pendingFurnitureId: cur.pendingFurnitureId,
        dogamCount,
        carrots: farm.carrots,
        candyCarrots: farm.candyCarrots,
        goldenCarrots: farm.goldenCarrots,
      });
      if (
        !evalResult.ok ||
        !evalResult.furnitureId ||
        !evalResult.price ||
        !evalResult.currency
      ) {
        return { ok: false, reason: evalResult.reason };
      }
      // R32 PR-182 — currency 별 spend dispatch. Atomic — race 로 false
      // 면 (불가 — 같은 tick), pending 도 설정 X.
      const farmActions = useFarmStore.getState();
      const debited = (() => {
        switch (evalResult.currency) {
          case "carrot":
            return farmActions.spendCarrots(evalResult.price);
          case "candy":
            return farmActions.spendCandyCarrots(evalResult.price);
          case "golden":
            return farmActions.spendGoldenCarrots(evalResult.price);
        }
      })();
      if (!debited) {
        const fallback: BuyReason =
          evalResult.currency === "candy"
            ? "insufficient_candy"
            : evalResult.currency === "golden"
              ? "insufficient_golden"
              : "insufficient_carrot";
        return { ok: false, reason: fallback };
      }
      const next: PersistShape = {
        step: cur.step,
        pendingFurnitureId: evalResult.furnitureId,
        onboardingShown: cur.onboardingShown,
      };
      set({ pendingFurnitureId: evalResult.furnitureId });
      savePersist(next);
      return {
        ok: true,
        spent: evalResult.price,
        furnitureId: evalResult.furnitureId,
      };
    },

    devGrantFreeNext: () => {
      const cur = get();
      if (cur.step >= FARMHUB_FINAL_STEP) {
        return { ok: false, reason: "all_placed" };
      }
      if (cur.pendingFurnitureId !== null) {
        // pending 이 있으면 자동 place 후 다음 step grant.
        const placedStep = Math.min(
          FARMHUB_FINAL_STEP,
          cur.step + 1,
        ) as FarmhubStep;
        if (placedStep >= FARMHUB_FINAL_STEP) {
          const final: PersistShape = {
            step: placedStep,
            pendingFurnitureId: null,
            onboardingShown: cur.onboardingShown,
          };
          set({ step: placedStep, pendingFurnitureId: null });
          savePersist(final);
          return { ok: false, reason: "all_placed" };
        }
        const targetStep = (placedStep + 1) as FarmhubStep;
        const def = FARMHUB_BY_STEP[targetStep];
        if (!def) return { ok: false, reason: "all_placed" };
        const next: PersistShape = {
          step: placedStep,
          pendingFurnitureId: def.id,
          onboardingShown: cur.onboardingShown,
        };
        set({ step: placedStep, pendingFurnitureId: def.id });
        savePersist(next);
        return { ok: true, furnitureId: def.id };
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
