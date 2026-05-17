/**
 * dailyCap (PR-90) — 일일 P 획득 한도.
 *
 * ECONOMY_AUDIT.md (PR-89) 분석 결과 heavy player 가 일일 ~200 P 까지
 * 가능 → 사용자 의도 (100~150P) + 학습 도구 톤 (노가다 방지) 위반.
 * disclosure (reward-disclosure.md) 의 "100 P 기본 + dogam 100% 완성
 * 시 +10 P" 정책 그대로 enforce.
 *
 * 정책 — **소프트 캡** (학습 도구 톤):
 *   - **base cap**: 100 P / KST 일
 *   - **dogam_100 boost**: +10 P (= passivesFromOwned(count).dailyCapBoost)
 *   - addPoints() 는 earned 카운터를 cap 까지만 증가시킴.
 *   - **inventory resource 는 항상 grant** — 게임 플레이 진행 자유.
 *     cap 의 의미는 "오늘 출금 가능 P 한도" + 학습 ux ("🌙 오늘은 푹 쉬어요").
 *   - KST 자정 자동 reset
 *
 * 본 모듈은 pure helpers + safeStorage. farmStore inc* 가 내부에서
 * 호출. UI (RewardsPanel) 가 `todayEarned() / currentDailyCap()` 으로
 * 진행도 표시.
 *
 * 주의 — 향후:
 *   - worker `/economy/withdraw` 가 server-side cap 도 enforce 필요.
 *     현재는 클라이언트 tamper 가능 (Round 13 후보).
 */
import { safeStorage } from "../safeStorage";
import { useCollectionStore } from "../../features/collection/collectionStore";
import { passivesFromOwned } from "../dogamPassives";

const STORAGE_KEY = "cc.economy.dailyP.v1";

export const BASE_DAILY_CAP = 100;

/** YYYY-MM-DD KST. */
function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface DailyState {
  day: string;
  earned: number;
}

function load(): DailyState {
  const raw = safeStorage.get(STORAGE_KEY);
  if (!raw) return { day: kstDayKey(), earned: 0 };
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && typeof v.day === "string" && typeof v.earned === "number") {
      return { day: v.day, earned: Math.max(0, Math.floor(v.earned)) };
    }
  } catch {
    /* corrupt — reset */
  }
  return { day: kstDayKey(), earned: 0 };
}

function save(s: DailyState): void {
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * 현재 일일 cap 계산. dogam_100 (12 마리 unlock) 시 +10 P.
 */
export function currentDailyCap(): number {
  let owned = 0;
  try {
    owned = useCollectionStore.getState().ownedCharacters.length;
  } catch {
    /* SSR / not hydrated */
  }
  const boost = passivesFromOwned(owned).dailyCapBoost;
  return BASE_DAILY_CAP + boost;
}

/**
 * 오늘 누적 획득 P. KST rollover 자동 reset.
 */
export function todayEarned(): number {
  const today = kstDayKey();
  const state = load();
  if (state.day !== today) {
    save({ day: today, earned: 0 });
    return 0;
  }
  return state.earned;
}

/**
 * P 추가 시도. cap 내면 모두 grant + earned 증가. cap 초과면 부분
 * grant (cap 까지만) 또는 0. 반환값 = 실제 grant 된 P.
 *
 * `source` 는 logging / UI 안내용 (현재는 미사용, future hook).
 */
export function addPoints(source: string, amount: number): number {
  void source;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const today = kstDayKey();
  let state = load();
  if (state.day !== today) {
    state = { day: today, earned: 0 };
  }
  const cap = currentDailyCap();
  if (state.earned >= cap) {
    save(state);
    return 0;
  }
  const grant = Math.min(Math.floor(amount), cap - state.earned);
  const next = { day: state.day, earned: state.earned + grant };
  save(next);
  return grant;
}

/**
 * Just-peek — cap 안 남은 P 양 (UI 진행도 표시용).
 */
export function remainingP(): number {
  return Math.max(0, currentDailyCap() - todayEarned());
}

/**
 * cap 도달 여부. UI banner / chip 표시용.
 */
export function isCapReached(): boolean {
  return todayEarned() >= currentDailyCap();
}

/**
 * 테스트용 reset. 프로덕션 caller 없음.
 */
export function _resetForTest(): void {
  try {
    safeStorage.remove(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
