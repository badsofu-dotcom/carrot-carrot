/**
 * HeartUseModal (R33 PR-191) — 하트 자원 부스트 선택 모달.
 *
 * Triggered by `cc:heart-use:open` CustomEvent (R33 PR-192 InventoryModal
 * heart "사용하기" 액션이 dispatch). 사용자가 옵션 선택:
 *
 *   💗 candy_boost   — 다음 수확 candy +10%p (1회). heart buff activate.
 *   🌱 grow_all      — 심은 plot 모두 +1 stage 즉시 (hourglass 동등).
 *
 * 두 옵션 모두 heart 1개 consume. 하트가 0 이면 옵션 disabled.
 *
 * GemTradeModal / BunnyPityModal 와 동일 outer-flex + inner-motion 패턴.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useItemsStore } from "../../features/collection/itemsStore";
import { useBuffsStore } from "../../features/collection/buffsStore";
import { useFarmStore } from "../../features/collection/farmStore";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { useTossBackButton } from "../../lib/tossBackButton";
import {
  safeAreaBackdropStyle,
  safeAreaModalStyle,
} from "../../lib/ui/safeAreaModal";

interface Option {
  id: "candy_boost" | "grow_all";
  emoji: string;
  title: string;
  body: string;
}

const OPTIONS: readonly Option[] = [
  {
    id: "candy_boost",
    emoji: "🍬",
    title: "다음 수확 캔디 +10%p",
    body: "다음 수확 한 번 캔디당근 확률 +10%p (30분 안에 수확)",
  },
  {
    id: "grow_all",
    emoji: "🌱",
    title: "심은 작물 모두 +1 단계",
    body: "심은 plot 의 모든 작물 즉시 한 단계 성장",
  },
];

const HEART_COST = 1;

export function HeartUseModal() {
  const [open, setOpen] = useState(false);
  const heartCount = useItemsStore((s) => s.counts.heart ?? 0);
  const consume = useItemsStore((s) => s.consume);
  const activateBuff = useBuffsStore((s) => s.activate);
  const growAllPlanted = useFarmStore((s) => s.growAllPlanted);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("cc:heart-use:open", onOpen);
    return () => window.removeEventListener("cc:heart-use:open", onOpen);
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
    if (!consume("heart", HEART_COST)) {
      toast("💗 하트가 부족해요");
      return;
    }
    haptic("medium");
    switch (opt.id) {
      case "candy_boost":
        activateBuff("heart");
        toast("💗 하트 1개 → 다음 수확 캔디 +10%p (30분)");
        break;
      case "grow_all": {
        const grown = growAllPlanted(1, Date.now());
        if (grown > 0) {
          toast(`💗 하트 1개 → ${grown}개 작물 +1 단계`);
        } else {
          toast("💗 하트 1개 → 심은 작물이 없어요 (효과 적용 X)");
        }
        break;
      }
    }
    setOpen(false);
  };

  // R35 — Portal 로 document.body 에 직접 mount. FarmHub 가 z-index:0
  // stacking context 를 만들기 때문에 그 안에 있으면 z:1090 이라도
  // CollectionPage 의 InventoryModal (z:1060, body context) 보다 아래로
  // 깔림. Portal 로 빼면 body context 의 z:1090 그대로 적용 → 위로 올라옴.
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
          data-testid="heart-use-backdrop"
        >
          <motion.div
            data-testid="heart-use-modal"
            role="dialog"
            aria-modal="true"
            aria-label="하트 사용"
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
            <style>{`[data-testid="heart-use-modal"]::-webkit-scrollbar{display:none;}`}</style>
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
                💗 하트 사용 — 부스트
              </h3>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#c5462a",
                }}
              >
                보유 {heartCount}개
              </span>
            </header>
            <p
              style={{
                margin: "4px 0 12px",
                fontSize: 11,
                color: "#6a6055",
              }}
            >
              하트 1개 사용. 두 가지 부스트 중 선택.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {OPTIONS.map((opt) => {
                const canUse = heartCount >= HEART_COST;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => apply(opt)}
                    disabled={!canUse}
                    data-testid={`heart-opt-${opt.id}`}
                    aria-label={
                      canUse
                        ? `${opt.title} — 💗 1개 사용`
                        : `${opt.title} — 💗 부족`
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
                      💗 {HEART_COST}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid="heart-use-close"
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
