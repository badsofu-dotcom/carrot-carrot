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
import { useFarmStore } from "../../features/collection/farmStore";
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
    // PR-87 — "삽" → "모종삽" (사용자 용어와 일치, 씨앗 심기 의미 강화).
    label: "모종삽",
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
  const rollover = useToolStore((s) => s.rolloverIfNeeded);
  const itemCounts = useItemsStore((s) => s.counts);
  let speciesOwned = 0;
  for (const v of Object.values(itemCounts)) if (v > 0) speciesOwned++;
  // PR-87 — 모종삽 칩 badge 에 씨앗 수량 표시 (informational).
  // 현재 farmStore.plant 는 씨앗 소비 안 함 (자유 plant) — itemMeta.ts
  // seed.effect 의 "향후 소비 예정" 상태 그대로. 사용자 시각 단서로
  // 보유 씨앗을 노출하되, 0 이라도 disable 안 함 (plant 가 free 라
  // disable 시 plant 자체가 중단). 추후 seed consumption wire 시 0 →
  // disable + 토스트 패턴으로 전환.
  const seeds = useFarmStore((s) => s.seeds);
  // PR-28 — heart 토큰은 광고 시청 가능 잔여 횟수.
  // PR-98 — heart maxStack=5 인데 badge "N/3" 는 친구 wave bonus 후
  // overflow ("4/3", "5/3") 표시 버그. 분모 제거 — wateringCan 의 PR-88
  // 패턴 일관 적용. HEART_DAILY_MAX 상수는 의미 있는 분모 사용 케이스
  // 위해 보존하지 않고 inline 제거.
  const heartCount = itemCounts.heart ?? 0;

  // Kick the rollover check on mount so the day key is fresh.
  rollover();

  const onSelect = (t: ToolDef) => {
    if (t.passive) return;
    // PR-88 — 물뿌리개 잔여 0 시 select 차단 + 안내 토스트.
    // (이전엔 select 후 사용 시점 toast — 사용자가 이미 선택한 다음
    // 좌절하는 흐름. 칩 차원에서 차단해서 시각 신호 일관성.)
    if (t.id === "watering_can" && wateringLeft <= 0) {
      void import("../../design-system/ui").then((m) =>
        m.toast("오늘 10회 다 썼어요. 자정에 다시 채워져요"),
      );
      return;
    }
    haptic("light");
    const nextId: ToolId | null = selected === t.id ? null : t.id;
    setSelected(nextId);
    emitToolSelected(nextId);
  };

  const onOpenBag = () => {
    haptic("light");
    try {
      window.dispatchEvent(new CustomEvent("cc:bag:open"));
    } catch {
      /* SSR */
    }
  };

  // PR-28 — 광고 슬롯 클릭. 하트 잔여 0 이면 안내 토스트 후 no-op.
  // (PR-24 에서 AdRewardChannelModal 의 claim 측이 하트를 consume.)
  const onOpenAdChannel = () => {
    if (heartCount <= 0) {
      // PR-107 — 하트 토큰 = 광고 시청 자격. 자정 리필 안내 일관.
      void import("../../design-system/ui").then((m) =>
        m.toast("🩷 하트가 없어요. 자정에 다시 채워져요"),
      );
      return;
    }
    haptic("light");
    try {
      window.dispatchEvent(new CustomEvent("cc:ad-channel:open"));
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
        // PR-88 — 물뿌리개 badge 옵션 C:
        //   wateringLeft > 5 → just "N"
        //   1..5 → "N" + warning color (badge bg = warning yellow)
        //   0    → "끝" + chip disabled
        if (t.id === "watering_can") {
          if (wateringLeft === 0) badge = "끝";
          else badge = String(wateringLeft);
        }
        // PR-87 — 모종삽 = 씨앗 심기 도구 → 보유 씨앗 informational 표시.
        if (t.id === "shovel") badge = `🌱 ${seeds}`;
        const wateringDisabled = t.id === "watering_can" && wateringLeft <= 0;
        const wateringWarning =
          t.id === "watering_can" && wateringLeft > 0 && wateringLeft <= 5;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            data-testid={`tool-${t.id}`}
            // PR-87 — shovel/watering_can 은 informational badge 가 있어서
            // aria-label 에도 수치 명시 (screenreader 가독성).
            aria-label={
              t.id === "shovel"
                ? `모종삽 — 씨앗 ${seeds}개 보유`
                : t.id === "watering_can"
                  ? wateringLeft === 0
                    ? "물뿌리개 — 오늘 사용 한도 도달"
                    : wateringLeft <= 5
                      ? `물뿌리개 — ${wateringLeft}회 남음 (오늘 마지막)`
                      : `물뿌리개 — ${wateringLeft}회 남음`
                  : t.label
            }
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
              // PR-88 — 물뿌리개 잔여 0 시 disabled 시각 단서.
              cursor: t.passive
                ? "default"
                : wateringDisabled
                  ? "not-allowed"
                  : "pointer",
              opacity: wateringDisabled ? 0.45 : 1,
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
                  // PR-88 — warning state (잔여 1..5): badge bg = soft amber.
                  // Disabled (0): grey out. 그 외: 기본 white.
                  background: wateringDisabled
                    ? "rgba(0,0,0,0.08)"
                    : wateringWarning
                      ? "#FFE3A8"
                      : "#fff",
                  color: wateringDisabled ? "#888" : "#222",
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

      {/* Bag (inventory) — InventoryModal trigger.
          PR-86 — 자루 비주얼 PNG 때문에 사용자가 "씨앗 자루" (자원)
          으로 오해. 실제로는 가방 (인벤토리) 진입점. 라벨/툴팁
          명확화: aria-label 에 보유 species 수 명시, title 추가.
          Badge 의미: speciesOwned = 0 보다 큰 ItemCode 종 수 (가방
          안에 N 종류 들어있다 표시). */}
      <button
        type="button"
        onClick={onOpenBag}
        data-testid="tool-bag"
        aria-label={`내 가방 (${speciesOwned}종 보유)`}
        title="내 가방"
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

      {/* PR-28 — 5번째 슬롯: 광고 (AdRewardChannelModal 진입).
          Badge: heart 잔여 N/3. heart 0 일 때 disabled + 안내 토스트.
          이전 PR-6 부터의 conditional "🎬 +3 충전" 버튼은 ad 슬롯이
          광고 채널 진입을 항상 노출하므로 제거. */}
      <button
        type="button"
        onClick={onOpenAdChannel}
        disabled={heartCount <= 0}
        data-testid="tool-ad"
        aria-label={
          heartCount > 0
            ? `광고 시청 (하트 ${heartCount}개 보유)`
            : "광고 시청 — 하트 부족, 자정에 다시 채워져요"
        }
        title={
          heartCount > 0
            ? `광고 시청 (하트 ${heartCount}개)`
            : "하트 부족"
        }
        style={{
          position: "relative",
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          background: heartCount > 0 ? ACCENT : "rgba(0,0,0,0.08)",
          color: heartCount > 0 ? "#fff" : "#888",
          border: "1px solid rgba(0,0,0,0.08)",
          transition: "transform 0.18s ease, background 0.18s ease",
          cursor: heartCount > 0 ? "pointer" : "not-allowed",
          padding: 0,
          overflow: "visible",
          fontSize: 26,
          lineHeight: 1,
        }}
      >
        <span aria-hidden>🎬</span>
        <span
          aria-hidden
          data-testid="tool-ad-badge"
          style={{
            position: "absolute",
            bottom: -3,
            right: -3,
            // PR-107 — 🩷 + 숫자 badge 위해 minWidth 확대 (이전 22 → 32).
            minWidth: 32,
            height: 16,
            borderRadius: 999,
            background: "#fff",
            color: heartCount > 0 ? "#222" : "#888",
            fontSize: 10,
            fontWeight: 800,
            padding: "0 5px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          }}
        >
          {/* PR-107 — 광고 칩 = 하트 토큰 표기 일치. 🩷 + N 으로 토큰
              카드 (InventoryModal heart) 와 시각 통일. */}
          🩷 {heartCount}
        </span>
      </button>
    </div>
  );
}
