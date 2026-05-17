/**
 * decor types (Round 22, PR-145).
 */

export type FurnitureCategory = "indoor" | "outdoor" | "seasonal";
export type FurnitureRarity = "common" | "rare" | "epic";
export type Room = "mushroom_house" | "farm_outdoor";
export type Rotation = 0 | 90 | 180 | 270;

/**
 * Sprite source — beta uses emoji placeholders; R24+ assets will be
 * PNG paths under `public/assets/decor/furniture/`. Renderer (FurnitureShopModal
 * / OutdoorSlots) discriminates on `kind`.
 */
export type Sprite =
  | { kind: "emoji"; value: string }
  | { kind: "image"; src: string };

/**
 * Round 24 (PR-150) — unlock 조건 추가. unlockCondition 이 있는 가구는
 * 일반 구매 불가 ("price" 는 표시용). 도감 100% 같은 게이트 통과 시
 * `grantReward()` 가 owned 에 자동 추가.
 *   - "dogam_100": 도감 12/12 (CHARACTERS.length) 도달 시 1회 무료
 *   - "fragment_only": fragmentStore.exchange() 로만 (Round 24 PHASE 2)
 */
export type UnlockCondition = "dogam_100" | "fragment_only";

export interface Furniture {
  id: string;
  name: string;
  category: FurnitureCategory;
  /** Cost in 당근 (carrot). Direct debit from farmStore.carrots.
   *  unlockCondition 가 있는 entry 는 표시용 (구매 시도 거부됨). */
  price: number;
  rarity: FurnitureRarity;
  sprite: Sprite;
  /** Grid footprint. PHASE 4 (outdoor) uses 4 fixed slots — size is
   *  metadata only; PHASE 5 (indoor) uses size for grid collision. */
  size: { w: number; h: number };
  /** 해금 조건 (있으면 일반 구매 차단). */
  unlockCondition?: UnlockCondition;
}

export interface Placement {
  furnitureId: string;
  room: Room;
  /** Outdoor: slot index 0..3. Indoor: top-left grid cell. */
  x: number;
  y: number;
  rotation: Rotation;
}

export interface BuyResult {
  ok: boolean;
  /** Reason on failure: insufficient / unknown / already_owned. */
  reason?: "insufficient" | "unknown" | "already_owned";
  remainingCarrots?: number;
}
