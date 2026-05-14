/**
 * Phase 4 — Pomodoro timer state machine.
 *
 * 상태:
 *   IDLE       타이머 대기. 버튼 라벨 "탭해서 시작".
 *   FOCUSING   집중 진행 중. 매초 tick.
 *   PAUSED     사용자가 일시정지. tick 중지, 누적 일시정지 시간 보관.
 *   COMPLETED  목표 시간 도달. 효과/큐 처리.
 *   ABANDONED  사용자가 포기. 슬픈 토끼.
 *
 * 백그라운드 복귀:
 *   setInterval 은 탭이 백그라운드일 때 throttling 되거나 멈춘다.
 *   따라서 매 tick 마다 startedAt + pausedAccumulatedMs 로 실제 경과시간을 계산한다.
 *   visibilitychange 시에도 즉시 한 번 재계산.
 *
 * 저장:
 *   preset (분) 만 localStorage 에 저장. 진행중 세션은 메모리 only —
 *   페이지 새로고침으로 사라져도 사용자 멘탈 모델상 자연스럽다.
 */

import { create } from "zustand";
import { safeStorage } from "../lib/safeStorage";

export type TimerStatus =
  | "IDLE"
  | "FOCUSING"
  | "PAUSED"
  | "COMPLETED"
  | "ABANDONED";

export type Preset = 15 | 25 | 50;

export const PRESETS: Preset[] = [15, 25, 50];
export const DEFAULT_PRESET: Preset = 25;

/** Phase 7.9 — custom duration constraints (분). */
export const CUSTOM_MIN = 1;
export const CUSTOM_MAX = 120;
export const DEFAULT_CUSTOM = 43;

const PRESET_KEY = "cc.timer.preset.v1";
const SELECTED_KEY = "cc.timer.selected.v2"; // 분 단위. preset 또는 custom 값.
const CUSTOM_KEY = "cc.timer.custom.v1"; // 분 단위 커스텀 값.
const SHOW_CUSTOM_KEY = "cc.timer.showCustom.v1"; // "1" | "0"
const AUTO_BREAK_KEY = "cc.timer.autoBreak.v1"; // "1" | "0" — 8.0-c

/** Phase 8.0-c — auto break 시작 여부. default false. */
export function loadAutoBreak(): boolean {
  return safeStorage.get(AUTO_BREAK_KEY) === "1";
}
export function saveAutoBreak(v: boolean) {
  try {
    safeStorage.set(AUTO_BREAK_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Phase 8.0-c — 휴식 시간 (분). 고정 5. */
export const BREAK_MIN = 5;

/**
 * 디버그 모드 — 25분을 25초로 압축 (개발 QA 용).
 * import.meta.env.VITE_TIMER_DEBUG === "true" 일 때만 활성.
 */
function isDebug(): boolean {
  try {
    return import.meta.env.VITE_TIMER_DEBUG === "true";
  } catch {
    return false;
  }
}

/** 분 → 실제 ms (debug 면 1분=1초로 압축). */
export function presetMs(p: number): number {
  if (isDebug()) return p * 1000; // 분 → 초
  return p * 60 * 1000;
}

/** 분 → 실제 ms (custom 포함). */
export function minutesToMs(min: number): number {
  return presetMs(min);
}

function clampCustom(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_CUSTOM;
  return Math.max(CUSTOM_MIN, Math.min(CUSTOM_MAX, Math.round(n)));
}

function loadPreset(): Preset {
  const raw = safeStorage.get(PRESET_KEY);
  if (!raw) return DEFAULT_PRESET;
  const n = Number(raw);
  if (n === 15 || n === 25 || n === 50) return n as Preset;
  return DEFAULT_PRESET;
}

function savePreset(p: Preset) {
  try {
    safeStorage.set(PRESET_KEY, String(p));
  } catch {
    /* ignore */
  }
}

function loadSelectedMinutes(fallback: number): number {
  const raw = safeStorage.get(SELECTED_KEY);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return clampCustom(n);
}

function saveSelectedMinutes(min: number) {
  try {
    safeStorage.set(SELECTED_KEY, String(min));
  } catch {
    /* ignore */
  }
}

function loadCustom(): number {
  const raw = safeStorage.get(CUSTOM_KEY);
  if (!raw) return DEFAULT_CUSTOM;
  const n = Number(raw);
  return clampCustom(n);
}

function saveCustom(min: number) {
  try {
    safeStorage.set(CUSTOM_KEY, String(min));
  } catch {
    /* ignore */
  }
}

export function loadShowCustomSlot(): boolean {
  const raw = safeStorage.get(SHOW_CUSTOM_KEY);
  if (raw === null || raw === undefined) return true; // default ON
  return raw !== "0";
}

export function saveShowCustomSlot(v: boolean) {
  try {
    safeStorage.set(SHOW_CUSTOM_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export interface TimerSnapshot {
  /** 마지막 완료된 세션의 정보 — Home 의 success/fail 효과에서 1회 표시. */
  type: "complete" | "abandon";
  preset: Preset;
  /** 실제 집중 시간(ms) — abandon 의 경우 0~target 사이. */
  focusedMs: number;
  at: number;
}

/** Phase 8.0-c — focus / break (5min rest) 모드. */
export type TimerMode = "focus" | "break";

interface TimerState {
  status: TimerStatus;
  /** Phase 8.0-c — 현재 세션이 focus 인지 break 인지. */
  mode: TimerMode;
  preset: Preset;
  /** Phase 7.9 — 현재 선택된 한 판의 분 (preset 값 또는 custom 값). */
  selectedMinutes: number;
  /** 사용자가 마지막으로 저장한 custom 분 값 (1..120). */
  customMinutes: number;
  /** 목표 ms. selectedMinutes 에서 파생되지만, start 시점에 락한다. */
  targetMs: number;
  /** start 시점의 epoch ms. */
  startedAt: number | null;
  /** 일시정지 시작 시점. PAUSED 상태일 때만 not null. */
  pausedAt: number | null;
  /** 누적 일시정지 ms. */
  pausedAccumulatedMs: number;
  /** 매 tick 갱신되는 현재 epoch ms (재렌더 트리거). */
  nowMs: number;
  /** 성공/실패 직후 1회용 신호 — UI 가 읽고 clearSnapshot. */
  lastSnapshot: TimerSnapshot | null;

  start: (minutes?: number) => void;
  /** Phase 8.0-c — 휴식 5분 시작. status=FOCUSING + mode='break'. */
  startBreak: () => void;
  pause: () => void;
  resume: () => void;
  abandon: () => void;
  /** 외부에서 "지금 다 됐는지?" 확인용. tick 에서 자동 호출됨. */
  tick: (atMs?: number) => void;
  reset: () => void;
  setPreset: (p: Preset) => void;
  /** Phase 7.9 — preset 또는 custom 분으로 선택값 갱신. */
  setSelectedMinutes: (min: number) => void;
  /** Phase 7.9 — 사용자가 custom 슬롯에서 저장한 값. selectedMinutes 도 동시에 그 값으로 갱신. */
  setCustomMinutes: (min: number) => void;
  /** UI 가 lastSnapshot 을 소비한 뒤 호출. */
  clearSnapshot: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  status: "IDLE",
  mode: "focus",
  preset: loadPreset(),
  selectedMinutes: loadSelectedMinutes(loadPreset()),
  customMinutes: loadCustom(),
  targetMs: presetMs(loadSelectedMinutes(loadPreset())),
  startedAt: null,
  pausedAt: null,
  pausedAccumulatedMs: 0,
  nowMs: Date.now(),
  lastSnapshot: null,

  start: (minutes) => {
    const s = get();
    const useMin = clampCustom(minutes ?? s.selectedMinutes);
    saveSelectedMinutes(useMin);
    set({
      status: "FOCUSING",
      mode: "focus",
      selectedMinutes: useMin,
      targetMs: presetMs(useMin),
      startedAt: Date.now(),
      pausedAt: null,
      pausedAccumulatedMs: 0,
      nowMs: Date.now(),
      lastSnapshot: null,
    });
  },

  startBreak: () => {
    set({
      status: "FOCUSING",
      mode: "break",
      // 휴식은 항상 5분 — preset 영향 받지 않음.
      targetMs: presetMs(BREAK_MIN),
      startedAt: Date.now(),
      pausedAt: null,
      pausedAccumulatedMs: 0,
      nowMs: Date.now(),
      lastSnapshot: null,
    });
  },

  pause: () => {
    const s = get();
    if (s.status !== "FOCUSING") return;
    set({ status: "PAUSED", pausedAt: Date.now(), nowMs: Date.now() });
  },

  resume: () => {
    const s = get();
    if (s.status !== "PAUSED" || s.pausedAt === null) return;
    const extra = Date.now() - s.pausedAt;
    set({
      status: "FOCUSING",
      pausedAt: null,
      pausedAccumulatedMs: s.pausedAccumulatedMs + extra,
      nowMs: Date.now(),
    });
  },

  abandon: () => {
    const s = get();
    if (s.status !== "FOCUSING" && s.status !== "PAUSED") return;
    const focused = computeElapsedMs(s);
    set({
      status: "ABANDONED",
      lastSnapshot: {
        type: "abandon",
        preset: s.preset,
        focusedMs: focused,
        at: Date.now(),
      },
      // startedAt/누적은 유지 — UI 가 소비 후 reset 호출.
      nowMs: Date.now(),
    });
  },

  tick: (atMs) => {
    const s = get();
    const now = atMs ?? Date.now();
    if (s.status === "FOCUSING") {
      const elapsed = computeElapsedMs({ ...s, nowMs: now });
      if (elapsed >= s.targetMs) {
        // Phase 8.0-c — break 모드 완료는 collection/snapshot 에 기록하지 않는다.
        if (s.mode === "break") {
          set({
            status: "IDLE",
            mode: "focus",
            startedAt: null,
            pausedAt: null,
            pausedAccumulatedMs: 0,
            nowMs: now,
            // 이후 selectedMinutes 기반 target 으로 복귀.
            targetMs: presetMs(s.selectedMinutes),
            lastSnapshot: null,
          });
          return;
        }
        set({
          status: "COMPLETED",
          nowMs: now,
          lastSnapshot: {
            type: "complete",
            preset: s.preset,
            focusedMs: s.targetMs,
            at: now,
          },
        });
        return;
      }
      set({ nowMs: now });
    } else if (s.status === "PAUSED") {
      // PAUSED 면 nowMs 갱신만 — 진행률은 변하지 않는다 (pausedAt 기준).
      set({ nowMs: now });
    }
  },

  reset: () => {
    set({
      status: "IDLE",
      mode: "focus",
      startedAt: null,
      pausedAt: null,
      pausedAccumulatedMs: 0,
      nowMs: Date.now(),
      // selectedMinutes, targetMs 는 유지.
      targetMs: presetMs(get().selectedMinutes),
    });
  },

  setPreset: (p) => {
    savePreset(p);
    const s = get();
    if (s.status === "IDLE") {
      saveSelectedMinutes(p);
      set({ preset: p, selectedMinutes: p, targetMs: presetMs(p) });
    } else {
      // 진행 중에는 preset 만 저장. 다음 라운드에 적용.
      set({ preset: p });
    }
  },

  setSelectedMinutes: (min) => {
    const v = clampCustom(min);
    saveSelectedMinutes(v);
    const s = get();
    if (v === 15 || v === 25 || v === 50) savePreset(v as Preset);
    if (s.status === "IDLE") {
      set({ selectedMinutes: v, targetMs: presetMs(v) });
    } else {
      set({ selectedMinutes: v });
    }
  },

  setCustomMinutes: (min) => {
    const v = clampCustom(min);
    saveCustom(v);
    saveSelectedMinutes(v);
    const s = get();
    if (s.status === "IDLE") {
      set({ customMinutes: v, selectedMinutes: v, targetMs: presetMs(v) });
    } else {
      set({ customMinutes: v, selectedMinutes: v });
    }
  },

  clearSnapshot: () => set({ lastSnapshot: null }),
}));

/**
 * 현재 상태에서 "집중에 사용된 ms" 계산.
 * FOCUSING 이면 now - startedAt - pausedAccumulatedMs.
 * PAUSED 이면 pausedAt - startedAt - pausedAccumulatedMs.
 */
function computeElapsedMs(s: {
  status: TimerStatus;
  startedAt: number | null;
  pausedAt: number | null;
  pausedAccumulatedMs: number;
  nowMs: number;
}): number {
  if (s.startedAt === null) return 0;
  const ref = s.status === "PAUSED" && s.pausedAt !== null ? s.pausedAt : s.nowMs;
  const raw = ref - s.startedAt - s.pausedAccumulatedMs;
  return Math.max(0, raw);
}

export function useElapsedMs(): number {
  return useTimerStore((s) =>
    computeElapsedMs({
      status: s.status,
      startedAt: s.startedAt,
      pausedAt: s.pausedAt,
      pausedAccumulatedMs: s.pausedAccumulatedMs,
      nowMs: s.nowMs,
    }),
  );
}

export function useRemainingMs(): number {
  return useTimerStore((s) => {
    const elapsed = computeElapsedMs({
      status: s.status,
      startedAt: s.startedAt,
      pausedAt: s.pausedAt,
      pausedAccumulatedMs: s.pausedAccumulatedMs,
      nowMs: s.nowMs,
    });
    if (s.status === "IDLE") return s.targetMs;
    return Math.max(0, s.targetMs - elapsed);
  });
}

export function useProgress(): number {
  return useTimerStore((s) => {
    if (s.status === "IDLE") return 0;
    const elapsed = computeElapsedMs({
      status: s.status,
      startedAt: s.startedAt,
      pausedAt: s.pausedAt,
      pausedAccumulatedMs: s.pausedAccumulatedMs,
      nowMs: s.nowMs,
    });
    return Math.max(0, Math.min(1, elapsed / s.targetMs));
  });
}

export const timerDebug = isDebug;
