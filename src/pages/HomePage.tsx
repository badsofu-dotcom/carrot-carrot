/**
 * Phase 8.0-a — Pomocat-inspired minimalist Home.
 *
 * Home = focus only. 본문에는 시간 preset chip, 타이머 ring + 토끼, session dots,
 * 4개 icon-only control (play/pause/skip/reset/abandon), 작은 sound chip 만 노출한다.
 * 인사말/날짜/통계카드/한마디말풍선 등 모든 비-focus 요소는 다른 라우트로 이동.
 */

import { useEffect, useRef, useState } from "react";
import { Chip, toast } from "../design-system/ui";
import { Bunny } from "../components/Bunny";
import { useUserStore } from "../store/userStore";
import { haptic } from "../design-system/haptic";
import { safeStorage } from "../lib/safeStorage";
import {
  PRESETS,
  loadShowCustomSlot,
  loadAutoBreak,
  useProgress,
  useRemainingMs,
  useTimerStore,
} from "../store/timerStore";
import { AbandonModal } from "../features/timer/AbandonModal";
import { SessionOverlay } from "../features/timer/SessionOverlay";
import { CustomDurationSheet } from "../features/timer/CustomDurationSheet";
import { TimerDisplay } from "./Home/TimerDisplay";
import { TimerControls } from "../components/TimerControls";
import { SoundSheet } from "../features/sound/SoundSheet";
import { sendOrQueue } from "../lib/offlineQueue";
import {
  useCollectionStore,
  useStreakDays,
  useTodayCarrots,
} from "../features/collection/collectionStore";
import { UnlockOverlay } from "../features/collection/UnlockOverlay";
import { loginWithToss } from "../services/authService";
import { useSoundStore, isPassActive } from "../store/soundStore";
import { PREMIUM_SOUNDS } from "../data/sounds";
import { useFarmStore } from "../features/collection/farmStore";
import { getFocusFarmRewardFromMs } from "../lib/farmRules";

const LOGIN_PROMPT_KEY = "cc.hasSeenLoginPrompt";
const LOGIN_PROMPT_DELAY = 500;

export function HomePage() {
  const authMode = useUserStore((s) => s.mode);
  const setAuth = useUserStore((s) => s.setAuth);

  // ---------- Timer + Sound run at App level (Phase 8.0-c) for background continuity ----------
  const status = useTimerStore((s) => s.status);
  const selectedMinutes = useTimerStore((s) => s.selectedMinutes);
  const customMinutes = useTimerStore((s) => s.customMinutes);
  const targetMs = useTimerStore((s) => s.targetMs);
  const startTimer = useTimerStore((s) => s.start);
  const pauseTimer = useTimerStore((s) => s.pause);
  const resumeTimer = useTimerStore((s) => s.resume);
  const abandonTimer = useTimerStore((s) => s.abandon);
  const resetTimer = useTimerStore((s) => s.reset);
  const setSelectedMinutes = useTimerStore((s) => s.setSelectedMinutes);
  const setCustomMinutes = useTimerStore((s) => s.setCustomMinutes);
  const lastSnapshot = useTimerStore((s) => s.lastSnapshot);
  const clearSnapshot = useTimerStore((s) => s.clearSnapshot);
  const mode = useTimerStore((s) => s.mode);
  const remainingMs = useRemainingMs();
  const progress = useProgress();
  const todayCompleted = useTodayCarrots();
  const isBreak = mode === "break";

  // Phase 8.0-c — long-press peekaboo (1s big-bunny burst)
  const [peekaboo, setPeekaboo] = useState(false);

  const [customSheetOpen, setCustomSheetOpen] = useState(false);
  const [soundSheetOpen, setSoundSheetOpen] = useState(false);
  const soundPlaying = useSoundStore((s) => s.isPlaying);
  const showCustomSlot = loadShowCustomSlot();
  const isCustomActive = !PRESETS.includes(selectedMinutes as 15 | 25 | 50);

  const isIdle = status === "IDLE";
  const isFocusing = status === "FOCUSING";
  const isPaused = status === "PAUSED";

  // 페이지 떠나기 경고
  useEffect(() => {
    if (!isFocusing && !isPaused) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isFocusing, isPaused]);

  // 세션 종료 → 서버 보고 (offline-safe)
  useEffect(() => {
    if (!lastSnapshot) return;
    if (lastSnapshot.type === "complete") {
      haptic("success");
      void sendOrQueue("/session-complete", {
        preset_min: lastSnapshot.preset,
        focused_ms: lastSnapshot.focusedMs,
        ended_at: lastSnapshot.at,
      });
    } else {
      haptic("heavy");
      void sendOrQueue("/session-abandon", {
        preset_min: lastSnapshot.preset,
        focused_ms: lastSnapshot.focusedMs,
        ended_at: lastSnapshot.at,
      });
    }
  }, [lastSnapshot]);

  const [abandonOpen, setAbandonOpen] = useState(false);
  const [overlayKind, setOverlayKind] = useState<"complete" | "abandon" | null>(null);
  const [unlockQueue, setUnlockQueue] = useState<string[]>([]);
  const applySession = useCollectionStore((s) => s.applySession);
  const applyAbandon = useCollectionStore((s) => s.applyAbandon);

  // Phase 8.0-b reward hooks — sound rewards.
  const streakDaysVal = useStreakDays();
  const activateSoundPass = useSoundStore((s) => s.activateSoundPass);
  const unlockPermanent = useSoundStore((s) => s.unlockPermanent);
  const passExpiresAt = useSoundStore((s) => s.soundPassExpiresAt);
  const permanentUnlocks = useSoundStore((s) => s.permanentUnlocks);

  const startBreak = useTimerStore((s) => s.startBreak);
  const lastSnapshotIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!lastSnapshot) return;
    if (lastSnapshotIdRef.current === lastSnapshot.at) return;
    lastSnapshotIdRef.current = lastSnapshot.at;
    // Phase 8.0-c — autoBreak 켜져 있고 focus complete 면 overlay 생략 + 즉시 휴식 시작.
    const autoBreakOn = loadAutoBreak();
    if (lastSnapshot.type === "complete" && autoBreakOn) {
      setOverlayKind(null);
    } else {
      setOverlayKind(lastSnapshot.type);
    }
    if (lastSnapshot.type === "complete") {
      // Compute the 5-min farm gate FIRST so we can short-circuit all
      // session rewards (streak, carrot stat, unlocks, sound pass)
      // when the user closed the timer before the gate. User expectation
      // verified in this PR: "5분 미만이면 작물·당근·물뿌리개 모두 보상 없음".
      const reward = getFocusFarmRewardFromMs(lastSnapshot.focusedMs);

      if (!reward.valid) {
        // Below the 5-min gate. Single gate toast, no state changes.
        // Carrots, streak, unlocks, sound pass, legendary all stay at
        // their previous values — the session simply doesn't count.
        toast(reward.message); // "5분 이상 집중해야 작물이 자라요"
      } else {
        const newIds = applySession({
          presetMin: lastSnapshot.preset,
          focusedMs: lastSnapshot.focusedMs,
          type: "complete",
        });
        if (newIds.length) setUnlockQueue(newIds);

        // Reward 1: 오늘 5세션 완료 → 원데이 사운드 패스.
        if (!isPassActive(passExpiresAt) && todayCompleted + 1 >= 5) {
          activateSoundPass();
          toast("5판 달성! 오늘 사운드 패스 받았어");
        }

        // Reward 2: streak 7일 → 모든 premium 영구 해제 (mass grant).
        if (streakDaysVal + 0 >= 7) {
          for (const p of PREMIUM_SOUNDS) {
            if (!permanentUnlocks.includes(p.id)) unlockPermanent(p.id);
          }
        }

        // Reward 3: legendary 토끼 unlock → bunny-purr 영구 해제.
        if (newIds.some((id) => id.startsWith("legendary"))) {
          if (!permanentUnlocks.includes("bunny-purr")) {
            unlockPermanent("bunny-purr");
            toast("토끼 숨소리 영구 해제!");
          }
        }

        // Reward 4: 농장 — duration-tier 적용.
        const grown = useFarmStore
          .getState()
          .growAllPlanted(reward.growSteps, lastSnapshot.at, reward.seedDelta);
        if (grown > 0 || reward.seedDelta > 0) {
          toast(reward.message);
        }
      }

      // Phase 8.0-c — autoBreak 자동 시작. snapshot 즉시 소비 + break 5분 시작.
      if (autoBreakOn) {
        // 다음 microtask 에 시작해 React state 적용 순서 안정화.
        Promise.resolve().then(() => {
          clearSnapshot();
          startBreak();
          toast("5분 휴식 시작 — 푹 쉬자");
        });
      }
    } else {
      const newIds = applyAbandon();
      if (newIds.length) setUnlockQueue(newIds);
    }
  }, [
    lastSnapshot,
    applySession,
    applyAbandon,
    todayCompleted,
    passExpiresAt,
    activateSoundPass,
    streakDaysVal,
    permanentUnlocks,
    unlockPermanent,
    clearSnapshot,
    startBreak,
  ]);

  const closeOverlay = () => {
    setOverlayKind(null);
    clearSnapshot();
    resetTimer();
  };

  const closeUnlock = () => setUnlockQueue([]);

  // 첫 방문 → 토스 자동 로그인 시도
  useEffect(() => {
    if (authMode === "loading" || authMode === "toss") return;
    const seen = safeStorage.get(LOGIN_PROMPT_KEY) === "1";
    if (seen) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      safeStorage.set(LOGIN_PROMPT_KEY, "1");
      try {
        const snap = await loginWithToss();
        if (cancelled) return;
        setAuth({ user: snap.user, mode: snap.mode, hint: snap.hint });
        if (snap.mode === "toss") toast("토스 연결됨 흐흐");
      } catch {
        /* guest 유지 */
      }
    }, LOGIN_PROMPT_DELAY);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [authMode, setAuth]);

  const handlePlayPause = () => {
    if (isIdle) startTimer();
    else if (isFocusing) pauseTimer();
    else if (isPaused) resumeTimer();
  };

  // Skip — 활성 세션을 즉시 다음 상태로 (현 세션 reset 후 idle).
  // 8.0-c 에서 break 모드와 연결.
  const handleSkip = () => {
    if (isIdle) return;
    resetTimer();
  };

  const handleReset = () => {
    if (isIdle) return;
    resetTimer();
  };

  const handlePresetTap = (p: number) => {
    if (status !== "IDLE") {
      toast(`다음 라운드부터 ${p}분으로`);
      setSelectedMinutes(p);
      haptic("light");
      return;
    }
    haptic("medium");
    setSelectedMinutes(p);
  };

  const handleCustomPillTap = () => {
    haptic("medium");
    setCustomSheetOpen(true);
  };

  const handleCustomConfirm = (min: number) => {
    setCustomMinutes(min);
  };

  const handleAbandonRequest = () => {
    haptic("warning");
    setAbandonOpen(true);
  };

  const handleAbandonConfirm = () => {
    setAbandonOpen(false);
    abandonTimer();
  };

  return (
    <main
      className="app-screen"
      data-testid={isBreak ? "page-home-break" : "page-home"}
      data-mode={mode}
      style={{
        // safe-area + 32 top whitespace
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 32px)",
        paddingBottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Phase 8.0-c — break 모드는 한 톤 cooler/lavender 배경.
        background: isBreak
          ? "linear-gradient(180deg, #EFE9F5 0%, var(--bg-primary) 100%)"
          : undefined,
        transition: "background 0.4s var(--ease-smooth)",
      }}
    >
      {/* Preset chips — 15 / 25 / 50 + ⚙ 커스텀.
          Phase 8.0-h: FOCUSING 동안에는 시각적으로 숨기되 vertical layout 은
          유지한다 (visibility:hidden + pointer-events:none) — 토끼 ring 이
          play 직후 위로 점프하지 않게. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 24,
          visibility: isFocusing ? "hidden" : "visible",
          pointerEvents: isFocusing ? "none" : "auto",
        }}
        role="radiogroup"
        aria-label="집중 시간 프리셋"
        aria-hidden={isFocusing || undefined}
      >
        {PRESETS.map((p) => {
          const active = !isCustomActive && selectedMinutes === p;
          return (
            <Chip
              key={p}
              role="radio"
              aria-checked={active}
              tone="carrot"
              active={active}
              onClick={() => handlePresetTap(p)}
              data-testid={`chip-preset-${p}`}
              tabIndex={isFocusing ? -1 : 0}
            >
              {p}분
            </Chip>
          );
        })}
        {showCustomSlot && (
          <Chip
            role="radio"
            aria-checked={isCustomActive}
            tone="carrot"
            active={isCustomActive}
            onClick={handleCustomPillTap}
            data-testid="chip-preset-custom"
            tabIndex={isFocusing ? -1 : 0}
          >
            {isCustomActive ? `${customMinutes}분 ✎` : "⚙ 커스텀"}
          </Chip>
        )}
      </div>

      {/* Timer ring + bunny */}
      <TimerDisplay
        status={status}
        mode={mode}
        progress={progress}
        remainingMs={remainingMs}
        targetMs={targetMs}
        onMainAction={handlePlayPause}
        onLongPress={() => {
          setPeekaboo(true);
          window.setTimeout(() => setPeekaboo(false), 1000);
        }}
      />

      {/* Phase 8.0-e — session dots removed from Home (ring already shows progress).
          SessionDots component preserved for future use elsewhere. */}

      {/* Icon controls (Phase 8.0-d/e): play/pause · reset · abandon · sound */}
      <TimerControls
        status={status}
        onPlayPause={handlePlayPause}
        onSkip={handleSkip}
        onReset={handleReset}
        onAbandon={handleAbandonRequest}
        onSound={() => setSoundSheetOpen(true)}
        soundPlaying={soundPlaying}
      />

      <SoundSheet
        open={soundSheetOpen}
        onClose={() => setSoundSheetOpen(false)}
      />

      {/* Modals + overlays */}
      <AbandonModal
        open={abandonOpen}
        onClose={() => setAbandonOpen(false)}
        onConfirm={handleAbandonConfirm}
      />
      <SessionOverlay kind={overlayKind} onClose={closeOverlay} />
      <UnlockOverlay queue={unlockQueue} onClose={closeUnlock} />
      <CustomDurationSheet
        open={customSheetOpen}
        initial={isCustomActive ? selectedMinutes : customMinutes}
        onClose={() => setCustomSheetOpen(false)}
        onConfirm={handleCustomConfirm}
      />

      {/* Phase 8.0-c — peekaboo Easter egg */}
      <PeekabooOverlay open={peekaboo} mode={mode} />
    </main>
  );
}

function PeekabooOverlay({
  open,
  mode,
}: {
  open: boolean;
  mode: "focus" | "break";
}) {
  if (!open) return null;
  return (
    <div
      data-testid="peekaboo"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 240,
        display: "grid",
        placeItems: "center",
        background: "rgba(15, 12, 8, 0.18)",
        pointerEvents: "none",
        animation: "peekaboo-pop 1s ease-out",
      }}
    >
      <PeekabooBunny variant={mode === "break" ? "sleep" : "rare_king"} />
    </div>
  );
}

function PeekabooBunny({ variant }: { variant: "sleep" | "rare_king" }) {
  return (
    <div
      style={{
        width: 220,
        height: 220,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 16px 48px rgba(0,0,0,0.32)",
        background: "var(--bg-elevated)",
        animation: "peekaboo-pop 1s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <Bunny variant={variant} size={220} frame="circle" breathe alt="peekaboo" />
    </div>
  );
}
