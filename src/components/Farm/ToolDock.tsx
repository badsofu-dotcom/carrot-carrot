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
   * Per-tool rendered icon size (px). Different source assets ship
   * with different intrinsic padding — shovel/can/seed have a lot of
   * transparent margin so they need a larger box to read as the same
   * visual weight as the basket (which is auto-bbox-cropped). Tuned
   * by eye from the 56×56 dock button.
   */
  size: number;
}

/** Dock chrome — three slots after this PR (seed_pack moved to the
 *  bag inventory). Slot 64 px, icon ~58 (padded) or 46 (basket-tight).
 *  Centered inside the farm card. */
const SLOT_SIZE = 64;

const TOOL_DEFS: ToolDef[] = [
  {
    id: "shovel",
    label: "삽",
    src: `${BASE}assets/farm/tools/tool_shovel.png`,
    size: 58,
  },
  {
    id: "watering_can",
    label: "물뿌리개",
    src: `${BASE}assets/farm/tools/tool_watering_can.png`,
    size: 58,
  },
  {
    id: "basket",
    label: "바구니",
    src: `${BASE}assets/farm/tools/tool_basket.png`,
    size: 46,
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
                  width: t.size,
                  height: t.size,
                  objectFit: "contain",
                  // The button is `display: flex` and the slot box is
                  // 48 px; an icon larger than that gets shrunk by the
                  // flex algorithm unless we lock its basis. The slot
                  // also has overflow: visible so the larger icon
                  // safely overflows by a few px on each side.
                  flexShrink: 0,
                  minWidth: t.size,
                  minHeight: t.size,
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
            width: 50,
            height: 50,
            objectFit: "contain",
            flexShrink: 0,
            minWidth: 50,
            minHeight: 50,
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
