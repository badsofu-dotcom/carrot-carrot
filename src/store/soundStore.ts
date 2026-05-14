/**
 * Phase 8.0-b — 백색소음 store.
 *
 * 영구 저장:
 *   currentSoundId       — 마지막으로 선택한 사운드 id (default 'none').
 *   volume               — 0..100 (default 60).
 *   soundPassExpiresAt   — 광고 패스 만료 epoch ms. 지나면 잠금 복귀.
 *   permanentUnlocks     — 영구 해제된 premium id 배열.
 *   adPromptDismissedFor — `오늘 하루 다시 묻지 않기` 체크된 날짜 (YYYY-MM-DD).
 *
 * isPlaying 은 player hook 의 상태와 동기화 (런타임 only — 새로고침 시 false).
 */

import { create } from "zustand";
import { safeStorage } from "../lib/safeStorage";
import { findSound } from "../data/sounds";

const KEY_CURRENT = "cc.sound.current.v1";
const KEY_VOLUME = "cc.sound.volume.v1";
const KEY_PASS = "cc.sound.passExpiresAt.v1";
const KEY_PERM = "cc.sound.permanent.v1";
const KEY_AD_DISMISS = "cc.sound.adDismissedDate.v1";

// 신규 사용자는 매우 부드러운 백색소음(저주파 HVAC) 사운드로 시작.
// 기존 사용자는 storage 값 우선 → 마지막 선택 보존.
// 단, 저장된 값이 premium 인데 패스/영구 해제가 없으면 default 로 복귀 (광고 게이트 정책).
const DEFAULT_SOUND_ID = "air-purifier";
const DEFAULT_VOLUME = 77;

function loadCurrent(passExpiresAt: number, permanentUnlocks: string[]): string {
  const raw = safeStorage.get(KEY_CURRENT);
  if (!raw) return DEFAULT_SOUND_ID;
  const def = findSound(raw);
  if (!def) return DEFAULT_SOUND_ID;
  if (def.tier === "free") return raw;
  // premium — 영구 해제되었거나 패스가 살아있으면 유지, 아니면 default 로 sanitize.
  if (permanentUnlocks.includes(raw)) return raw;
  if (isPassActive(passExpiresAt)) return raw;
  // 만료된 premium 선택은 storage 도 정리해서 다음 부팅에도 반복되지 않게.
  try {
    safeStorage.remove(KEY_CURRENT);
  } catch {
    /* ignore */
  }
  return DEFAULT_SOUND_ID;
}
function saveCurrent(v: string) {
  try {
    safeStorage.set(KEY_CURRENT, v);
  } catch {
    /* ignore */
  }
}

function loadVolume(): number {
  const raw = safeStorage.get(KEY_VOLUME);
  if (!raw) return DEFAULT_VOLUME;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function saveVolume(v: number) {
  try {
    safeStorage.set(KEY_VOLUME, String(v));
  } catch {
    /* ignore */
  }
}

function loadPass(): number {
  const raw = safeStorage.get(KEY_PASS);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
function savePass(v: number) {
  try {
    safeStorage.set(KEY_PASS, String(v));
  } catch {
    /* ignore */
  }
}

function loadPermanent(): string[] {
  const raw = safeStorage.get(KEY_PERM);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
  } catch {
    /* ignore */
  }
  return [];
}
function savePermanent(v: string[]) {
  try {
    safeStorage.set(KEY_PERM, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function loadAdPromptDismissedDate(): string | null {
  return safeStorage.get(KEY_AD_DISMISS);
}
export function setAdPromptDismissedToday() {
  try {
    safeStorage.set(KEY_AD_DISMISS, todayLocalDate());
  } catch {
    /* ignore */
  }
}

/** 오늘 자정 (23:59:59.999) 의 epoch ms — 사운드 패스 default 만료. */
export function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function todayLocalDate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

interface SoundState {
  currentSoundId: string;
  volume: number; // 0..100
  /** 런타임 only — UI 가 player 상태 표시할 때 사용. */
  isPlaying: boolean;
  /** 활성 패스 만료. <= Date.now() 면 만료된 것으로 취급. */
  soundPassExpiresAt: number;
  permanentUnlocks: string[];

  setSound: (id: string) => void;
  setVolume: (v: number) => void;
  setIsPlaying: (v: boolean) => void;
  togglePlay: () => void;
  /** 광고 패스 부여 — 오늘 자정까지. */
  activateSoundPass: () => void;
  /** 특정 premium id 영구 해제. */
  unlockPermanent: (id: string) => void;
}

export const useSoundStore = create<SoundState>((set, get) => {
  const initialPass = loadPass();
  const initialPerm = loadPermanent();
  return {
  currentSoundId: loadCurrent(initialPass, initialPerm),
  volume: loadVolume(),
  isPlaying: false,
  soundPassExpiresAt: initialPass,
  permanentUnlocks: initialPerm,

  setSound: (id) => {
    const def = findSound(id);
    if (!def) return;
    // 광고 게이트 — premium 은 잠금 해제 상태에서만 활성/저장.
    if (def.tier === "premium") {
      const s = get();
      if (
        !s.permanentUnlocks.includes(id) &&
        !isPassActive(s.soundPassExpiresAt)
      ) {
        return;
      }
    }
    saveCurrent(id);
    set({ currentSoundId: id });
  },

  setVolume: (v) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    saveVolume(clamped);
    set({ volume: clamped });
  },

  setIsPlaying: (v) => set({ isPlaying: v }),

  togglePlay: () => {
    const s = get();
    set({ isPlaying: !s.isPlaying });
  },

  activateSoundPass: () => {
    const exp = endOfToday();
    savePass(exp);
    set({ soundPassExpiresAt: exp });
  },

  unlockPermanent: (id) => {
    const s = get();
    if (s.permanentUnlocks.includes(id)) return;
    const next = [...s.permanentUnlocks, id];
    savePermanent(next);
    set({ permanentUnlocks: next });
  },
  };
});

/** 현재 시점에서 premium pack 이 ad pass 로 unlocked 인가? */
export function isPassActive(expiresAt: number): boolean {
  return expiresAt > Date.now();
}

/** 특정 sound 가 사용 가능한가? free 는 항상 OK. premium 은 영구 해제 OR 패스 활성. */
export function isSoundAvailable(
  id: string,
  state: Pick<SoundState, "soundPassExpiresAt" | "permanentUnlocks">,
): boolean {
  const s = findSound(id);
  if (!s) return false;
  if (s.tier === "free") return true;
  if (state.permanentUnlocks.includes(id)) return true;
  return isPassActive(state.soundPassExpiresAt);
}
