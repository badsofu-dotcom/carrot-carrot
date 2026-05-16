/**
 * BuffChip (PR-59) — 활성 buff 1개의 lozenge chip.
 *
 * 사양:
 *   - 라벨 ("주스 버프" 등) + 잔여시간 mm:ss
 *   - 잔여 비율 progress bar (배경 fill)
 *   - 만료 5초 전 깜빡임 (opacity pulse)
 *   - 탭 시 BuffInfoPopover 열림
 *   - 자체 1초 tick 으로 remaining 갱신
 *   - tick 마다 store.pruneExpired() 호출 → 만료된 buff state 정리
 */
import { useEffect, useState } from "react";
import { useBuffsStore, type BuffKind } from "../collection/buffsStore";
import {
  BUFF_META,
  formatRemaining,
  isFinalCountdown,
} from "./buffEffects";

interface Props {
  kind: BuffKind;
  onTap: () => void;
}

export function BuffChip({ kind, onTap }: Props) {
  const expiresAt =
    kind === "juice"
      ? useBuffsStore((s) => s.juiceExpiresAt)
      : kind === "soup"
        ? useBuffsStore((s) => s.soupExpiresAt)
        : useBuffsStore((s) => s.cakeExpiresAt);
  const pruneExpired = useBuffsStore((s) => s.pruneExpired);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      setNow(Date.now());
      pruneExpired();
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, pruneExpired]);

  if (!expiresAt || expiresAt <= now) return null;
  const meta = BUFF_META[kind];
  const remaining = Math.max(0, expiresAt - now);
  const pct = Math.min(100, (remaining / meta.durationMs) * 100);
  const finalCountdown = isFinalCountdown(remaining);

  return (
    <button
      type="button"
      data-testid={`buff-chip-${kind}`}
      aria-label={`${meta.displayName} — 잔여 ${formatRemaining(remaining)}`}
      onClick={onTap}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.92)",
        border: `1px solid ${meta.color}88`,
        boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        overflow: "hidden",
        animation: finalCountdown
          ? "buff-chip-blink 0.8s ease-in-out infinite"
          : undefined,
      }}
    >
      {/* Progress bar 배경 (잔여 비율). 색깔은 meta.color 의 옅은 버전. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: `${pct}%`,
          background: `${meta.color}55`,
          transition: "width 0.95s linear",
          pointerEvents: "none",
        }}
      />
      <span aria-hidden style={{ position: "relative", fontSize: 14 }}>
        {meta.emoji}
      </span>
      <span
        style={{
          position: "relative",
          fontSize: 11,
          fontWeight: 800,
          color: "rgba(43, 24, 16, 0.88)",
        }}
      >
        {meta.displayName}
      </span>
      <span
        style={{
          position: "relative",
          fontSize: 10,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: finalCountdown ? "#d05a3a" : "rgba(43, 24, 16, 0.65)",
          marginLeft: 2,
        }}
      >
        {formatRemaining(remaining)}
      </span>
      {/* Keyframes 인라인 — 모든 BuffChip 가 같은 animation 이름 공유. */}
      <style>{`
        @keyframes buff-chip-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </button>
  );
}
