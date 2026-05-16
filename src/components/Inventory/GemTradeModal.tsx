/**
 * GemTradeModal (PR-33) — 보석 사용 5 옵션.
 *
 * Triggered by `cc:gem-trade:open` CustomEvent (dispatched from
 * InventoryModal 의 보석 "사용하기" 버튼). 각 옵션은 보석 비용 +
 * 효과 표시. 비용보다 보유 적으면 disabled. 사용 시 itemsStore.
 * consume("gem", cost) → 효과 dispatch → 모달 close.
 *
 * 디자인:
 *   - 5×9 (45 px) icon + 비용 + 효과명 + 비용 게이트 disabled
 *   - 비용/효과 분배는 PR-33 가이드라인:
 *       seeds9   →  5 gem  → +9 seeds
 *       grow     →  5 gem  → 전체 심은 plot +1 stage (hourglass 와 동등)
 *       session  → 10 gem  → 당근 +25 (25분 세션 즉시 완료 효과)
 *       golden   → 20 gem  → 황금당근 +1 보장
 *       legend   → 50 gem  → 레전더리 토끼 시도 (이미 보유 시 보석 환불)
 *
 * BunnyGachaModal 와 같은 outer-flex + inner-motion 패턴 (PR-42).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFarmStore } from "../../features/collection/farmStore";
import { useItemsStore } from "../../features/collection/itemsStore";
import { useCollectionStore } from "../../features/collection/collectionStore";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";

interface Option {
  id: "seeds9" | "grow" | "session" | "golden" | "legend";
  cost: number;
  emoji: string;
  title: string;
  body: string;
}

const OPTIONS: readonly Option[] = [
  { id: "seeds9", cost: 5, emoji: "🌱", title: "씨앗 +9", body: "씨앗 보관함에 9개 추가" },
  { id: "grow", cost: 5, emoji: "🌿", title: "전체 +1단계", body: "심은 모든 plot 한 단계 즉시 성장" },
  { id: "session", cost: 10, emoji: "🥕", title: "당근 +25", body: "25분 세션 1회분 즉시 보상" },
  { id: "golden", cost: 20, emoji: "✨", title: "황금당근 +1", body: "확정 황금당근 1개 (+10 P)" },
  { id: "legend", cost: 50, emoji: "👑", title: "레전더리 가챠", body: "레전더리 토끼 1회 시도 (이미 보유면 환불)" },
];

export function GemTradeModal() {
  const [open, setOpen] = useState(false);
  const counts = useItemsStore((s) => s.counts);
  const consume = useItemsStore((s) => s.consume);
  const add = useItemsStore((s) => s.add);
  const growAllPlanted = useFarmStore((s) => s.growAllPlanted);
  const incCarrots = useFarmStore((s) => s.incCarrots);
  const incGolden = useFarmStore((s) => s.incGoldenCarrots);
  const forceUnlock = useCollectionStore((s) => s.forceUnlock);
  const gemCount = counts.gem ?? 0;

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("cc:gem-trade:open", onOpen);
    return () => window.removeEventListener("cc:gem-trade:open", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const apply = (opt: Option) => {
    if (!consume("gem", opt.cost)) {
      toast("보석이 부족해요");
      return;
    }
    haptic("medium");
    switch (opt.id) {
      case "seeds9":
        growAllPlanted(0, null, 9);
        toast("💎 보석 5개 → 씨앗 +9");
        break;
      case "grow":
        growAllPlanted(1, Date.now(), 0);
        toast("💎 보석 5개 → 작물 한 단계 성장");
        break;
      case "session":
        incCarrots(25);
        toast("💎 보석 10개 → 당근 +25");
        break;
      case "golden":
        incGolden(1);
        toast("💎 보석 20개 → 황금당근 +1 (+10 P)");
        break;
      case "legend": {
        // 레전더리 풀에 현재 legendary-demon 1마리만 정의.
        // 이미 보유면 forceUnlock 이 null 반환 → 보석 환불 + 안내.
        const got = forceUnlock("legendary-demon");
        if (got) {
          try {
            window.dispatchEvent(
              new CustomEvent("cc:bunny-gacha:show", {
                detail: { bunnyId: got },
              }),
            );
          } catch {
            /* SSR */
          }
          toast("💎 레전더리 토끼 획득!");
        } else {
          // 환불.
          add("gem", opt.cost);
          toast("이미 보유 — 보석 환불");
        }
        break;
      }
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1090,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding:
              "16px calc(16px + env(safe-area-inset-right)) 16px calc(16px + env(safe-area-inset-left))",
            boxSizing: "border-box",
          }}
          data-testid="gem-trade-backdrop"
        >
          <motion.div
            data-testid="gem-trade-modal"
            role="dialog"
            aria-modal="true"
            aria-label="보석 사용"
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              background: "#FFF8EE",
              borderRadius: 20,
              padding: "18px 18px 14px",
              boxShadow: "0 12px 36px rgba(0,0,0,0.32)",
              boxSizing: "border-box",
              maxHeight: "85vh",
              overflowY: "auto",
              scrollbarWidth: "none",
            }}
          >
            <style>{`[data-testid="gem-trade-modal"]::-webkit-scrollbar{display:none;}`}</style>
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                💎 보석 사용
              </h3>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#FF7B61",
                }}
              >
                보유 {gemCount}개
              </span>
            </header>
            <p
              style={{
                margin: "4px 0 12px",
                fontSize: 11,
                color: "#888",
              }}
            >
              비용을 충족하면 즉시 효과 발동.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {OPTIONS.map((opt) => {
                const canUse = gemCount >= opt.cost;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => apply(opt)}
                    disabled={!canUse}
                    data-testid={`gem-opt-${opt.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      background: canUse ? "#fff" : "rgba(0,0,0,0.04)",
                      border: canUse
                        ? "1px solid rgba(255,123,97,0.35)"
                        : "1px solid rgba(0,0,0,0.06)",
                      borderRadius: 14,
                      cursor: canUse ? "pointer" : "not-allowed",
                      textAlign: "left",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 24 }}>
                      {opt.emoji}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 800,
                          color: canUse ? "#2b2b2b" : "#888",
                        }}
                      >
                        {opt.title}
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 11,
                          color: canUse ? "#555" : "#999",
                          lineHeight: 1.3,
                        }}
                      >
                        {opt.body}
                      </p>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: canUse ? "#FF7B61" : "rgba(0,0,0,0.08)",
                        color: canUse ? "#fff" : "#888",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      💎 {opt.cost}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid="gem-trade-close"
              style={{
                marginTop: 12,
                width: "100%",
                padding: "12px 0",
                borderRadius: 12,
                border: "none",
                background: "rgba(0,0,0,0.06)",
                color: "#444",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              닫기
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
