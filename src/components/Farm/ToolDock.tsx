/**
 * ToolDock — bottom-of-farm-card tool selector + bag entry point.
 *
 * Lives inside the farm card (absolute, above the help-copy chip) and
 * never overlaps the BottomNav. Three tool slots + one passive bag
 * slot; active tool slot is outlined in accent orange and scaled 1.05.
 *
 * Tools:
 *   - shovel       → plant on tap
 *   - watering_can → water on tap (with daily 10-charge gate)
 *   - basket       → harvest on tap
 *   - bag (passive) → dispatches `cc:bag:open`, no select state
 *
 * The bag slot replaces the old farm-header bag button (PR-6) so all
 * "소지품류" entry points live on the bottom tray.
 *
 * Badges:
 *   - watering_can: shows `N/10` (KST-daily) in the bottom-right corner
 *   - bag: shows owned-species count in the top-right corner
 *   - shovel / basket: no badge (infinite)
 *
 * The dock dispatches a `cc:tool:selected` CustomEvent for tool slots
 * so FarmHub's click handler can branch without prop-drilling. The bag
 * slot dispatches `cc:bag:open` (CollectionPage owns the modal).
 */
import { useToolStore, type ToolId } from "../../features/collection/toolStore";
import { useItemsStore } from "../../features/collection/itemsStore";
import { haptic } from "../../design-system/haptic";

const BASE = import.meta.env.BASE_URL;
const ACCENT = "#FF7B61";

interface ToolDef {
  id: ToolId;
  label: string;
  /** PNG src; undefined means we fall back to `fallback` glyph. */
  src?: string;
  fallback?: string;
  /** If true, slot doesn't select on tap (display-only). */
  passive?: boolean;
  /**
   * Per-tool visual-compensation multiplier on top of `ICON_SIZE`.
   * 1.0 = no compensation (basket has a tight PNG bbox).
   * 1.25 = shovel / watering_can PNGs ship with ~20 % transparent
   * margin, so we transform-scale them up to land at the same visible
   * content size as the basket / bag. Tuned by eye on a 64 px slot.
   *
   * PR-11: previous version used per-tool `size` (px). The disparity
   * between `size: 58` (shovel/can) and `size: 46` (basket) still made
   * shovel/can read smaller because the PNG content fills less of the
   * box. Uniform `ICON_SIZE` + transform `scale()` gives a single
   * "max bounding box" knob and a separate "padding compensation" knob.
   */
  scale: number;
}

/** Dock chrome — 3 tool slots + 1 bag slot. Slot 64 px (fixed).
 *  Icon bounding box ICON_SIZE for all; per-icon `scale` compensates
 *  the PNG-padding asymmetry without resizing the slot box.
 *  Centered inside the farm card. */
const SLOT_SIZE = 64;
const ICON_SIZE = 50;
/** Per-PNG bbox compensation.
 *  - SCALE_PADDED (모종삽/물뿌리개): PNG ships with heavy transparent
 *    margin so visible content fills ~70% of the box. 1.45 brings the
 *    visible content up to ~50 px on a 50 px display (72.5 box × 0.7).
 *    PR-11 1.25 → PR-14 1.45 (user wanted larger). Hold.
 *  - SCALE_TIGHT (바구니/주머니): PNG bbox is already tight (~100%
 *    fill), so the visible content is the full 50 px. After PR-14 the
 *    user observed basket/bag reading slightly larger than the padded
 *    tools — PR-18 shrinks the display side to 0.9 (45 px visible) so
 *    all four slots land within ~5 px of each other.
 *  Bleed math (PR-14): 50 × 1.45 = 72.5, (72.5 - 64) / 2 = 4.25 px on
 *  each side, < gap 6 → no adjacent slot encroachment. */
const SCALE_PADDED = 1.45;
const SCALE_TIGHT = 0.9;

const TOOL_DEFS: ToolDef[] = [
  {
    id: "shovel",
    label: "삽",
    src: `${BASE}assets/farm/tools/tool_shovel.png`,
    scale: SCALE_PADDED,
  },
  {
    id: "watering_can",
    label: "물뿌리개",
    src: `${BASE}assets/farm/tools/tool_watering_can.png`,
    scale: SCALE_PADDED,
  },
  {
    id: "basket",
    label: "바구니",
    src: `${BASE}assets/farm/tools/tool_basket.png`,
    scale: SCALE_TIGHT,
  },
];

export const TOOL_SELECTED_EVENT = "cc:tool:selected";

export function emitToolSelected(id: ToolId | null): void {
  try {
    window.dispatchEvent(
      new CustomEvent(TOOL_SELECTED_EVENT, { detail: { id } }),
    );
  } catch {
    /* SSR */
  }
}

export function ToolDock() {
  const selected = useToolStore((s) => s.selected);
  const setSelected = useToolStore((s) => s.select);
  const wateringLeft = useToolStore((s) => s.wateringCanLeft);
  const adRefills = useToolStore((s) => s.adRefillsToday);
  const rollover = useToolStore((s) => s.rolloverIfNeeded);
  const itemCounts = useItemsStore((s) => s.counts);
  let speciesOwned = 0;
  for (const v of Object.values(itemCounts)) if (v > 0) speciesOwned++;

  // Kick the rollover check on mount so the day key is fresh.
  rollover();

  const onSelect = (t: ToolDef) => {
    if (t.passive) return;
    haptic("light");
    const nextId: ToolId | null = selected === t.id ? null : t.id;
    setSelected(nextId);
    emitToolSelected(nextId);
  };

  // The refill button now opens the AdRewardChannelModal. The channel
  // modal owns the per-day cap + nonce stub; it calls refillFromAd()
  // internally when the user picks the watering channel.
  const onRefill = () => {
    window.dispatchEvent(new CustomEvent("cc:ad-channel:open"));
  };

  const onOpenBag = () => {
    haptic("light");
    try {
      window.dispatchEvent(new CustomEvent("cc:bag:open"));
    } catch {
      /* SSR */
    }
  };

  return (
    <div
      data-testid="tool-dock"
      role="toolbar"
      aria-label="농장 도구 및 가방"
      style={{
        position: "absolute",
        left: "50%",
        bottom: 8,
        transform: "translateX(-50%)",
        display: "flex",
        gap: 6,
        padding: "4px 6px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        zIndex: 4,
      }}
    >
      {TOOL_DEFS.map((t) => {
        const isActive = selected === t.id;
        let badge: string | null = null;
        if (t.id === "watering_can") badge = `${wateringLeft}/10`;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            data-testid={`tool-${t.id}`}
            aria-label={t.label}
            aria-pressed={isActive}
            style={{
              position: "relative",
              width: SLOT_SIZE,
              height: SLOT_SIZE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "rgba(255,255,255,0.6)",
              border: isActive
                ? `2px solid ${ACCENT}`
                : "1px solid rgba(0,0,0,0.08)",
              transform: isActive ? "scale(1.05)" : "scale(1)",
              transition: "transform 0.18s ease, border-color 0.18s ease",
              cursor: t.passive ? "default" : "pointer",
              padding: 0,
              overflow: "visible",
            }}
          >
            {t.src ? (
              <img
                src={t.src}
                alt=""
                draggable={false}
                style={{
                  width: ICON_SIZE,
                  height: ICON_SIZE,
                  objectFit: "contain",
                  // PR-11: uniform bounding box for every dock icon
                  // (50×50). `transform: scale()` does the per-PNG
                  // padding compensation so visible content reads at
                  // roughly the same size across all 4 slots. flexShrink
                  // + min-w/h locks the basis so the flex parent doesn't
                  // squeeze the icon below ICON_SIZE.
                  transform: `scale(${t.scale})`,
                  flexShrink: 0,
                  minWidth: ICON_SIZE,
                  minHeight: ICON_SIZE,
                }}
              />
            ) : (
              <span aria-hidden style={{ fontSize: 28 }}>{t.fallback}</span>
            )}
            {badge !== null && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  bottom: -3,
                  right: -3,
                  minWidth: 18,
                  height: 16,
                  borderRadius: 999,
                  background: "#fff",
                  color: "#222",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "0 4px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}

      {/* Bag (inventory) — passive slot. Dispatches cc:bag:open so
          CollectionPage opens the InventoryModal. Replaces the old farm
          header bag button (PR-6). */}
      <button
        type="button"
        onClick={onOpenBag}
        data-testid="tool-bag"
        aria-label="가방 열기"
        style={{
          position: "relative",
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          background: "rgba(255,255,255,0.6)",
          border: "1px solid rgba(0,0,0,0.08)",
          transition: "transform 0.18s ease",
          cursor: "pointer",
          padding: 0,
          overflow: "visible",
        }}
      >
        <img
          src={`${BASE}assets/farm/items/item_bag.png`}
          alt=""
          draggable={false}
          style={{
            // PR-11: same ICON_SIZE + transform-scale pattern as the
            // tool slots above. bag PNG ships with a tight bbox so
            // SCALE_TIGHT — visually balanced with the basket slot.
            width: ICON_SIZE,
            height: ICON_SIZE,
            objectFit: "contain",
            transform: `scale(${SCALE_TIGHT})`,
            flexShrink: 0,
            minWidth: ICON_SIZE,
            minHeight: ICON_SIZE,
          }}
        />
        {speciesOwned > 0 && (
          <span
            aria-hidden
            data-testid="tool-bag-badge"
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              minWidth: 18,
              height: 16,
              borderRadius: 999,
              background: ACCENT,
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "0 4px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
            }}
          >
            {speciesOwned}
          </span>
        )}
      </button>

      {/* Watering-can refill button — only when out of charges. The
          preview/mock path increments locally; production will call the
          worker /tools/refill route after ad-verify. */}
      {wateringLeft === 0 && adRefills < 3 && (
        <button
          type="button"
          onClick={onRefill}
          data-testid="tool-refill"
          aria-label="광고 보고 물뿌리개 3회 충전"
          style={{
            height: SLOT_SIZE,
            padding: "0 10px",
            borderRadius: 12,
            background: ACCENT,
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          🎬 +3
          <br />
          충전
        </button>
      )}
    </div>
  );
}
