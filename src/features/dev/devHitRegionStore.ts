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

const STORAGE_KEY = "cc.dev.farmhub.hitregion.v1";
const IS_DEV =
  typeof import.meta !== "undefined" &&
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

interface PersistShape {
  show: boolean;
  region: HitRegion;
}

function loadPersist(): PersistShape {
  if (!IS_DEV) {
    return { show: false, region: { ...DEFAULT_FARMHUB_HIT_REGION } };
  }
  const raw = safeStorage.get(STORAGE_KEY);
  const blank: PersistShape = {
    show: false,
    region: { ...DEFAULT_FARMHUB_HIT_REGION },
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
    return {
      show: parsed.show === true,
      region,
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
  toggleShow: () => void;
  setRegion: (patch: Partial<HitRegion>) => void;
  resetRegion: () => void;
}

export const useDevHitRegionStore = create<DevHitRegionState>((set, get) => {
  const init = loadPersist();
  return {
    show: init.show,
    region: init.region,

    toggleShow: () => {
      if (!IS_DEV) return;
      const next = !get().show;
      set({ show: next });
      savePersist({ show: next, region: get().region });
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
      savePersist({ show: get().show, region: next });
    },

    resetRegion: () => {
      if (!IS_DEV) return;
      set({ region: { ...DEFAULT_FARMHUB_HIT_REGION } });
      savePersist({
        show: get().show,
        region: { ...DEFAULT_FARMHUB_HIT_REGION },
      });
    },
  };
});
