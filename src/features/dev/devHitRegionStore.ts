/**
 * devHitRegionStore (Round 26, PR-154) — DEV 전용 hit-region 시각 보정.
 *
 * 베타 빌드에서 농장 버섯집 hit-region 의 4 값 (left/top/width/height %)
 * 을 ± 1% 단위로 미세 조정 → 최종 확정값을 다음 commit 에 상수로 박음.
 *
 * production 빌드:
 *   - `import.meta.env.DEV` 가 false 라 vite 가 store 전체를 dead-code-
 *     eliminate (단, `useDevHitRegionStore` import 자체는 남으니 store
 *     create 는 호출됨 — setters 는 no-op 으로 만들어 production 데이터
 *     오염 방지).
 *
 * localStorage 키: cc.dev.farmhub.hitregion.v1
 *   { show, region: { left, top, width, height } }
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";

export interface HitRegion {
  /** % of farm card width. */
  left: number;
  /** % of farm card height. */
  top: number;
  /** % of farm card width. */
  width: number;
  /** % of farm card height. */
  height: number;
}

/**
 * Round 26 옵션 B 확정값. 베타 미세 조정 후 R26.1 hotfix 로 갱신.
 */
export const DEFAULT_FARMHUB_HIT_REGION: HitRegion = {
  left: 2,
  top: 24,
  width: 26,
  height: 28,
};

export interface LabelPos {
  /** % of farm card width. */
  left: number;
  /** % of farm card height. */
  top: number;
}

/**
 * 버섯집 진입 라벨 ("🍄 집 들어가기") 좌표.
 *   R26.1 → R26.2 변경: { L4, T19 } (모자 위) → { L22, T47 } (문 옆).
 *   사용자 베타 검증 결과 — 모자 위는 농장 헤더에 가깝고 시각 단서가
 *   약함. 문 우측 바로 옆이 "여기 들어가" 메타포 더 명확.
 *   hit-region (L2 T24 W26 H28 → 우측 끝 28%) 안에 위치 — label z 5 >
 *   hit z 4 로 클릭 우선. 두 진입점이 시각적으로 일체.
 */
export const DEFAULT_FARMHUB_LABEL_POS: LabelPos = {
  left: 22,
  top: 47,
};

const STORAGE_KEY = "cc.dev.farmhub.hitregion.v1";
const IS_DEV =
  typeof import.meta !== "undefined" &&
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

interface PersistShape {
  show: boolean;
  region: HitRegion;
  labelPos: LabelPos;
}

function loadPersist(): PersistShape {
  if (!IS_DEV) {
    return {
      show: false,
      region: { ...DEFAULT_FARMHUB_HIT_REGION },
      labelPos: { ...DEFAULT_FARMHUB_LABEL_POS },
    };
  }
  const raw = safeStorage.get(STORAGE_KEY);
  const blank: PersistShape = {
    show: false,
    region: { ...DEFAULT_FARMHUB_HIT_REGION },
    labelPos: { ...DEFAULT_FARMHUB_LABEL_POS },
  };
  if (!raw) return blank;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return blank;
    const r = parsed.region;
    const region: HitRegion =
      r &&
      typeof r === "object" &&
      Number.isFinite(r.left) &&
      Number.isFinite(r.top) &&
      Number.isFinite(r.width) &&
      Number.isFinite(r.height)
        ? {
            left: Math.max(0, Math.min(100, Number(r.left))),
            top: Math.max(0, Math.min(100, Number(r.top))),
            width: Math.max(1, Math.min(100, Number(r.width))),
            height: Math.max(1, Math.min(100, Number(r.height))),
          }
        : { ...DEFAULT_FARMHUB_HIT_REGION };
    const lp = parsed.labelPos;
    const labelPos: LabelPos =
      lp &&
      typeof lp === "object" &&
      Number.isFinite(lp.left) &&
      Number.isFinite(lp.top)
        ? {
            left: Math.max(0, Math.min(100, Number(lp.left))),
            top: Math.max(0, Math.min(100, Number(lp.top))),
          }
        : { ...DEFAULT_FARMHUB_LABEL_POS };
    return {
      show: parsed.show === true,
      region,
      labelPos,
    };
  } catch {
    return blank;
  }
}

function savePersist(s: PersistShape): void {
  if (!IS_DEV) return;
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

interface DevHitRegionState {
  show: boolean;
  region: HitRegion;
  labelPos: LabelPos;
  toggleShow: () => void;
  setRegion: (patch: Partial<HitRegion>) => void;
  resetRegion: () => void;
  setLabelPos: (patch: Partial<LabelPos>) => void;
  resetLabelPos: () => void;
}

export const useDevHitRegionStore = create<DevHitRegionState>((set, get) => {
  const init = loadPersist();
  const snapshot = (): PersistShape => ({
    show: get().show,
    region: get().region,
    labelPos: get().labelPos,
  });
  return {
    show: init.show,
    region: init.region,
    labelPos: init.labelPos,

    toggleShow: () => {
      if (!IS_DEV) return;
      const next = !get().show;
      set({ show: next });
      savePersist({ ...snapshot(), show: next });
    },

    setRegion: (patch) => {
      if (!IS_DEV) return;
      const cur = get().region;
      const next: HitRegion = {
        left: Math.max(0, Math.min(100, patch.left ?? cur.left)),
        top: Math.max(0, Math.min(100, patch.top ?? cur.top)),
        width: Math.max(1, Math.min(100, patch.width ?? cur.width)),
        height: Math.max(1, Math.min(100, patch.height ?? cur.height)),
      };
      set({ region: next });
      savePersist({ ...snapshot(), region: next });
    },

    resetRegion: () => {
      if (!IS_DEV) return;
      set({ region: { ...DEFAULT_FARMHUB_HIT_REGION } });
      savePersist({
        ...snapshot(),
        region: { ...DEFAULT_FARMHUB_HIT_REGION },
      });
    },

    setLabelPos: (patch) => {
      if (!IS_DEV) return;
      const cur = get().labelPos;
      const next: LabelPos = {
        left: Math.max(0, Math.min(100, patch.left ?? cur.left)),
        top: Math.max(0, Math.min(100, patch.top ?? cur.top)),
      };
      set({ labelPos: next });
      savePersist({ ...snapshot(), labelPos: next });
    },

    resetLabelPos: () => {
      if (!IS_DEV) return;
      set({ labelPos: { ...DEFAULT_FARMHUB_LABEL_POS } });
      savePersist({
        ...snapshot(),
        labelPos: { ...DEFAULT_FARMHUB_LABEL_POS },
      });
    },
  };
});
