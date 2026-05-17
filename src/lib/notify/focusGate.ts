/**
 * focusGate (PR-74) — 홈 화면 + 집중 중일 때 농장 드랍 알림 차단.
 *
 * 시나리오: 사용자가 25분 집중 중에 홈(/) 에서 타이머만 보고 있는데
 * 농장에서 드랍이 발생하면 in-app banner / native notification 이 떠서
 * 집중을 깸. 학습 도구 톤과 어긋남.
 *
 * 정책:
 *   - `route === '/' AND timerStatus === 'FOCUSING'` 이면 drop 계열 알림
 *     suppress + 큐에 누적.
 *   - 다른 상황 (route !== '/', 또는 timer IDLE/PAUSED/DONE) 은 정상 표시.
 *   - 누적은 KST 일자별 safeStorage 영속 (보조 모듈 — 단순 dict 카운터).
 *   - flush 시점:
 *       1) 타이머 FOCUSING → IDLE/DONE 전환 (HomePage useEffect)
 *       2) 사용자가 농장 진입 (/collection FarmHub mount)
 *
 * NOTE: 본 모듈은 store 가 아니라 pure helpers + safeStorage. zustand
 * subscribe 회피 — 호출자 (FarmDropLayer.spawn) 가 동기 함수.
 */
import { safeStorage } from "../safeStorage";
import { useTimerStore } from "../../store/timerStore";

/** Drop kinds that can be suppressed. Mirrors FarmDropLayer DropSpec. */
export type SuppressibleKind =
  | "gem"
  | "bolt"
  | "heart"
  | "hourglass"
  | "juice"
  | "soup"
  | "cake"
  | "seed"
  | "golden"
  | "hidden_bunny";

const STORAGE_KEY = "cc.focus-blackout.suppressed.v1";

/** Korean label per kind for batch flush message. */
const KIND_LABEL: Readonly<Record<SuppressibleKind, string>> = {
  gem: "보석",
  bolt: "번개",
  heart: "하트",
  hourglass: "모래시계",
  juice: "주스",
  soup: "수프",
  cake: "케이크",
  seed: "씨앗",
  golden: "황금당근",
  hidden_bunny: "히든 토끼",
};

/**
 * Pure predicate — true when farm-side notifications should be suppressed.
 *
 * Reads `window.location.hash` (wouter useHashLocation 환경) + timer
 * store 상태. SSR / no-window 환경에서는 false (suppress 안 함).
 */
export function isFocusBlackout(): boolean {
  if (typeof window === "undefined") return false;
  // wouter useHashLocation: `#/` (or `#/`) = home, `#/collection` = farm.
  const hash = window.location.hash;
  // Normalize: strip leading `#`, default to `/`.
  const path = hash.startsWith("#") ? hash.slice(1) : hash;
  const isHome = path === "" || path === "/";
  if (!isHome) return false;
  const status = useTimerStore.getState().status;
  return status === "FOCUSING";
}

interface SuppressedCounts {
  [kind: string]: number;
}

function loadCounts(): SuppressedCounts {
  const raw = safeStorage.get(STORAGE_KEY);
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object") {
      const out: SuppressedCounts = {};
      for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
        if (typeof n === "number" && n > 0) out[k] = Math.floor(n);
      }
      return out;
    }
  } catch {
    /* corrupt — reset */
  }
  return {};
}

function saveCounts(c: SuppressedCounts): void {
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

/**
 * Push a single suppressed drop onto the queue. Idempotent for same kind
 * (just increments).
 */
export function pushSuppressedDrop(kind: SuppressibleKind, count = 1): void {
  if (count <= 0) return;
  const cur = loadCounts();
  cur[kind] = (cur[kind] ?? 0) + Math.floor(count);
  saveCounts(cur);
}

/**
 * Read + clear the queue. Returns counts dict (may be empty {}).
 */
export function consumeSuppressedDrops(): SuppressedCounts {
  const cur = loadCounts();
  if (Object.keys(cur).length === 0) return {};
  try {
    safeStorage.remove(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return cur;
}

/**
 * Format suppressed counts dict → Korean batch message. Returns `null`
 * when no items (empty dict).
 *
 * Example: { gem: 3, heart: 2 } → "집중하는 동안 보석 3개, 하트 2개 떨어졌어요"
 */
export function formatSuppressedMessage(
  counts: SuppressedCounts,
): string | null {
  const parts: string[] = [];
  for (const [kind, n] of Object.entries(counts)) {
    if (n <= 0) continue;
    const label = KIND_LABEL[kind as SuppressibleKind] ?? kind;
    parts.push(`${label} ${n}개`);
  }
  if (parts.length === 0) return null;
  return `🎁 집중하는 동안 ${parts.join(", ")} 떨어졌어요`;
}
