/**
 * mm:ss flip/crossfade 숫자 디스플레이.
 * AnimatePresence 로 자릿수 변경 시 위로 흘러가며 새 숫자 페이드 인.
 */

import { motion, AnimatePresence } from "framer-motion";

interface TimerDigitsProps {
  /** 남은 ms. 음수면 0 처리. */
  remainingMs: number;
  size?: number;
  color?: string;
  /** 디버그 모드면 0.5초 단위까지 표시. */
  debug?: boolean;
}

export function TimerDigits({
  remainingMs,
  size = 56,
  color = "var(--text-primary)",
  debug = false,
}: TimerDigitsProps) {
  const total = Math.max(0, remainingMs);
  const totalSec = Math.ceil(total / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  return (
    <div
      className="t-display-num tabular-nums"
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        justifyContent: "center",
        gap: 2,
        fontSize: size,
        color,
        lineHeight: 1,
      }}
      aria-live="off"
    >
      <DigitGroup value={mm} size={size} />
      <span style={{ opacity: 0.6, fontWeight: 700 }}>:</span>
      <DigitGroup value={ss} size={size} />
      {debug && (
        <span
          style={{
            fontSize: size * 0.32,
            color: "var(--text-tertiary)",
            marginLeft: 6,
            fontWeight: 700,
          }}
        >
          DBG
        </span>
      )}
    </div>
  );
}

function DigitGroup({ value, size }: { value: string; size: number }) {
  return (
    <span style={{ display: "inline-flex" }}>
      {value.split("").map((d, i) => (
        <FlipDigit key={`${i}`} digit={d} size={size} />
      ))}
    </span>
  );
}

function FlipDigit({ digit, size }: { digit: string; size: number }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: size * 0.6,
        height: size,
        overflow: "hidden",
        verticalAlign: "baseline",
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: -size * 0.4, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: size * 0.4, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
