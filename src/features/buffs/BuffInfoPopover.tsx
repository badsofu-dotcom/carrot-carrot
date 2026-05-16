/**
 * BuffInfoPopover (PR-59) — 활성 buff 의 상세 정보 모달.
 *
 * BuffChip 탭 → 본 popover 열림. 효과 설명 + 트리거 조건 + 잔여 시간.
 * PR-42 안전 모달 패턴 (outer flex centering + inner motion 카드).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useBuffsStore, type BuffKind } from "../collection/buffsStore";
import { BUFF_META, formatRemaining } from "./buffEffects";

interface Props {
  kind: BuffKind | null;
  onClose: () => void;
}

export function BuffInfoPopover({ kind, onClose }: Props) {
  const remainingMs = useBuffsStore((s) => s.remainingMs);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!kind) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [kind]);
  // tick 변수는 1초마다 forced re-render 용 — value 자체 미사용 OK
  void tick;

  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);

  const meta = kind ? BUFF_META[kind] : null;
  const remaining = kind ? remainingMs(kind) : 0;
  const active = remaining > 0;

  return (
    <AnimatePresence>
      {kind && meta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          data-testid="buff-info-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding:
              "16px calc(16px + env(safe-area-inset-right)) 16px calc(16px + env(safe-area-inset-left))",
            boxSizing: "border-box",
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${meta.displayName} 정보`}
            initial={{ y: 16, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            data-testid="buff-info-modal"
            style={{
              width: "100%",
              maxWidth: 320,
              background: "#FFF8EE",
              borderRadius: 20,
              padding: "20px 22px",
              boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
              boxSizing: "border-box",
              border: `2px solid ${meta.color}99`,
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <span aria-hidden style={{ fontSize: 28 }}>
                {meta.emoji}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {meta.displayName}
              </h3>
              <button
                type="button"
                aria-label="닫기"
                onClick={onClose}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(0,0,0,0.06)",
                  fontSize: 15,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </header>
            <div
              style={{
                background: `${meta.color}22`,
                borderRadius: 12,
                padding: "10px 12px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(43, 24, 16, 0.6)",
                  }}
                >
                  잔여 시간
                </span>
                <span
                  data-testid="buff-info-remaining"
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: active ? "rgba(43, 24, 16, 0.92)" : "#999",
                  }}
                >
                  {active ? formatRemaining(remaining) : "만료됨"}
                </span>
              </div>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(43, 24, 16, 0.85)",
                lineHeight: 1.45,
              }}
            >
              {meta.description}
            </p>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 11,
                color: "rgba(43, 24, 16, 0.55)",
                lineHeight: 1.4,
              }}
            >
              {meta.trigger}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
