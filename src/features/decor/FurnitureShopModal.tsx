/**
 * FurnitureShopModal (Round 22, PR-145) — 가구 카탈로그 + 구매 UI.
 *
 * 진입점:
 *   - RewardsPanel "🛋️ 가구 상점 열기" 버튼
 *   - 야외 빈 슬롯 탭 (FarmHub)
 *   - 이벤트: `cc:furniture-shop:open`
 *
 * 베타 스코프:
 *   - 카테고리 탭 3 (실내 / 야외 / 계절)
 *   - 각 가구 카드: sprite + 이름 + 가격 + 상태 (보유/부족/구매가능)
 *   - 구매 클릭 → confirm 토스트 → 즉시 owned 에 추가
 *   - 배치 UI 는 PHASE 4-B (야외 빈 슬롯) 또는 PHASE 5 (실내) 에서 별도
 *     트리거. 본 모달은 인벤토리(구매) 만 책임.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BottomSheet, toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";
import { useFarmStore } from "../collection/farmStore";
import { useDecorStore } from "./decorStore";
import { FURNITURE_CATALOG } from "./catalog";
import { SpriteView } from "./SpriteView";
import type { Furniture, FurnitureCategory } from "./types";

export const FURNITURE_SHOP_OPEN_EVENT = "cc:furniture-shop:open";

const TAB_LABELS: Record<FurnitureCategory, string> = {
  indoor: "실내",
  outdoor: "야외",
  seasonal: "계절",
};

interface FurnitureShopModalProps {
  /** Optional initial category (e.g. opening from outdoor slot focuses 야외). */
  initialCategory?: FurnitureCategory;
}

export function FurnitureShopModal({
  initialCategory,
}: FurnitureShopModalProps = {}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FurnitureCategory>(
    initialCategory ?? "outdoor",
  );
  const carrots = useFarmStore((s) => s.carrots);
  const owned = useDecorStore((s) => s.owned);
  const buy = useDecorStore((s) => s.buy);

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ category?: FurnitureCategory }>)
        .detail;
      if (detail?.category) setCategory(detail.category);
      setOpen(true);
    };
    window.addEventListener(FURNITURE_SHOP_OPEN_EVENT, onOpen);
    return () =>
      window.removeEventListener(FURNITURE_SHOP_OPEN_EVENT, onOpen);
  }, []);

  const items = FURNITURE_CATALOG.filter((f) => f.category === category);

  const handleBuy = (it: Furniture) => {
    haptic("medium");
    const r = buy(it.id);
    if (!r.ok) {
      if (r.reason === "insufficient") {
        toast(`🥕 당근이 부족해요 (필요 ${it.price}, 보유 ${r.remainingCarrots})`);
      } else if (r.reason === "already_owned") {
        toast("이미 보유 중");
      } else {
        toast("문제가 발생했어요. 다시 시도해주세요.");
      }
      return;
    }
    // PR-145 베타 UX: 야외 구매 시 첫 빈 슬롯에 자동 배치. 실내/계절은
    // PHASE 5 (Round 23+) 에서 배치 그리드 wire 예정 — 우선 인벤토리만.
    if (it.category === "outdoor") {
      const placements = useDecorStore.getState().placements;
      for (let i = 0; i < 4; i++) {
        const occupied = placements.some(
          (p) => p.room === "farm_outdoor" && p.x === i,
        );
        if (!occupied) {
          useDecorStore.getState().place(it.id, "farm_outdoor", i, 0);
          toast(`🛒 ${it.name} 구매 + 슬롯 ${i + 1} 자동 배치 — 🥕 ${r.remainingCarrots} 남음`);
          return;
        }
      }
      toast(`🛒 ${it.name} 구매 — 야외 슬롯 가득 참, 기존 가구 탭해서 제거 후 다시 시도`);
      return;
    }
    toast(`🛒 ${it.name} 구매 — 실내/계절 배치는 곧 추가돼요 (보관함 보유)`);
  };

  return (
    <BottomSheet open={open} onClose={() => setOpen(false)} title="🛋️ 가구 상점">
      <div data-testid="furniture-shop">
        {/* 헤더: 보유 당근 + 카테고리 탭 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            padding: "0 4px",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "#2b2b2b" }}>
            🥕 {carrots} 당근
          </span>
        </div>
        <div
          role="tablist"
          aria-label="가구 카테고리"
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 14,
            padding: "0 4px",
          }}
        >
          {(Object.keys(TAB_LABELS) as FurnitureCategory[]).map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`furniture-tab-${c}`}
                onClick={() => {
                  haptic("light");
                  setCategory(c);
                }}
                style={{
                  flex: 1,
                  padding: "8px 6px",
                  borderRadius: 10,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  background: active ? "#FF7B61" : "rgba(0,0,0,0.05)",
                  color: active ? "#fff" : "#6a6055",
                  cursor: "pointer",
                }}
              >
                {TAB_LABELS[c]}
              </button>
            );
          })}
        </div>

        {/* 그리드 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              padding: "0 4px",
            }}
          >
            {items.map((it) => {
              const isOwned = owned.has(it.id);
              const insufficient = !isOwned && carrots < it.price;
              return (
                <button
                  key={it.id}
                  type="button"
                  data-testid={`furniture-card-${it.id}`}
                  onClick={() => !isOwned && handleBuy(it)}
                  disabled={isOwned}
                  style={{
                    padding: 10,
                    background: isOwned ? "rgba(0,0,0,0.04)" : "#fff",
                    border: `1px solid ${
                      isOwned
                        ? "var(--border-subtle, rgba(0,0,0,0.08))"
                        : insufficient
                          ? "rgba(255,123,97,0.25)"
                          : "rgba(255,123,97,0.5)"
                    }`,
                    borderRadius: 14,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    cursor: isOwned ? "default" : "pointer",
                    opacity: isOwned ? 0.6 : insufficient ? 0.75 : 1,
                    minHeight: 100,
                  }}
                >
                  <SpriteView sprite={it.sprite} size={36} alt="" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#2b2b2b" }}>
                    {it.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isOwned
                        ? "#6a6055"
                        : insufficient
                          ? "#888"
                          : "#FF7B61",
                    }}
                  >
                    {isOwned ? "보유 중" : `🥕 ${it.price}`}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </BottomSheet>
  );
}
