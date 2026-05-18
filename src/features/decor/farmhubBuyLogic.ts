/**
 * farmhubStore.buyNextStep 결정 로직 — 순수 함수 (R27 PHASE 2.B → R32 PR-182).
 *
 * 의도:
 *   - zustand 의존을 피해 단위 테스트 가능 (`node --test` + esbuild loadTs)
 *   - buyNextStep 의 모든 fail reason 을 한 자리에 모음
 *
 * 호출 시점: 사용자가 BuyFurnitureModal 의 "✨ 구매하기" 버튼 탭.
 *
 * R32 PR-182 — 다통화 결제:
 *   카탈로그의 `price.currency` 값 (carrot / candy / golden) 에 따라
 *   해당 통화 잔액을 검사 + 통과 시 BuyEval.currency 로 반환. 호출자
 *   (farmhubStore.buyNextStep) 가 적절한 spendXxxCarrots 액션을
 *   dispatch.
 */
import {
  FARMHUB_FINAL_STEP,
  FARMHUB_BY_STEP,
  type FarmhubCurrency,
} from "./farmhubCatalog";

export type BuyReason =
  | "max_step"
  | "already_pending"
  | "step_locked"
  | "insufficient_carrot"
  | "insufficient_candy"
  | "insufficient_golden";

export interface BuyEval {
  ok: boolean;
  reason?: BuyReason;
  /** 통과 시: 구매 대상 step (현재 step + 1). */
  targetStep?: number;
  /** 통과 시: 가구 id. */
  furnitureId?: string;
  /** 통과 시: 차감 가격 (amount). */
  price?: number;
  /** 통과 시: 차감 통화 (R32 PR-182). */
  currency?: FarmhubCurrency;
}

export interface BuyContext {
  /** 현재 farmhubStore.step (0..8). */
  step: number;
  /** 현재 farmhubStore.pendingFurnitureId. */
  pendingFurnitureId: string | null;
  /** 현재 도감 보유 마릿수 (collectionStore 등). */
  dogamCount: number;
  /** 현재 farmStore.carrots (당근 잔액). */
  carrots: number;
  /** R32 PR-182 — 캔디당근 잔액. 기존 carrot 가구 경로에서는 미사용. */
  candyCarrots?: number;
  /** R32 PR-182 — 황금당근 잔액. 기존 carrot 가구 경로에서는 미사용. */
  goldenCarrots?: number;
}

/**
 * R32 PR-182 — 통화 + 가격 + 잔액 매핑 검사. 순수 함수.
 *
 * @returns 통과 시 null, 부족 시 해당 통화의 insufficient reason.
 */
export function checkBalance(
  currency: FarmhubCurrency,
  amount: number,
  balances: { carrots: number; candyCarrots: number; goldenCarrots: number },
): BuyReason | null {
  switch (currency) {
    case "carrot":
      return balances.carrots < amount ? "insufficient_carrot" : null;
    case "candy":
      return balances.candyCarrots < amount ? "insufficient_candy" : null;
    case "golden":
      return balances.goldenCarrots < amount ? "insufficient_golden" : null;
  }
}

/**
 * buyNextStep 통과 여부 평가.
 * 우선순위: max_step → already_pending → step_locked → insufficient_*.
 *
 * dogamCount 조건: 다음 step 을 사려면 도감 N마리 (N >= targetStep) 보유.
 * 즉 step 1 사려면 1마리, step 8 사려면 8마리.
 *
 * "dogamCount <= step (도감 자격 부족)" 의 의미:
 *   현재 step 보다 도감이 더 많이 모여야 다음 step unlock.
 *   → 다음 step (= step + 1) 자격: dogamCount >= step + 1, 즉 dogamCount > step.
 */
export function evaluateBuyNextStep(ctx: BuyContext): BuyEval {
  const { step, pendingFurnitureId, dogamCount, carrots } = ctx;
  const candyCarrots = ctx.candyCarrots ?? 0;
  const goldenCarrots = ctx.goldenCarrots ?? 0;

  if (step >= FARMHUB_FINAL_STEP) {
    return { ok: false, reason: "max_step" };
  }
  if (pendingFurnitureId !== null) {
    return { ok: false, reason: "already_pending" };
  }

  const targetStep = step + 1;
  // 도감 자격 — targetStep 만큼 도감 모았는지.
  if (dogamCount < targetStep) {
    return { ok: false, reason: "step_locked" };
  }

  const def = FARMHUB_BY_STEP[targetStep];
  if (!def) {
    // 카탈로그 누락 — 방어. 정상 흐름에서 발생 X.
    return { ok: false, reason: "max_step" };
  }

  const { currency, amount } = def.price;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "max_step" };
  }

  const insufficient = checkBalance(currency, amount, {
    carrots,
    candyCarrots,
    goldenCarrots,
  });
  if (insufficient !== null) {
    return { ok: false, reason: insufficient };
  }

  return {
    ok: true,
    targetStep,
    furnitureId: def.id,
    price: amount,
    currency,
  };
}
