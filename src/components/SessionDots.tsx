/**
 * Phase 8.0-c — 세션 진행 dots (확장 + 4판 셀러브레이션).
 *
 * - 기본 target = 4 (4 미만으로는 줄어들지 않음).
 * - completed > target 이면 dots 가 5,6,7... 로 확장 (no cap).
 * - 완료된 dot: orange fill + bounce-in.
 * - 진행중 (FOCUSING) 다음 dot 은 carrot-soft pulse.
 * - completed === 4 가 되는 순간 (transition) 위에 3초 셀러브레이션 bubble:
 *     `4판 달성! 오늘 대단해`
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface SessionDotsProps {
  /** 오늘 완료된 세션 수 (>= 0). */
  completed: number;
  /** 일일 최소 dot 개수 (default 4). */
  target?: number;
  /** 현재 세션이 FOCUSING 인지 — 다음 dot 가 pulse */
  inProgress?: boolean;
}

const DOT = 12;
const GAP = 8;
const CELEBRATION_MS = 3000;

export function SessionDots({
  completed,
  target = 4,
  inProgress = false,
}: SessionDotsProps) {
  const minTarget = Math.max(target, 4);
  const count = Math.max(minTarget, completed);

  // 4 판 달성 셀러브레이션 — completed 가 4 로 transition 한 순간 1회.
  const prevCompletedRef = useRef(completed);
  const [showCelebration, setShowCelebration] = useState(false);
  useEffect(() => {
    const prev = prevCompletedRef.current;
    if (prev < 4 && completed >= 4) {
      setShowCelebration(true);
      const t = window.setTimeout(
        () => setShowCelebration(false),
        CELEBRATION_MS,
      );
      prevCompletedRef.current = completed;
      return () => window.clearTimeout(t);
    }
    prevCompletedRef.current = completed;
  }, [completed]);

  return (
    <div
      data-testid="session-dots-wrap"
      style={{
        position: "relative",
        marginTop: 16,
        marginBottom: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
            data-testid="session-dots-celebration"
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "6px 12px",
              borderRadius: 999,
              background: "var(--accent-carrot)",
              color: "var(--text-on-accent)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              boxShadow: "var(--shadow-md)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            4판 달성! 오늘 대단해
          </motion.div>
        )}
      </AnimatePresence>

      <div
        data-testid="session-dots"
        aria-label={`오늘 ${completed} / ${minTarget} 판`}
        style={{
          display: "flex",
          gap: GAP,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const isDone = i < completed;
          const isCurrent = !isDone && inProgress && i === completed;
          return (
            <motion.span
              key={i}
              aria-hidden
              initial={false}
              animate={
                isDone
                  ? { scale: [1, 1.3, 1] }
                  : isCurrent
                    ? { scale: [1, 1.15, 1] }
                    : { scale: 1 }
              }
              transition={
                isCurrent
                  ? { duration: 1.2, ease: "easeInOut", repeat: Infinity }
                  : { duration: 0.36, ease: [0.34, 1.56, 0.64, 1] }
              }
              style={{
                width: DOT,
                height: DOT,
                borderRadius: "50%",
                background: isDone
                  ? "var(--accent-carrot)"
                  : isCurrent
                    ? "color-mix(in oklab, var(--accent-carrot) 32%, transparent)"
                    : "color-mix(in oklab, var(--text-tertiary) 24%, transparent)",
                border: isCurrent ? "1.5px solid var(--accent-carrot)" : "none",
                display: "block",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
