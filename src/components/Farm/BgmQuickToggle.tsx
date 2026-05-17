/**
 * BgmQuickToggle (Round 19, PR-137) — farm-card BGM mute toggle.
 *
 * Sits next to the "☁ 하늘 보기" pill at the top of the farm card.
 * Reads from / writes to the same `farmBgmEnabled` key as Settings →
 * 소리 → BGM, so toggling here is reflected there and vice versa.
 *
 * Why a separate component instead of inlining in FarmHub:
 *   - FarmHub already hosts ~50 hooks; adding the soundStore subscription
 *     there bloats an already-large component.
 *   - Tested visually in isolation more easily.
 *
 * a11y:
 *   - aria-pressed reflects current state (true = playing).
 *   - aria-label switches between "BGM 켜기" / "BGM 끄기" so screen
 *     readers describe the *action*, not the current state.
 */

import { useSoundStore } from "../../store/soundStore";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";

const PILL_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 24,
  padding: 0,
  borderRadius: 999,
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.6)",
  color: "rgba(43, 24, 16, 0.78)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "0.01em",
};

export function BgmQuickToggle() {
  const enabled = useSoundStore((s) => s.farmBgmEnabled);
  const setEnabled = useSoundStore((s) => s.setFarmBgmEnabled);
  const onClick = () => {
    const next = !enabled;
    setEnabled(next);
    haptic("light");
    toast(next ? "🎵 BGM 켜짐" : "🔇 BGM 꺼짐");
  };
  return (
    <button
      type="button"
      data-testid="farm-bgm-quick-toggle"
      aria-pressed={enabled}
      aria-label={enabled ? "BGM 끄기" : "BGM 켜기"}
      onClick={onClick}
      style={PILL_STYLE}
    >
      {enabled ? "🎵" : "🔇"}
    </button>
  );
}
