/**
 * Phase 8.0-d — Pomocat-style icon-only timer controls.
 *
 * IDLE / PAUSED — 4 visible icons: play(or pause-resume) · reset · abandon · sound.
 * FOCUSING — 1 visible icon: pause. (skip/reset/abandon/sound 모두 숨김)
 *
 * Touch hitbox 56x56, icon ~28, gap 26. Active = carrot. Otherwise tertiary.
 * No text labels on Home — aria-label 만 제공.
 *
 * `onSkip` prop 은 호출자 호환을 위해 시그니처에 남겨두지만 UI 에서는 표시하지 않는다.
 */

import { motion } from "framer-motion";
import { haptic } from "../design-system/haptic";

type Status = "IDLE" | "FOCUSING" | "PAUSED" | "COMPLETED" | "ABANDONED";

interface Props {
  status: Status;
  onPlayPause: () => void;
  /** 호출자 호환 — UI 미노출 (X 버튼이 redundant). */
  onSkip?: () => void;
  onReset: () => void;
  onAbandon: () => void;
  /** 백색소음 sheet entry. */
  onSound?: () => void;
  /** 사운드가 현재 재생 중인지 (visual hint). */
  soundPlaying?: boolean;
}

const ICON = 28;
const HIT = 56;
const GAP = 26;

export function TimerControls({
  status,
  onPlayPause,
  onReset,
  onAbandon,
  onSound,
  soundPlaying = false,
}: Props) {
  const isFocusing = status === "FOCUSING";
  const isIdle = status === "IDLE";
  const isPaused = status === "PAUSED";

  const playLabel = isFocusing ? "일시 정지" : isPaused ? "이어서" : "집중 시작";
  const playIcon = isFocusing ? <PauseIcon /> : <PlayIcon />;

  return (
    <div
      role="group"
      aria-label="타이머 컨트롤"
      data-testid="timer-controls"
      style={{
        display: "flex",
        gap: GAP,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 12,
      }}
    >
      <ControlButton
        label={playLabel}
        active
        accent
        testId="ctrl-play-pause"
        onClick={() => {
          haptic(isIdle ? "medium" : "light");
          onPlayPause();
        }}
      >
        {playIcon}
      </ControlButton>

      {/* FOCUSING 동안에는 보조 버튼 모두 숨김 — pause 하나만 노출. */}
      {!isFocusing && (
        <>
          <ControlButton
            label="초기화"
            disabled={isIdle}
            testId="ctrl-reset"
            onClick={() => {
              haptic("light");
              onReset();
            }}
          >
            <ResetIcon />
          </ControlButton>
          <ControlButton
            label="포기"
            disabled={!isPaused}
            testId="ctrl-abandon"
            onClick={() => {
              haptic("warning");
              onAbandon();
            }}
          >
            <AbandonIcon />
          </ControlButton>
          {onSound && (
            <ControlButton
              label="사운드"
              accent={soundPlaying}
              testId="ctrl-sound"
              onClick={() => {
                haptic("light");
                onSound();
              }}
            >
              <SoundIcon />
            </ControlButton>
          )}
        </>
      )}
    </div>
  );
}

function ControlButton({
  children,
  label,
  onClick,
  active = false,
  accent = false,
  disabled = false,
  testId,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  accent?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  const color = disabled
    ? "var(--text-tertiary)"
    : accent
      ? "var(--accent-carrot)"
      : active
        ? "var(--text-primary)"
        : "var(--text-secondary)";

  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      data-testid={testId}
      style={{
        width: HIT,
        height: HIT,
        padding: 0,
        margin: 0,
        border: "none",
        background: "transparent",
        cursor: disabled ? "default" : "pointer",
        display: "grid",
        placeItems: "center",
        color,
        opacity: disabled ? 0.5 : 1,
        transition: "color 0.18s var(--ease-smooth), opacity 0.18s var(--ease-smooth)",
      }}
    >
      {children}
    </motion.button>
  );
}

function svgProps(): React.SVGAttributes<SVGSVGElement> {
  return {
    width: ICON,
    height: ICON,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
}

function PlayIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M7 5.5v13L19 12 7 5.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg {...svgProps()}>
      <rect x="6.5" y="5.5" width="3.5" height="13" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="14" y="5.5" width="3.5" height="13" rx="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
      <path d="M4.5 4.5v4h4" />
    </svg>
  );
}

function AbandonIcon() {
  // Plain X — abandon
  return (
    <svg {...svgProps()}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

function SoundIcon() {
  // Note + sound waves — minimal, label-free.
  return (
    <svg {...svgProps()}>
      <path d="M9 18V7l9-2v11" />
      <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
