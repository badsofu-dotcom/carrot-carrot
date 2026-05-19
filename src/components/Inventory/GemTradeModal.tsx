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
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useFarmStore } from "../../features/collection/farmStore";
import { useItemsStore } from "../../features/collection/itemsStore";
import { useCollectionStore } from "../../features/collection/collectionStore";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { useTossBackButton } from "../../lib/tossBackButton";
import {
  safeAreaBackdropStyle,
  safeAreaModalStyle,
} from "../../lib/ui/safeAreaModal";

interface Option {
  id: "candy3" | "grow" | "session" | "golden" | "legend";
  cost: number;
  emoji: string;
  title: string;
  body: string;
}

// PR-109 — 씨앗 자원 폐기. seeds9 (5 gem → 씨앗 9개 = 0P) 옵션 →
// candy3 (5 gem → 캔디당근 3개 = 15P) 로 대체. P 가치 유지 + 학습
// 도구 톤 (씨앗 제거).
const OPTIONS: readonly Option[] = [
  // PR-145 (Round 22) — P 라벨 제거 (가구 통화로 재정의).
  { id: "candy3", cost: 5, emoji: "🍬", title: "캔디당근 +3", body: "캔디당근 3개" },
  { id: "grow", cost: 5, emoji: "🌿", title: "전체 +1단계", body: "심은 모든 plot 한 단계 즉시 성장" },
  { id: "session", cost: 10, emoji: "🥕", title: "당근 +25", body: "25분 세션 1회분 즉시 보상" },
  { id: "golden", cost: 20, emoji: "✨", title: "황금당근 +1", body: "확정 황금당근 1개" },
  // PR-51 — GRAC 공시: 미보유 시 100% (전설 풀에 legendary-demon 1마리,
  // 미보유면 무조건 unlock), 이미 보유 시 보석 50 환불 (실패 P 손실
  // 없음). 확률형 아이템 정의 회피 — 결과 보장.
  { id: "legend", cost: 50, emoji: "👑", title: "전설 친구 만나기", body: "전설 토끼 1마리 unlock (이미 보유면 보석 환불, 실패 0%)" },
];

export function GemTradeModal() {
  const [open, setOpen] = useState(false);
  const counts = useItemsStore((s) => s.counts);
  const consume = useItemsStore((s) => s.consume);
  const add = useItemsStore((s) => s.add);
  const growAllPlanted = useFarmStore((s) => s.growAllPlanted);
  const incCarrots = useFarmStore((s) => s.incCarrots);
  const incCandy = useFarmStore((s) => s.incCandyCarrots);
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

  // R35 — 토스/하드웨어 back 시 모달만 닫음.
  useTossBackButton(() => setOpen(false), open);

  const apply = (opt: Option) => {
    if (!consume("gem", opt.cost)) {
      toast("보석이 부족해요");
      return;
    }
    haptic("medium");
    switch (opt.id) {
      case "candy3":
        // PR-109 — seeds9 대체. 캔디당근 3개 grant. R34 — "+15 P" 라벨
        // 제거 (토스포인트 환산 dormant).
        incCandy(3);
        toast("💎 보석 5개 → 캔디당근 +3");
        break;
      case "grow":
        growAllPlanted(1, Date.now());
        toast("💎 보석 5개 → 작물 한 단계 성장");
        break;
      case "session":
        incCarrots(25);
        toast("💎 보석 10개 → 당근 +25");
        break;
      case "golden":
        incGolden(1);
        toast("💎 보석 20개 → 황금당근 +1");
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
          toast("💎 전설 토끼 도감 unlock!");
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

  // R35 — Portal: FarmHub stacking context 탈출 ([HeartUseModal] 참조).
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
          style={{ ...safeAreaBackdropStyle, zIndex: 1090 }}
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
            // PR-81 — safeAreaModalStyle 적용. 5 옵션 + 닫기 버튼이
            // small viewport (375x667) 에서도 잘림 없이 표시.
            style={{
              ...safeAreaModalStyle({
                maxWidth: 380,
                paddingTop: 18,
                paddingX: 18,
                paddingBottom: 14,
              }),
              background: "#FFF8EE",
              borderRadius: 20,
              boxShadow: "0 12px 36px rgba(0,0,0,0.32)",
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
              {/* PR-84 — modal bg #FFF8EE fixed → fixed dark heading. */}
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#2b2b2b" }}>
                💎 보석 사용
              </h3>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  // PR-110 — small accent text contrast fix.
                  color: "#c5462a",
                }}
              >
                보유 {gemCount}개
              </span>
            </header>
            <p
              style={{
                margin: "4px 0 12px",
                fontSize: 11,
                color: "#6a6055",
              }}
            >
              비용을 충족하면 즉시 효과 발동.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {OPTIONS.map((opt) => {
                const canUse = gemCount >= opt.cost;
                const shortfall = opt.cost - gemCount;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => apply(opt)}
                    disabled={!canUse}
                    data-testid={`gem-opt-${opt.id}`}
                    aria-label={
                      canUse
                        ? `${opt.title} — 보석 ${opt.cost}개 사용`
                        : `${opt.title} — 보석 ${shortfall}개 부족`
                    }
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
                      opacity: canUse ? 1 : 0.85,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        fontSize: 24,
                        filter: canUse ? "none" : "grayscale(0.6)",
                      }}
                    >
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
                      {!canUse && (
                        <p
                          data-testid={`gem-opt-${opt.id}-shortfall`}
                          style={{
                            margin: "3px 0 0",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#b86a52",
                            lineHeight: 1.2,
                          }}
                        >
                          보석 {shortfall}개 더 필요해요
                        </p>
                      )}
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
    </AnimatePresence>,
    document.body,
  );
}
