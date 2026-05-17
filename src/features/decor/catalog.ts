/**
 * Furniture catalog (Round 22, PR-145) — 22 items × 3 categories.
 *
 * Sprites are emoji placeholders for beta; replace with proper PNG/SVG
 * before public launch (TODO Round 23+).
 *
 * Pricing units: 당근 (carrot). Beta uses direct carrot debit (no
 * separate furniture coin) per Round 22 PHASE 1 Q5=A.
 *
 * Grid units (size.w / size.h): 1 = ~32px logical (outdoor slots), so
 * a 2×1 furniture spans two adjacent slot widths. Indoor placement uses
 * a 6×4 grid in PHASE 5 — for now `size` is metadata only.
 */

import type { Furniture, FurnitureCategory, FurnitureRarity } from "./types";

function f(
  id: string,
  name: string,
  category: FurnitureCategory,
  price: number,
  rarity: FurnitureRarity,
  sprite: string,
  w = 1,
  h = 1,
): Furniture {
  return { id, name, category, price, rarity, sprite, size: { w, h } };
}

export const FURNITURE_CATALOG: ReadonlyArray<Furniture> = [
  // ── 실내 (10) ──────────────────────────────────────────────
  f("desk", "책상", "indoor", 30, "common", "🪑", 2, 1),
  f("chair", "의자", "indoor", 25, "common", "💺", 1, 1),
  f("bed", "침대", "indoor", 80, "common", "🛏️", 2, 2),
  f("carpet", "카페트", "indoor", 50, "common", "🟫", 2, 2),
  f("frame", "액자", "indoor", 40, "common", "🖼️", 1, 1),
  f("bookshelf", "책장", "indoor", 70, "rare", "📚", 2, 2),
  f("plant", "화분", "indoor", 35, "common", "🪴", 1, 1),
  f("lamp", "램프", "indoor", 45, "common", "💡", 1, 1),
  f("tv", "TV", "indoor", 120, "rare", "📺", 2, 1),
  f("teddy", "곰인형", "indoor", 60, "common", "🧸", 1, 1),

  // ── 야외 (8) ──────────────────────────────────────────────
  f("scarecrow", "허수아비", "outdoor", 50, "common", "🪖", 1, 2),
  f("totem", "토템", "outdoor", 100, "rare", "🗿", 1, 2),
  f("well", "우물", "outdoor", 150, "rare", "🕳️", 2, 2),
  f("bench", "벤치", "outdoor", 70, "common", "🪑", 2, 1),
  f("windmill", "풍차", "outdoor", 200, "epic", "🌀", 2, 3),
  f("balloon", "풍선", "outdoor", 30, "common", "🎈", 1, 1),
  f("mailbox", "우편함", "outdoor", 40, "common", "📮", 1, 1),
  f("stone", "비석", "outdoor", 80, "rare", "🪦", 1, 2),

  // ── 계절 (4, placeholder) ─────────────────────────────────
  f("xmas_tree", "크리스마스 트리", "seasonal", 200, "epic", "🎄", 2, 3),
  f("autumn_leaves", "단풍 잎 더미", "seasonal", 100, "rare", "🍁", 2, 1),
  f("pumpkin", "호박", "seasonal", 80, "rare", "🎃", 1, 1),
  f("cherry_blossom", "벚꽃", "seasonal", 150, "rare", "🌸", 2, 2),
];

export const FURNITURE_BY_ID: Readonly<Record<string, Furniture>> = Object.freeze(
  Object.fromEntries(FURNITURE_CATALOG.map((it) => [it.id, it])),
);
