/**
 * Farmhub 가구 step 별 가격표 (R27 PHASE 2.A → R32 PR-182 catalog SoT).
 *
 * R26 PHASE 2 의 "도감 N마리 자동 지급" 흐름 폐기 (R27 PHASE 2.E):
 *   [도감 N마리 unlock] → [구매 자격 해금] → [당근 N개로 구매]
 *
 * R32 PR-182 — 카탈로그 (`farmhubCatalog.FARMHUB_FURNITURE[i].price`)
 * 가 가격 SoT. 본 모듈은 carrot-currency 가구의 step→amount 매핑을
 * derive 해 노출하는 back-compat shim. 다통화 결제 진입점은 catalog
 * 직접 읽기 (`FARMHUB_BY_STEP[step].price`) 권장.
 */
import { FARMHUB_FURNITURE } from "./farmhubCatalog";

/**
 * 카탈로그에서 derive 한 carrot 가구의 step→amount 매핑.
 * candy/golden 결제 가구는 본 객체에서 제외 (carrot 가구만).
 */
export const FARMHUB_PRICES: Readonly<Record<number, number>> = Object.freeze(
  Object.fromEntries(
    FARMHUB_FURNITURE.filter((f) => f.price.currency === "carrot").map(
      (f) => [f.step, f.price.amount],
    ),
  ),
);

export const FARMHUB_PRICE_TOTAL = Object.values(FARMHUB_PRICES).reduce(
  (a, b) => a + b,
  0,
);

/**
 * step (1..8) → 당근 가격. 범위 밖 / 카탈로그 누락 / carrot 가 아닌
 * 통화 → null.
 *
 * @deprecated R32 PR-182 — 다통화 결제 도입. 신규 코드는
 * `FARMHUB_BY_STEP[step]?.price` 를 직접 읽어 `{ currency, amount }`
 * 페어로 처리할 것. 본 함수는 carrot 통화 가구만 amount 반환.
 */
export function getFurniturePrice(step: number): number | null {
  if (!Number.isFinite(step)) return null;
  const k = Math.floor(step);
  if (k < 1 || k > 8) return null;
  return FARMHUB_PRICES[k] ?? null;
}
