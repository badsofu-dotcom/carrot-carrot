/**
 * decor types (Round 22, PR-145).
 */

export type FurnitureCategory = "indoor" | "outdoor" | "seasonal";
export type FurnitureRarity = "common" | "rare" | "epic";
export type Room = "mushroom_house" | "farm_outdoor";
export type Rotation = 0 | 90 | 180 | 270;

export interface Furniture {
  id: string;
  name: string;
  category: FurnitureCategory;
  /** Cost in 당근 (carrot). Direct debit from farmStore.carrots. */
  price: number;
  rarity: FurnitureRarity;
  /** Emoji placeholder for beta. Replace with image asset in Round 23+. */
  sprite: string;
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
