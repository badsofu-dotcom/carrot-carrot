/**
 * BuffChipsRow (PR-59) — 활성 buff chip 들의 가로 row.
 *
 * 농장 카드 상단에 mount. PR-17a 의 BuffIndicator 폐기 후 본
 * 컴포넌트가 대체. 각 chip 은 자체 1초 tick 으로 remaining 갱신,
 * 탭 시 BuffInfoPopover 노출.
 *
 * 자동 렌더링 — 모든 BuffKind 의 chip 을 시도해서 active 한 것만
 * 화면에 나옴. 새 buff 추가 시 BUFF_META 에 entry 하나 더하면 자동
 * 등장 (확장 가능 구조).
 */
import { useState } from "react";
import { type BuffKind } from "../collection/buffsStore";
import { BUFF_META } from "./buffEffects";
import { BuffChip } from "./BuffChip";
import { BuffInfoPopover } from "./BuffInfoPopover";

const ALL_KINDS: readonly BuffKind[] = Object.keys(BUFF_META) as BuffKind[];

export function BuffChipsRow() {
  const [openKind, setOpenKind] = useState<BuffKind | null>(null);

  return (
    <>
      <div
        data-testid="buff-chips-row"
        aria-label="활성 버프"
        style={{
          position: "absolute",
          top: 42,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          pointerEvents: "none", // chip 자체는 pointerEvents auto
          zIndex: 5,
        }}
      >
        {ALL_KINDS.map((kind) => (
          <div key={kind} style={{ pointerEvents: "auto" }}>
            <BuffChip kind={kind} onTap={() => setOpenKind(kind)} />
          </div>
        ))}
      </div>
      <BuffInfoPopover kind={openKind} onClose={() => setOpenKind(null)} />
    </>
  );
}
