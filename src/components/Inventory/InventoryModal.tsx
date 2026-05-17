/**
 * InventoryModal — bottom sheet listing all 13 inventory item slots.
 *
 * Layout
 *   - Sheet covers the bottom 70 vh of the viewport, rounded 24px,
 *     drag handle + title "내 가방".
 *   - Segmented tabs: 자원 / 도구 아이템 / 컬렉션 — driven by
 *     `ItemDef.tab`.
 *   - 4-column grid; each cell ~80×80; PNG icon + count + Korean name;
 *     locked items render dim with an acquisition hint.
 *
 * Use buttons
 *   - Tool-tab items with `usable: true` show "사용" when
 *     count >= minToUse (default 1). Local effects:
 *       hourglass → growAllPlanted(1, snapshot)
 *       bolt      → toolStore.refillFromAd (+3 wateringCan, +1 if soup)
 *       juice     → buffsStore.activate("juice")  next-harvest candy +5%p
 *       soup      → buffsStore.activate("soup")   next-refill +1 charge
 *       cake      → buffsStore.activate("cake")   next-focus seed +1
 *       gem       → consume 5 → growAllPlanted seed +1
 *   - Worker route `/items/use` mirrors the count decrement (or skips
 *     when guest/preview). The buff flags themselves are client-only.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ITEMS, useItemsStore, type ItemCode, type ItemTab } from "../../features/collection/itemsStore";
import { ITEM_META } from "../../lib/itemMeta";
import { translateAcquisition } from "../../lib/i18n/sourceLabels";
import { useFarmStore } from "../../features/collection/farmStore";
import { useToolStore, TOOL_CONSTANTS } from "../../features/collection/toolStore";
import { useBuffsStore } from "../../features/collection/buffsStore";
import { useMissionsStore } from "../../features/missions/missionsStore";
import { toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";

const BASE = import.meta.env.BASE_URL;

// PR-31 — 3 탭: 자원 (currency+soft) / 도구 (consumable) / 토큰 (token).
// "컬렉션" 명은 도감 페이지의 AchievementsCard + bunny grid 와 혼동
// 되므로 폐기.
const TAB_LABELS: Record<ItemTab, string> = {
  resources: "자원",
  tools: "도구 아이템",
  tokens: "토큰",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InventoryModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<ItemTab>("resources");
  // PR-41 — selected item state. Click a grid cell to highlight + show
  // bottom sticky panel with full description + acquisition + 사용하기
  // 버튼 (조건부). 같은 셀 재클릭 = unselect.
  const [selected, setSelected] = useState<ItemCode | null>(null);
  const counts = useItemsStore((s) => s.counts);
  const consume = useItemsStore((s) => s.consume);
  const carrots = useFarmStore((s) => s.carrots);
  const candy = useFarmStore((s) => s.candyCarrots);
  const golden = useFarmStore((s) => s.goldenCarrots);
  const seeds = useFarmStore((s) => s.seeds);
  const growAllPlanted = useFarmStore((s) => s.growAllPlanted);
  const refillFromAd = useToolStore((s) => s.refillFromAd);

  // Resource counts come from useFarmStore for the four farm
  // currencies (carrot/candy/golden/seed) and from itemsStore for
  // everything else. The bag is just the read-out surface; the
  // canonical source stays in farmStore so harvest / focus / tier
  // rewards keep working unchanged. PR-31 added seed mirror.
  const liveResourceCount = (code: ItemCode): number => {
    switch (code) {
      case "carrot": return carrots;
      case "candy": return candy;
      case "golden": return golden;
      case "seed": return seeds;
      case "carrot_coin": return counts.carrot_coin;
      default: return counts[code] ?? 0;
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // PR-41 — modal close + tab switch unselect.
  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);
  useEffect(() => {
    setSelected(null);
  }, [tab]);

  const items = ITEMS.filter((i) => i.tab === tab);

  const onUse = (code: ItemCode) => {
    haptic("medium");
    // PR-33 — gem 은 GemTradeModal 가 5 옵션 처리. consume 안 하고
    // dispatch 만; 모달이 옵션 선택 시 자기 비용으로 consume.
    if (code === "gem") {
      try {
        window.dispatchEvent(new CustomEvent("cc:gem-trade:open"));
      } catch {
        /* SSR */
      }
      return;
    }
    const def = ITEMS.find((i) => i.code === code);
    const cost = def?.minToUse ?? 1;
    if (!consume(code, cost)) {
      toast("아이템이 부족해요");
      return;
    }
    // PR-52 — tool_use 미션 트리거 (모든 도구/아이템 사용 카운트).
    useMissionsStore.getState().incrementProgress("tool_use", 1);
    switch (code) {
      case "hourglass":
        growAllPlanted(1, Date.now(), 0);
        toast("⏳ 작물이 한 단계 자랐어요");
        break;
      case "bolt": {
        // Mirror `tools/refill` locally: +3 wateringCan up to MAX_DAILY,
        // bypassing the per-day ad cap because the item itself is the
        // ad reward. Uses refillFromAd to keep the path symmetric.
        // Pre-consume soup buff (PR-9) so bolt also benefits; if the
        // refill itself fails, restore the buff so it isn't wasted.
        const soupActive = useBuffsStore.getState().consume("soup");
        if (refillFromAd(soupActive ? 1 : 0)) {
          toast(
            soupActive ? "⚡ 물뿌리개 +4 충전 (수프 효과)" : "⚡ 물뿌리개 +3 충전",
          );
        } else {
          if (soupActive) useBuffsStore.getState().activate("soup");
          toast("오늘 광고 충전 한도 가득");
        }
        break;
      }
      case "juice":
        useBuffsStore.getState().activate("juice");
        toast("🥤 다음 수확 캔디 확률 +5%p");
        break;
      case "soup":
        useBuffsStore.getState().activate("soup");
        toast("🍲 다음 물뿌리개 충전 +1");
        break;
      case "cake":
        useBuffsStore.getState().activate("cake");
        toast("🍰 다음 포커스 완료 시 씨앗 +1");
        break;
      // gem 케이스는 위 가드에서 GemTradeModal 로 분기 — 도달 안 함.
      case "carrot_coin":
        // PR-24 — 50 coin 사용 → 캔디 당근 +1. 광고 누적 → 캔디 변환
        // 의 sink. consume 은 이미 위에서 cost (50) 만큼 진행됨.
        useFarmStore.getState().incCandyCarrots(1);
        toast(`🪙 코인 ${cost}개 사용 → 캔디 당근 +1`);
        break;
      default:
        break;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1060,
              background: "rgba(0,0,0,0.45)",
            }}
            data-testid="inventory-backdrop"
          />
          <motion.div
            data-testid="inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-label="내 가방"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "fixed",
              // Center horizontally via margin auto. Don't use
              // transform: translateX(-50%) here — framer-motion owns
              // the transform property for the y slide-in animation and
              // would clobber an inline X translation, which is what
              // pushed the sheet off-screen-right on mobile (PR-6.5).
              left: 0,
              right: 0,
              marginLeft: "auto",
              marginRight: "auto",
              // PR-68 — bottom 을 TabBar 위로 띄움. 기존 bottom:0 +
              // 90vh maxHeight 조합에서 DetailPanel "획득 방법" 줄 +
              // ActionBar 가 TabBar (z-index 100, parent stacking context
              // 에 따라 위로 떠 보이는 케이스) 에 가려져 잘리는 회귀.
              // --tabbar-reserved (height + offset*2 = 100px) + safe-area
              // 만큼 띄우면 TabBar 완전 위에 위치.
              bottom: "calc(var(--tabbar-reserved, 100px) + env(safe-area-inset-bottom))",
              zIndex: 1061,
              width: "100%",
              maxWidth: "var(--app-max-width, 480px)",
              // PR-56 → PR-67 → PR-68 — bottom 이 위로 올라간 만큼
              // 사용 가능한 세로 공간이 줄어듦. maxHeight 도 viewport -
              // tabbar 영역 - safe area - 상단 여백 (12px) 로 동적 계산.
              // 작은 viewport (iPhone SE 568) 에서도 DetailPanel +
              // ActionBar 둘 다 표시되며 잘림 없음.
              minHeight: "60vh",
              maxHeight:
                "calc(100dvh - var(--tabbar-reserved, 100px) - env(safe-area-inset-bottom) - 12px)",
              background: "#FFF8EE",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              // PR-68 — padding-bottom 의 safe-area 제거 (bottom offset 에
              // 이미 포함). 잔여 20px 만 컨텐츠 내부 여백으로.
              padding:
                "12px calc(20px + env(safe-area-inset-right)) 20px calc(20px + env(safe-area-inset-left))",
              boxShadow: "0 -8px 28px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 44,
                height: 5,
                borderRadius: 999,
                background: "rgba(0,0,0,0.18)",
                margin: "4px auto 14px",
              }}
            />
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>내 가방</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(0,0,0,0.06)",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </header>

            {/* Segmented tabs */}
            <div
              role="tablist"
              aria-label="아이템 분류"
              style={{
                display: "flex",
                gap: 4,
                padding: 4,
                borderRadius: 12,
                background: "rgba(0,0,0,0.05)",
                marginBottom: 12,
              }}
            >
              {(Object.keys(TAB_LABELS) as ItemTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  data-testid={`inventory-tab-${t}`}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    height: 32,
                    border: "none",
                    borderRadius: 8,
                    background: tab === t ? "#fff" : "transparent",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    color: tab === t ? "#2b2b2b" : "#888",
                  }}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>

            {/* PR-41 — scrollable grid. flex:1 + minHeight:0 takes the
                vertical space between header/tabs and the bottom sticky
                detail panel. */}
            <div
              data-testid="inventory-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                // PR-56 — 2행 시 빈 컬럼 자리로 row 가 늘어나는 것 차단.
                // gridAutoRows: min-content 로 각 행이 cell 내재 사이즈
                // (aspectRatio 1/1 = column width) 만 차지하도록 강제.
                // alignContent: start 가 grid 컨테이너가 비었을 때
                // (또는 컨텐츠가 작을 때) row 들이 상단에 pin.
                gridAutoRows: "min-content",
                alignContent: "start",
                rowGap: 10,
                columnGap: 10,
                overflowY: "auto",
                paddingBottom: 8,
                flex: 1,
                minHeight: 0,
              }}
            >
              {items.map((it) => {
                const count = liveResourceCount(it.code);
                const owned = count > 0;
                const isSelected = selected === it.code;
                return (
                  <button
                    type="button"
                    key={it.code}
                    data-testid={`inv-${it.code}`}
                    aria-pressed={isSelected}
                    title={it.ko}
                    onClick={() => {
                      haptic("light");
                      setSelected((cur) => (cur === it.code ? null : it.code));
                    }}
                    style={{
                      position: "relative",
                      background: "#fff",
                      // PR-41 — 주황 외곽선 강조 (선택 상태). 비선택 시
                      // 옅은 회색 hairline.
                      border: isSelected
                        ? "2px solid #FF7B61"
                        : "1px solid rgba(0,0,0,0.05)",
                      borderRadius: 14,
                      width: "100%",
                      aspectRatio: "1 / 1",
                      padding: 6,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      boxShadow: isSelected
                        ? "0 4px 12px rgba(255,123,97,0.25)"
                        : "0 1px 3px rgba(0,0,0,0.04)",
                      opacity: owned ? 1 : 0.45,
                      cursor: "pointer",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      // PR-44 — flex 부모 안에서 자식 img 가 자연 사이즈로
                      // overflow 하는 회귀 차단. cell 외곽선 너머로 이미지
                      // 가 비져나가지 않게 hard-clip.
                      overflow: "hidden",
                      boxSizing: "border-box",
                    }}
                  >
                    <img
                      src={`${BASE}${it.iconRel}`}
                      alt=""
                      draggable={false}
                      style={{
                        // PR-44 hotfix — max-* 추가. flex/grid 컨테이너
                        // 가 img 의 intrinsic 사이즈를 따라 자라는 일부
                        // 브라우저 동작 (특히 큰 PNG asset) 차단.
                        width: 40,
                        height: 40,
                        maxWidth: 40,
                        maxHeight: 40,
                        objectFit: "contain",
                        flexShrink: 0,
                        filter: owned ? "none" : "grayscale(0.85)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: "center",
                        color: owned ? "#2b2b2b" : "#888",
                        lineHeight: 1.1,
                      }}
                    >
                      {it.ko}
                    </span>
                    <span
                      aria-label={`${it.ko} ${count}개`}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        color: owned ? "#FF7B61" : "#888",
                      }}
                    >
                      {count > 0 ? count : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* PR-41 — Detail panel (info-only, scrollable).
                PR-57 — usable 아이템의 "사용" 버튼은 별도 ActionBar 로
                분리해서 panel 내부 스크롤과 무관하게 항상 보임. */}
            <DetailPanel
              code={selected}
              count={selected ? liveResourceCount(selected) : 0}
            />
            <ActionBar
              code={selected}
              count={selected ? liveResourceCount(selected) : 0}
              onUse={onUse}
            />

            {/* Footer summary */}
            {selected === null && (
              <p
                style={{
                  margin: "8px 4px 0",
                  fontSize: 11,
                  color: "#888",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                총 {ITEMS.length}종 · 보유 {useItemsStore.getState().speciesOwned()}종
                {tab === "resources" && (
                  <>
                    {" · "}
                    🥕 {carrots} · 🍬 {candy} · ✨ {golden} · 🌱 {seeds}
                  </>
                )}
                {tab === "tools" && (
                  <>
                    {" · "}
                    최대 광고 충전 {TOOL_CONSTANTS.MAX_AD_REFILLS}회/일
                  </>
                )}
              </p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * PR-41 — Bottom sticky detail panel. Shown only when an item cell is
 * tapped. Folds icon + name + count + longDescription + acquisition +
 * "사용하기" 버튼을 한 surface 에 묶음. 비선택 상태에서는 모달 본문이
 * 기본 footer 요약을 사용 (호출자 측에서 조건부 렌더).
 */
function DetailPanel({
  code,
  count,
}: {
  code: ItemCode | null;
  count: number;
}) {
  if (!code) return null;
  const def = ITEMS.find((i) => i.code === code);
  if (!def) return null;
  const meta = ITEM_META[code];
  return (
    <div
      data-testid="inventory-detail"
      style={{
        flexShrink: 0,
        marginTop: 10,
        padding: "12px 14px 16px",
        background: "#fff",
        border: "1px solid rgba(255,123,97,0.25)",
        borderRadius: 14,
        boxShadow: "0 -2px 8px rgba(255,123,97,0.06)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        // PR-56 — DetailPanel 본문 잘림 차단. 긴 description 이 작은
        // viewport (iPhone SE) 에서 modal 하단 padding 안으로 잘리던
        // 회귀 fix. maxHeight + overflowY auto 로 본문 자체 스크롤.
        maxHeight: "min(280px, 45vh)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <img
        src={`${BASE}${def.iconRel}`}
        alt=""
        width={42}
        height={42}
        style={{
          // PR-44 — width/height attribute 만으로는 일부 브라우저가
          // intrinsic 사이즈를 따름. inline style 로 hard-clamp.
          width: 42,
          height: 42,
          maxWidth: 42,
          maxHeight: 42,
          objectFit: "contain",
          flexShrink: 0,
          marginTop: 2,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
            {def.ko}
          </h3>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: count > 0 ? "#FF7B61" : "#888",
            }}
          >
            보유 {count}
          </span>
        </div>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 12,
            color: "#444",
            lineHeight: 1.4,
          }}
        >
          {meta.longDescription}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11,
            color: "#888",
            lineHeight: 1.3,
          }}
        >
          획득 방법: {translateAcquisition(def.acquisition)}
        </p>
      </div>
    </div>
  );
}

/**
 * ActionBar (PR-57) — DetailPanel 과 분리된 sticky 사용 버튼.
 *
 * DetailPanel 의 maxHeight overflow 스크롤과 무관하게 항상 보임.
 * usable === false 면 미렌더 (자원 chip 등은 사용 버튼 불필요).
 * minToUse 미달 시 disabled + "최소 N개 필요" 안내.
 * code === null 이면 미렌더.
 */
function ActionBar({
  code,
  count,
  onUse,
}: {
  code: ItemCode | null;
  count: number;
  onUse: (c: ItemCode) => void;
}) {
  if (!code) return null;
  const def = ITEMS.find((i) => i.code === code);
  if (!def || !def.usable) return null;
  const minToUse = def.minToUse ?? 1;
  const canUse = count >= minToUse;
  const label = (() => {
    if (canUse) {
      return minToUse > 1 ? `사용하기 (${minToUse}개 소비)` : "사용하기";
    }
    if (count === 0) return "보유 부족";
    return `최소 ${minToUse}개 필요`;
  })();
  return (
    <div
      data-testid="inventory-action-bar"
      style={{
        flexShrink: 0,
        marginTop: 8,
        padding: "8px 4px 0",
        borderTop: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "0 -2px 6px rgba(0,0,0,0.04)",
      }}
    >
      <button
        type="button"
        data-testid={`inventory-use-${code}`}
        onClick={() => onUse(code)}
        disabled={!canUse}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 12,
          border: "none",
          background: canUse ? "#FF7B61" : "rgba(0,0,0,0.08)",
          color: canUse ? "#fff" : "#888",
          fontWeight: 800,
          fontSize: 14,
          cursor: canUse ? "pointer" : "not-allowed",
          transition: "background 0.15s, transform 0.15s",
        }}
        onPointerDown={(e) => {
          if (canUse) e.currentTarget.style.transform = "scale(0.97)";
        }}
        onPointerUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {label}
      </button>
    </div>
  );
}
