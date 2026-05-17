/**
 * MushroomHouseEntryLabel (Round 26.1, PR-156) — 농장 카드에 떠있는
 * "🍄 집 들어가기" frosted pill 라벨.
 *
 * 사용자 의도:
 *   - hit-region 만으로는 "여기 누르면 들어간다" 시각 단서 부족
 *   - 라벨이 버섯집 모자 위에 살짝 떠있어 즉시 인지 + 클릭 가능 신호
 *
 * 좌표 (R26.1 기본값, 베타 미세 조정):
 *   left: 4%, top: 19%
 *
 * 클릭 시:
 *   1. (첫 1회만) toast 안내 + cc.farmhub.first_open.v1 영속
 *   2. cc:mushroom-house:open dispatch → MushroomHouseRoom 풀스크린 open
 *
 * production: DEV 보정 store 의 setter 가 no-op 이라 default 값 고정.
 */

import { MUSHROOM_HOUSE_OPEN_EVENT } from "../decor/MushroomHouseRoom";
import {
  useDevHitRegionStore,
  DEFAULT_FARMHUB_LABEL_POS,
} from "../dev/devHitRegionStore";
import { safeStorage } from "../../lib/safeStorage";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";

const IS_DEV =
  typeof import.meta !== "undefined" &&
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

const FIRST_OPEN_KEY = "cc.farmhub.first_open.v1";

function isFirstOpen(): boolean {
  return safeStorage.get(FIRST_OPEN_KEY) !== "1";
}

function markOpened(): void {
  try {
    safeStorage.set(FIRST_OPEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function openMushroomHouse(): void {
  const first = isFirstOpen();
  if (first) {
    markOpened();
    haptic("success");
    toast("🐰 가구를 모아서 우리 집을 꾸며봐!");
  } else {
    haptic("light");
  }
  try {
    window.dispatchEvent(new CustomEvent(MUSHROOM_HOUSE_OPEN_EVENT));
  } catch {
    /* SSR */
  }
}

export function MushroomHouseEntryLabel() {
  const labelPos = useDevHitRegionStore((s) => s.labelPos);
  const effective = IS_DEV ? labelPos : DEFAULT_FARMHUB_LABEL_POS;

  return (
    <button
      type="button"
      data-testid="farm-mushroom-house-label"
      aria-label="버섯집 들어가기"
      onClick={openMushroomHouse}
      className="mushroom-label-pill"
      style={{
        position: "absolute",
        left: `${effective.left}%`,
        top: `${effective.top}%`,
        // R26.4 — 하늘 보기 pillStyle 과 동일 톤. bg opacity 0.85 → 0.55,
        // text color → rgba(43,24,16,0.78), textShadow 추가. 같은 frosted
        // glass 톤으로 시각 일관성.
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.6)",
        color: "rgba(43, 24, 16, 0.78)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.01em",
        textShadow: "0 1px 1px rgba(255,255,255,0.4)",
        whiteSpace: "nowrap",
        cursor: "pointer",
        zIndex: 5,
      }}
    >
      🍄 집 들어가기
    </button>
  );
}
