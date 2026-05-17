/**
 * MushroomHouseHitRegion (Round 26, PR-154) — 농장 카드의 버섯집
 * 그림 위에 올라가는 투명 hit-region. 탭 → MushroomHouseRoom 모달 열기.
 *
 * 위치 (R26 옵션 B 확정값, 베타 미세 조정 가능):
 *   left: 2%, top: 24%, width: 26%, height: 28%
 *
 * 시각:
 *   - production: 완전 투명. 탭 시 brightness 1.1 + scale 1.02 micro
 *     feedback (prefers-reduced-motion 존중).
 *   - DEV + `useDevHitRegionStore.show === true`: 빨간 반투명 + outline
 *     으로 영역 가시화 — ± 버튼으로 미세 조정.
 *
 * 마운트: FarmHub.tsx 의 farm card absolute 영역 안.
 */

import { MUSHROOM_HOUSE_OPEN_EVENT } from "../decor/MushroomHouseRoom";
import {
  useDevHitRegionStore,
  DEFAULT_FARMHUB_HIT_REGION,
} from "../dev/devHitRegionStore";
import { haptic } from "../../design-system/haptic";

const IS_DEV =
  typeof import.meta !== "undefined" &&
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

export function MushroomHouseHitRegion() {
  // DEV: store 의 region (사용자 미세 조정값) 사용.
  // production: store 도 동일 default 로 초기화되어 있어 같은 값 반환.
  // 단 production 에선 setter 가 no-op 이라 절대 default 에서 안 변함.
  const region = useDevHitRegionStore((s) => s.region);
  const show = useDevHitRegionStore((s) => s.show);

  const effective = IS_DEV ? region : DEFAULT_FARMHUB_HIT_REGION;

  const onClick = () => {
    haptic("light");
    try {
      window.dispatchEvent(new CustomEvent(MUSHROOM_HOUSE_OPEN_EVENT));
    } catch {
      /* SSR */
    }
  };

  return (
    <button
      type="button"
      data-testid="farm-mushroom-house-hit"
      aria-label="버섯집 — 방 안 들어가기"
      onClick={onClick}
      className="mushroom-hit"
      style={{
        position: "absolute",
        left: `${effective.left}%`,
        top: `${effective.top}%`,
        width: `${effective.width}%`,
        height: `${effective.height}%`,
        padding: 0,
        border: IS_DEV && show ? "2px solid #FF0000" : "none",
        background:
          IS_DEV && show ? "rgba(255, 0, 0, 0.25)" : "transparent",
        cursor: "pointer",
        zIndex: 4,
        // hover/active micro feedback 은 base.css 의 .mushroom-hit
        // rule 에서 처리 (prefers-reduced-motion 가드 포함).
      }}
    />
  );
}
