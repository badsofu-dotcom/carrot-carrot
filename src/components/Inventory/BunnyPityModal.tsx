/**
 * BunnyPityModal (R32 PR-184) — 캔디당근 / 황금당근 가챠 pity 모달.
 *
 * Triggered by `cc:bunny-pity:open` CustomEvent (R32 PR-185 에서 RewardsPanel
 * 의 "친구 만나기" CTA 가 dispatch 예정). 각 옵션은 자원 비용 + 보장
 * tier 표시. 잔액 부족 시 disabled. 사용 시:
 *   1. spendCandyCarrots / spendGoldenCarrots CAS 차감
 *   2. drawBunny({ boostTier, ownedIds }) 로 추첨
 *   3. forceUnlock(bunnyId)
 *   4. cc:bunny-gacha:show dispatch (BunnyGachaModal 셀러브레이션)
 *
 * 옵션 (R34 PR-202 calibration):
 *   🍬 캔디당근 8 → rare 보장 가챠 (epic+ 확률 강화)
 *   ✨ 황금당근 3 → epic 보장 가챠 (legendary 12.5%)
 *
 * legendary 100% 보장은 기존 star 100 / gem 50 경로만 유지 — 본 모달은
 * legendary 직접 보장 없음 (희소성 보존).
 *
 * GemTradeModal 와 동일한 outer-flex + inner-motion 패턴.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useFarmStore } from "../../features/collection/farmStore";
import { useCollectionStore } from "../../features/collection/collectionStore";
import {
  drawBunny,
  CANDY_RARE_PITY_COST,
  GOLDEN_EPIC_PITY_COST,
} from "../../lib/bunnyGacha";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { useTossBackButton } from "../../lib/tossBackButton";
import {
  safeAreaBackdropStyle,
  safeAreaModalStyle,
} from "../../lib/ui/safeAreaModal";

interface Option {
  id: "candy_rare" | "golden_epic";
  cost: number;
  currency: "candy" | "golden";
  emoji: string;
  title: string;
  body: string;
  boostTier: "rare" | "epic";
}

const OPTIONS: readonly Option[] = [
  {
    id: "candy_rare",
    cost: CANDY_RARE_PITY_COST,
    currency: "candy",
    emoji: "🍬",
    title: "rare 보장 친구 만나기",
    body: "rare 이상 보장 + epic+ 확률 2배",
    boostTier: "rare",
  },
  {
    id: "golden_epic",
    cost: GOLDEN_EPIC_PITY_COST,
    currency: "golden",
    emoji: "✨",
    title: "epic 보장 친구 만나기",
    body: "epic 이상 보장 + legendary 12.5%",
    boostTier: "epic",
  },
];

export function BunnyPityModal() {
  const [open, setOpen] = useState(false);
  const candyCarrots = useFarmStore((s) => s.candyCarrots);
  const goldenCarrots = useFarmStore((s) => s.goldenCarrots);
  const spendCandy = useFarmStore((s) => s.spendCandyCarrots);
  const spendGolden = useFarmStore((s) => s.spendGoldenCarrots);
  const ownedCharacters = useCollectionStore((s) => s.ownedCharacters);
  const forceUnlock = useCollectionStore((s) => s.forceUnlock);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("cc:bunny-pity:open", onOpen);
    return () => window.removeEventListener("cc:bunny-pity:open", onOpen);
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
    const debited =
      opt.currency === "candy" ? spendCandy(opt.cost) : spendGolden(opt.cost);
    if (!debited) {
      toast(
        opt.currency === "candy"
          ? "🍬 캔디당근이 부족해요"
          : "✨ 황금당근이 부족해요",
      );
      return;
    }
    haptic("medium");
    const ownedSet = new Set(ownedCharacters);
    const result = drawBunny({
      ownedIds: ownedSet,
      boostTier: opt.boostTier,
    });
    if (!result.bunnyId) {
      // 모든 tier 가 owned — 환불 + 안내.
      if (opt.currency === "candy") {
        useFarmStore.setState({
          candyCarrots: candyCarrots,
        });
      } else {
        useFarmStore.setState({
          goldenCarrots: goldenCarrots,
        });
      }
      toast("이미 모든 친구를 만났어요 — 자원 환불");
      setOpen(false);
      return;
    }
    forceUnlock(result.bunnyId);
    try {
      window.dispatchEvent(
        new CustomEvent("cc:bunny-gacha:show", {
          detail: { bunnyId: result.bunnyId },
        }),
      );
    } catch {
      /* SSR */
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
          data-testid="bunny-pity-backdrop"
        >
          <motion.div
            data-testid="bunny-pity-modal"
            role="dialog"
            aria-modal="true"
            aria-label="친구 만나기 (pity)"
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
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
            <style>{`[data-testid="bunny-pity-modal"]::-webkit-scrollbar{display:none;}`}</style>
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#2b2b2b",
                }}
              >
                🐰 친구 만나기 — 보장
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#c5462a",
                  }}
                >
                  🍬 {candyCarrots}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#c5462a",
                  }}
                >
                  ✨ {goldenCarrots}
                </span>
              </div>
            </header>
            <p
              style={{
                margin: "4px 0 12px",
                fontSize: 11,
                color: "#6a6055",
              }}
            >
              자원을 사용하면 즉시 추첨 + 도감에 추가됩니다.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {OPTIONS.map((opt) => {
                const balance =
                  opt.currency === "candy" ? candyCarrots : goldenCarrots;
                const canUse = balance >= opt.cost;
                const shortfall = opt.cost - balance;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => apply(opt)}
                    disabled={!canUse}
                    data-testid={`pity-opt-${opt.id}`}
                    aria-label={
                      canUse
                        ? `${opt.title} — ${opt.emoji} ${opt.cost}개 사용`
                        : `${opt.title} — ${opt.emoji} ${shortfall}개 부족`
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
                          data-testid={`pity-opt-${opt.id}-shortfall`}
                          style={{
                            margin: "3px 0 0",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#b86a52",
                            lineHeight: 1.2,
                          }}
                        >
                          {opt.emoji} {shortfall}개 더 필요해요
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: canUse
                          ? "#FF7B61"
                          : "rgba(0,0,0,0.08)",
                        color: canUse ? "#fff" : "#888",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {opt.emoji} {opt.cost}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid="bunny-pity-close"
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
