/**
 * Notifications store (PR-53) — 알림 유형별 ON/OFF + 마스터 토글.
 *
 * safeStorage 영속. 모든 trigger 사이트가 `shouldNotify(kind)` 호출
 * 후 발송. 사용자가 settings UI 에서 변경.
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import type { NotifyKind } from "../../lib/webNotify";

const STORAGE_KEY = "cc.notifications.v1";

interface NotificationsState {
  /** Master toggle — false 면 모든 알림 정지. */
  masterEnabled: boolean;
  /** Per-kind toggle. 기본 모두 true. */
  byKind: Record<NotifyKind, boolean>;

  setMaster: (v: boolean) => void;
  setKind: (kind: NotifyKind, v: boolean) => void;
  shouldNotify: (kind: NotifyKind) => boolean;
}

interface Persisted {
  master?: boolean;
  byKind?: Partial<Record<NotifyKind, boolean>>;
}

function load(): Persisted {
  const raw = safeStorage.get(STORAGE_KEY);
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object") return v as Persisted;
  } catch {
    /* ignore */
  }
  return {};
}
function save(state: NotificationsState) {
  try {
    safeStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        master: state.masterEnabled,
        byKind: state.byKind,
      }),
    );
  } catch {
    /* ignore */
  }
}

const DEFAULT_BY_KIND: Record<NotifyKind, boolean> = {
  drop: true,
  mission: true,
  session: true,
  midnight: true,
  treasure: true,
};

export const useNotificationsStore = create<NotificationsState>((set, get) => {
  const init = load();
  return {
    masterEnabled: init.master ?? true,
    byKind: {
      ...DEFAULT_BY_KIND,
      ...(init.byKind ?? {}),
    },

    setMaster: (v) => {
      set({ masterEnabled: v });
      save(get());
    },
    setKind: (kind, v) => {
      const next = { ...get().byKind, [kind]: v };
      set({ byKind: next });
      save(get());
    },
    shouldNotify: (kind) => {
      const s = get();
      return s.masterEnabled && s.byKind[kind] !== false;
    },
  };
});
