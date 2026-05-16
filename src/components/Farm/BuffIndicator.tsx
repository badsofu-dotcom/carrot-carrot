/**
 * BuffIndicator — small floating pill row showing active buffs on the
 * farm card.
 *
 * Subscribes to `useBuffsStore`. Each pill corresponds to one buff
 * flag (juice / soup / cake). Pills appear when the flag turns true
 * and vanish when the consumer (FarmHub harvest, toolStore refill,
 * HomePage focus-complete) atomically reads + clears the flag.
 *
 * Layout (PR-17a):
 *   - Top of the farm card, just below the "☁ 하늘 보기" affordance.
 *   - Horizontal row, gap 6, no clicks (`pointerEvents: none`).
 *   - Per-buff color hint so the player can tell which one is live
 *     at a glance.
 *
 * No SFX / animation on mount-out to keep the surface quiet — the
 * trigger consumers already toast / play their own SFX.
 */
import { useBuffsStore } from "../../features/collection/buffsStore";

interface PillSpec {
  key: "juice" | "soup" | "cake";
  emoji: string;
  label: string;
  bg: string;
}

const PILLS: readonly PillSpec[] = [
  { key: "juice", emoji: "🥤", label: "주스 효과", bg: "rgba(255, 226, 110, 0.92)" },
  { key: "soup", emoji: "🍲", label: "수프 효과", bg: "rgba(255, 165, 92, 0.92)" },
  { key: "cake", emoji: "🍰", label: "케이크 효과", bg: "rgba(255, 168, 200, 0.92)" },
];

export function BuffIndicator() {
  const juice = useBuffsStore((s) => s.juiceActive);
  const soup = useBuffsStore((s) => s.soupActive);
  const cake = useBuffsStore((s) => s.cakeActive);
  const active: Record<PillSpec["key"], boolean> = {
    juice,
    soup,
    cake,
  };
  const visible = PILLS.filter((p) => active[p.key]);
  if (visible.length === 0) return null;
  return (
    <div
      data-testid="buff-indicator"
      aria-label="활성 버프"
      style={{
        position: "absolute",
        top: 42,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 6,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {visible.map((p) => (
        <span
          key={p.key}
          data-testid={`buff-pill-${p.key}`}
          aria-label={p.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "3px 8px",
            borderRadius: 999,
            background: p.bg,
            fontSize: 11,
            fontWeight: 800,
            color: "rgba(43, 24, 16, 0.85)",
            border: "1px solid rgba(255,255,255,0.65)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            letterSpacing: "0.01em",
          }}
        >
          <span aria-hidden style={{ fontSize: 12 }}>{p.emoji}</span>
          {p.label}
        </span>
      ))}
    </div>
  );
}
