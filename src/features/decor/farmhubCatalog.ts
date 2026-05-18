/**
 * Farmhub catalog v2 (Round 25, PR-152) — 9-step 프리렌더 인테리어.
 *
 * R22~R24 의 데코 v1 (catalog 22 가구 + 좌표 그리드 + fragmentStore +
 * golden_carrot_statue) 폐기. 사용자가 직접 합성한 9 step 배경 + 8
 * 가구 sprite 로 극단적 단순화:
 *
 *   step 0 = 빈 방        (시작)
 *   step 1 = + 카펫
 *   step 2 = + 침대
 *   step 3 = + 테이블
 *   step 4 = + 책장
 *   step 5 = + 화분
 *   step 6 = + 서랍
 *   step 7 = + 보관함
 *   step 8 = + 스툴 의자 (풀세트 완성)
 *
 * 배경은 step 별로 미리 합성된 .jpg 한 장. 좌표/그리드/Sprite union 없음.
 * 가구 sprite (items/*.png) 는 보관함 strip 에서만 보임.
 *
 * 자산: public/assets/decor/farmhub/
 *   bg/   — bg_farmhub_0..8.jpg (9 파일, 합 ~2.4MB)
 *   items/— farmhub_{name}_{step}.png (8 파일, 합 ~740KB)
 *
 * R32 PR-182 — 다통화 결제 인프라.
 *   `price: { currency, amount }` 필드 추가. 기존 8개 가구는 모두
 *   `currency: "carrot"` 으로 유지 (기존 선형 50~400 가격 그대로). 신규
 *   프리미엄 가구 (candy/golden 결제) 는 추후 신규 맵 도입 시점에
 *   `price: { currency: "candy", amount: ... }` 형태로 한 줄 추가만으로
 *   buyNextStep / BuyFurnitureModal 이 자동 작동.
 */

export type FarmhubCurrency = "carrot" | "candy" | "golden";

export interface FarmhubPrice {
  currency: FarmhubCurrency;
  amount: number;
}

export interface FarmhubFurniture {
  /** 안정 식별자 (저장 / pendingFurnitureId). */
  id: string;
  /** 사용자 노출 이름. */
  name: string;
  /** 1~8 — 어느 step 에서 unlock 되는지. step==0 은 빈 방. */
  step: number;
  /** 가구 누끼 PNG 경로 (BASE_URL prefix 없이 절대 — vite 가 호스팅). */
  sprite: string;
  /**
   * R32 PR-182 — 결제 통화 + 가격.
   *   carrot : 일반 가구 (기존 8개)
   *   candy  : 프리미엄 가구 (추후 신규 맵)
   *   golden : 프리미엄 가구 (추후 신규 맵)
   */
  price: FarmhubPrice;
}

export const FARMHUB_FURNITURE: ReadonlyArray<FarmhubFurniture> = [
  { id: "carpet",     name: "원형 카펫",       step: 1, sprite: "/assets/decor/farmhub/items/farmhub_carpet_1.png",         price: { currency: "carrot", amount:  50 } },
  { id: "bed",        name: "패치워크 침대",   step: 2, sprite: "/assets/decor/farmhub/items/farmhub_bed_2.png",            price: { currency: "carrot", amount: 100 } },
  { id: "table",      name: "원형 테이블",     step: 3, sprite: "/assets/decor/farmhub/items/farmhub_table_3.png",          price: { currency: "carrot", amount: 150 } },
  { id: "bookcase",   name: "책장",            step: 4, sprite: "/assets/decor/farmhub/items/farmhub_bookcase_4.png",       price: { currency: "carrot", amount: 200 } },
  { id: "pot",        name: "화분",            step: 5, sprite: "/assets/decor/farmhub/items/farmhub_pot_5.png",            price: { currency: "carrot", amount: 250 } },
  { id: "drawer",     name: "서랍장",          step: 6, sprite: "/assets/decor/farmhub/items/farmhub_drawer_6.png",         price: { currency: "carrot", amount: 300 } },
  { id: "storagebox", name: "장난감 상자",     step: 7, sprite: "/assets/decor/farmhub/items/farmhub_storagebox_7.png",     price: { currency: "carrot", amount: 350 } },
  { id: "stoolchair", name: "스툴 의자",       step: 8, sprite: "/assets/decor/farmhub/items/farmhub_stoolchair_8.png",     price: { currency: "carrot", amount: 400 } },
];

/** step (0..8) → bg image URL. step 0 은 빈 방. */
export function FARMHUB_BG(step: number): string {
  const clamped = Math.max(0, Math.min(8, Math.floor(step)));
  return `/assets/decor/farmhub/bg/bg_farmhub_${clamped}.jpg`;
}

/** id → entry 조회. */
export const FARMHUB_BY_ID: Readonly<Record<string, FarmhubFurniture>> =
  Object.freeze(
    Object.fromEntries(FARMHUB_FURNITURE.map((f) => [f.id, f])),
  );

/** step → entry 조회 (step 0 은 undefined — 빈 방). */
export const FARMHUB_BY_STEP: Readonly<Record<number, FarmhubFurniture>> =
  Object.freeze(
    Object.fromEntries(FARMHUB_FURNITURE.map((f) => [f.step, f])),
  );

/** 모든 가구 배치 완료 step 값. */
export const FARMHUB_FINAL_STEP = 8;
