/**
 * OutdoorSlots (Round 22, PR-145) — 4 야외 가구 슬롯 오버레이.
 *
 * FarmHub 의 농장 카드 위에 absolute 위치로 4개 슬롯을 띄운다. 각
 * 슬롯은 farm_outdoor room 의 x 인덱스 0..3 에 매핑.
 *
 * 빈 슬롯: 점선 사각형 + ＋ 아이콘. 탭 → 가구 상점 (야외 카테고리) 열기.
 * 채워진 슬롯: 가구 sprite (emoji placeholder). 탭 → 제거 / 교체 모달.
 *
 * 위치는 PLOT_POLYGONS 와 겹치지 않게 9-plot 주변에 4개 고정.
 * % 좌표는 farm card 의 (width, height) 비율 기준. 디자인 잠금:
 *   slot0  좌상단 (버섯집 옆)        — top 14%, left 12%
 *   slot1  우상단 (나무 옆)          — top 14%, left 78%
 *   slot2  좌하단 (9-plot 좌측)       — top 70%, left 8%
 *   slot3  우하단 (9-plot 우측)       — top 70%, left 80%
 */

import { useState } from "react";
import { useDecorStore } from "./decorStore";
import { FURNITURE_BY_ID } from "./catalog";
import {
  FURNITURE_SHOP_OPEN_EVENT,
} from "./FurnitureShopModal";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";

interface SlotPos {
  /** 0..3 (room x index). */
  idx: number;
  /** top % (farm card height). */
  top: number;
  /** left % (farm card width). */
  left: number;
}

const OUTDOOR_SLOTS: readonly SlotPos[] = [
  { idx: 0, top: 14, left: 12 },
  { idx: 1, top: 14, left: 78 },
  { idx: 2, top: 70, left: 8 },
  { idx: 3, top: 70, left: 80 },
];

const SLOT_SIZE_PCT = 12; // % of farm card min dimension

export function OutdoorSlots() {
  const placements = useDecorStore((s) => s.placements);
  const removePlacement = useDecorStore((s) => s.removePlacement);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  function placedAt(idx: number): string | null {
    const hit = placements.find(
      (p) => p.room === "farm_outdoor" && p.x === idx,
    );
    return hit ? hit.furnitureId : null;
  }

  function openShop() {
    try {
      window.dispatchEvent(
        new CustomEvent(FURNITURE_SHOP_OPEN_EVENT, {
          detail: { category: "outdoor" },
        }),
      );
    } catch {
      /* SSR */
    }
  }

  function onEmptyTap() {
    haptic("light");
    openShop();
  }

  function onFilledTap(idx: number, furnitureId: string) {
    haptic("light");
    setConfirmRemove(furnitureId);
    // 단순 confirm 토스트 패턴: 다음 탭이 빈 슬롯이면 자동 cleared.
    // PHASE 4 베타 스코프 — confirm modal 은 R23 에서. 지금은 즉시 제거.
    removePlacement(furnitureId);
    toast(`${FURNITURE_BY_ID[furnitureId]?.name ?? "가구"} 보관함으로 이동 — 다시 배치하려면 상점 열기`);
    // mark used to avoid lint warning; future R23 will surface a modal.
    void confirmRemove;
    void idx;
  }

  return (
    <>
      {OUTDOOR_SLOTS.map((s) => {
        const fid = placedAt(s.idx);
        const f = fid ? FURNITURE_BY_ID[fid] : null;
        return (
          <button
            key={s.idx}
            type="button"
            data-testid={`outdoor-slot-${s.idx}`}
            aria-label={
              f
                ? `${f.name} 배치됨 — 탭하면 제거`
                : `야외 슬롯 ${s.idx + 1} 비어있음 — 탭하면 상점 열기`
            }
            onClick={() => {
              if (fid) onFilledTap(s.idx, fid);
              else onEmptyTap();
            }}
            style={{
              position: "absolute",
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${SLOT_SIZE_PCT}%`,
              aspectRatio: "1 / 1",
              minWidth: 32,
              minHeight: 32,
              transform: "translate(-50%, -50%)",
              borderRadius: 12,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: f
                ? "rgba(255,255,255,0.55)"
                : "rgba(255,255,255,0.18)",
              backdropFilter: f ? "blur(6px)" : undefined,
              WebkitBackdropFilter: f ? "blur(6px)" : undefined,
              border: f
                ? "1px solid rgba(255,255,255,0.7)"
                : "1.5px dashed rgba(255,255,255,0.65)",
              color: f ? "#2b2b2b" : "rgba(255,255,255,0.85)",
              fontSize: 24,
              cursor: "pointer",
              zIndex: 3,
              boxShadow: f ? "0 2px 6px rgba(0,0,0,0.18)" : "none",
            }}
          >
            {f ? <span aria-hidden>{f.sprite}</span> : "＋"}
          </button>
        );
      })}
    </>
  );
}
