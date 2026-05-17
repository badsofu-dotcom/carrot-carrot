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

export interface Furniture {
  id: string;
  name: string;
  category: FurnitureCategory;
  /** Cost in 당근 (carrot). Direct debit from farmStore.carrots. */
  price: number;
  rarity: FurnitureRarity;
  sprite: Sprite;
  /** Grid footprint. PHASE 4 (outdoor) uses 4 fixed slots — size is
   *  metadata only; PHASE 5 (indoor) uses size for grid collision. */
  size: { w: number; h: number };
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
