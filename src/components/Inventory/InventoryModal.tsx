/**
 * InventoryModal — bottom sheet listing all 13 inventory item slots.
 *
 * Layout
 *   - Sheet covers the bottom 70 vh of the viewport, rounded 24px,
 *     drag handle + title "내 가방".
 *   - Segmented tabs: 자원 / 도구 아이템 / 컬렉션 — driven by
 *     `ItemDef.tab`.
 *   - 4-column grid; each cell ~80×80; PNG icon + count + Korean name;
 *     locked items render dim with an acquisition hint.
 *
 * Use buttons
 *   - Tool-tab items with `usable: true` show "사용" when
 *     count >= minToUse (default 1). Local effects:
 *       hourglass → growAllPlanted(1, snapshot)
 *       bolt      → toolStore.refillFromAd (+3 wateringCan, +1 if soup)
 *       juice     → buffsStore.activate("juice")  next-harvest candy +5%p
 *       soup      → buffsStore.activate("soup")   next-refill +1 charge
 *       cake      → buffsStore.activate("cake")   next-focus seed +1
 *       gem       → consume 5 → growAllPlanted seed +1
 *   - Worker route `/items/use` mirrors the count decrement (or skips
 *     when guest/preview). The buff flags themselves are client-only.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ITEMS, useItemsStore, type ItemCode, type ItemTab } from "../../features/collection/itemsStore";
import { useFarmStore } from "../../features/collection/farmStore";
import { useToolStore, TOOL_CONSTANTS } from "../../features/collection/toolStore";
import { useBuffsStore } from "../../features/collection/buffsStore";
import { toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";

const BASE = import.meta.env.BASE_URL;

const TAB_LABELS: Record<ItemTab, string> = {
  resources: "자원",
  tools: "도구 아이템",
  collection: "컬렉션",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InventoryModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<ItemTab>("resources");
  const counts = useItemsStore((s) => s.counts);
  const consume = useItemsStore((s) => s.consume);
  const carrots = useFarmStore((s) => s.carrots);
  const candy = useFarmStore((s) => s.candyCarrots);
  const golden = useFarmStore((s) => s.goldenCarrots);
  const seeds = useFarmStore((s) => s.seeds);
  const growAllPlanted = useFarmStore((s) => s.growAllPlanted);
  const refillFromAd = useToolStore((s) => s.refillFromAd);

  // Resource counts come from useFarmStore, not the items store. The
  // bag is the read-out surface; the canonical source stays in
  // farmStore so harvest / focus rewards keep working unchanged.
  // PR-12 removed `carrot_bag` (당근 주머니) — it was a self-recursive
  // entry (the bag listing itself, opened from the very same bag's
  // dock slot). Bag count surfaces on the dock badge, not the grid.
  const liveResourceCount = (code: ItemCode): number => {
    switch (code) {
      case "carrot": return carrots;
      case "candy": return candy;
      case "golden": return golden;
      case "carrot_coin": return counts.carrot_coin;
      default: return counts[code] ?? 0;
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = ITEMS.filter((i) => i.tab === tab);

  const onUse = (code: ItemCode) => {
    haptic("medium");
    const def = ITEMS.find((i) => i.code === code);
    const cost = def?.minToUse ?? 1;
    if (!consume(code, cost)) {
      toast("아이템이 부족해요");
      return;
    }
    switch (code) {
      case "hourglass":
        growAllPlanted(1, Date.now(), 0);
        toast("⏳ 작물이 한 단계 자랐어요");
        break;
      case "bolt": {
        // Mirror `tools/refill` locally: +3 wateringCan up to MAX_DAILY,
        // bypassing the per-day ad cap because the item itself is the
        // ad reward. Uses refillFromAd to keep the path symmetric.
        // Pre-consume soup buff (PR-9) so bolt also benefits; if the
        // refill itself fails, restore the buff so it isn't wasted.
        const soupActive = useBuffsStore.getState().consume("soup");
        if (refillFromAd(soupActive ? 1 : 0)) {
          toast(
            soupActive ? "⚡ 물뿌리개 +4 충전 (수프 효과)" : "⚡ 물뿌리개 +3 충전",
          );
        } else {
          if (soupActive) useBuffsStore.getState().activate("soup");
          toast("오늘 광고 충전 한도 가득");
        }
        break;
      }
      case "juice":
        useBuffsStore.getState().activate("juice");
        toast("🥤 다음 수확 캔디 확률 +5%p");
        break;
      case "soup":
        useBuffsStore.getState().activate("soup");
        toast("🍲 다음 물뿌리개 충전 +1");
        break;
      case "cake":
        useBuffsStore.getState().activate("cake");
        toast("🍰 다음 포커스 완료 시 씨앗 +1");
        break;
      case "gem":
        // 5 gems trade for 1 seed. Reuses growAllPlanted's seed-delta
        // side-door (steps=0, snapshotId=null, seedDelta=1) — the only
        // direct-grant seed path the store exposes today.
        growAllPlanted(0, null, 1);
        toast(`💎 보석 ${cost}개 사용 → 씨앗 +1`);
        break;
      default:
        break;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1060,
              background: "rgba(0,0,0,0.45)",
            }}
            data-testid="inventory-backdrop"
          />
          <motion.div
            data-testid="inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-label="내 가방"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "fixed",
              // Center horizontally via margin auto. Don't use
              // transform: translateX(-50%) here — framer-motion owns
              // the transform property for the y slide-in animation and
              // would clobber an inline X translation, which is what
              // pushed the sheet off-screen-right on mobile (PR-6.5).
              left: 0,
              right: 0,
              marginLeft: "auto",
              marginRight: "auto",
              bottom: 0,
              zIndex: 1061,
              width: "100%",
              maxWidth: "var(--app-max-width, 480px)",
              height: "70vh",
              background: "#FFF8EE",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding:
                "12px calc(20px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))",
              boxShadow: "0 -8px 28px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 44,
                height: 5,
                borderRadius: 999,
                background: "rgba(0,0,0,0.18)",
                margin: "4px auto 14px",
              }}
            />
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>내 가방</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(0,0,0,0.06)",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </header>

            {/* Segmented tabs */}
            <div
              role="tablist"
              aria-label="아이템 분류"
              style={{
                display: "flex",
                gap: 4,
                padding: 4,
                borderRadius: 12,
                background: "rgba(0,0,0,0.05)",
                marginBottom: 12,
              }}
            >
              {(Object.keys(TAB_LABELS) as ItemTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  data-testid={`inventory-tab-${t}`}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    height: 32,
                    border: "none",
                    borderRadius: 8,
                    background: tab === t ? "#fff" : "transparent",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    color: tab === t ? "#2b2b2b" : "#888",
                  }}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
                overflowY: "auto",
                paddingBottom: 8,
              }}
            >
              {items.map((it) => {
                const count = liveResourceCount(it.code);
                const owned = count > 0;
                const minToUse = it.minToUse ?? 1;
                const canUse = it.usable && count >= minToUse;
                return (
                  <div
                    key={it.code}
                    data-testid={`inv-${it.code}`}
                    title={!owned ? `획득 방법: ${it.acquisition}` : it.effect}
                    style={{
                      position: "relative",
                      background: "#fff",
                      borderRadius: 14,
                      width: "100%",
                      aspectRatio: "1 / 1",
                      padding: 6,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      opacity: owned ? 1 : 0.45,
                    }}
                  >
                    <img
                      src={`${BASE}${it.iconRel}`}
                      alt=""
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: "contain",
                        filter: owned ? "none" : "grayscale(0.85)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: "center",
                        color: owned ? "#2b2b2b" : "#888",
                        lineHeight: 1.1,
                      }}
                    >
                      {it.ko}
                    </span>
                    <span
                      aria-label={`${it.ko} ${count}개`}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        color: owned ? "#FF7B61" : "#888",
                      }}
                    >
                      {count > 0 ? count : ""}
                    </span>
                    {canUse && (
                      <button
                        type="button"
                        data-testid={`inv-use-${it.code}`}
                        onClick={() => onUse(it.code)}
                        style={{
                          position: "absolute",
                          left: 4,
                          right: 4,
                          bottom: 4,
                          height: 18,
                          fontSize: 10,
                          fontWeight: 800,
                          border: "none",
                          borderRadius: 8,
                          background: "#FF7B61",
                          color: "#fff",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {minToUse > 1 ? `사용 (${minToUse})` : "사용"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer summary */}
            <p
              style={{
                margin: "8px 4px 0",
                fontSize: 11,
                color: "#888",
                textAlign: "center",
              }}
            >
              총 {ITEMS.length}종 · 보유 {useItemsStore.getState().speciesOwned()}종
              {tab === "resources" && (
                <>
                  {" · "}
                  🥕 {carrots} · 🍬 {candy} · ✨ {golden} · 🌱 {seeds}
                </>
              )}
              {tab === "tools" && (
                <>
                  {" · "}
                  최대 광고 충전 {TOOL_CONSTANTS.MAX_AD_REFILLS}회/일
                </>
              )}
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
