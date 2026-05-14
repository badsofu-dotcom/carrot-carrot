/**
 * Phase 7.9.1 — 타이머 비주얼 재설계 (CTA-fold-fix + bunny in-ring fix).
 *
 * 구조:
 *   - 링 사이즈 responsive: clamp(264px, 78vw, 320px). stroke 16, carrot/amber/yellow gradient.
 *   - 인테리어 cream circle. 토끼는 같은 원 안쪽에 직접 합성됨 (광원/사진 액자 X).
 *   - 토끼 이미지는 radial CSS mask 로 바깥 가장자리가 cream 인테리어로 자연스럽게 페이드 →
 *     원본 webp 의 베이지 배경이 사각형 사진처럼 보이지 않음.
 *   - 숫자 48px/900 tabular-nums, 링 윗부분.
 *   - 진행 endpoint dot + carrot aura pulse (focusing only, 3s, reduced-motion respected).
 *   - 잔여 60초: 빨강 #E74C3C + 1s pulse.
 *   - Tap → start/pause/resume.
 */

import { useEffect, useMemo, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BunnyKey } from "../../assets/characters";
import { bunnyImages } from "../../assets/characters";
import { haptic } from "../../design-system/haptic";
import { useTimerStore } from "../../store/timerStore";

interface TimerDisplayProps {
  status: "IDLE" | "FOCUSING" | "PAUSED" | "COMPLETED" | "ABANDONED";
  /** Phase 8.0-c — 'focus' (default) 또는 'break'. break 면 sleep 토끼 + warm 톤. */
  mode?: "focus" | "break";
  progress: number; // 0..1
  remainingMs: number;
  targetMs: number;
  onMainAction: () => void;
  /** Phase 8.0-c — 5초 long-press 시 호출 (peekaboo trigger). */
  onLongPress?: () => void;
}

/** Ring 의 시각적 디자인은 320 기준; 좁은 viewport 에서는 78vw 까지 줄어들어
 *  CTA 가 항상 fold 위에 보이도록 한다. SVG geometry 는 320 viewBox 그대로 두고,
 *  outer width/height 는 CSS clamp 로 축소만 한다 (벡터 → 비례 축소). */
const VIEWBOX = 320;
const RING_CSS_SIZE = "clamp(264px, 78vw, 320px)";
const STROKE = 16;
/** Stage 지름 = ring inner-circle 지름 = ring − 2*STROKE. 320 viewBox 기준 288 px (= 90%).
 *  stage 자체가 timer 의 원형 표면이고, border-radius:50% + overflow:hidden 로
 *  bunny image 를 mask 의존 없이 hard-clip 한다 — Chromium 이 어떤 경우에도 stage 바깥으로
 *  픽셀을 칠하지 못한다. */
const STAGE_PCT = (320 - 2 * 16) / 320;
const PRELOAD_KEYS: BunnyKey[] = ["idle", "eat25", "eat50", "eat75", "success"];

const URGENT_MS = 60_000;
const RED = "#E74C3C";

function pickBunny(
  status: TimerDisplayProps["status"],
  progress: number,
  mode: "focus" | "break" = "focus",
): BunnyKey {
  if (mode === "break") return "sleep"; // Phase 8.0-c — 휴식엔 자는 토끼.
  if (status === "ABANDONED") return "cry";
  if (status === "COMPLETED") return "success";
  if (status === "IDLE") return "idle";
  if (progress >= 1) return "success";
  if (progress >= 0.75) return "eat75";
  if (progress >= 0.5) return "eat50";
  if (progress >= 0.25) return "eat25";
  return "idle";
}

function fmtTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Phase 7.9 polish — 60fps smooth progress.
 * store 의 authoritative 필드 (startedAt, pausedAccumulatedMs, pausedAt, status, targetMs) 만
 * 읽고, 매 프레임 rAF 로 자체 진행률을 계산한다 → 0.6s ease 없이 부드러운 연속 motion.
 * FOCUSING 일 때만 rAF 루프, 그 외엔 prop progress 를 그대로 사용.
 * reduced-motion 도 같은 로직 (rAF 도 부드러움) 이지만 carrot aura/pulse 는 별도 처리.
 */
function useSmoothProgress(propProgress: number, status: TimerDisplayProps["status"]) {
  const startedAt = useTimerStore((s) => s.startedAt);
  const pausedAt = useTimerStore((s) => s.pausedAt);
  const pausedAccumulatedMs = useTimerStore((s) => s.pausedAccumulatedMs);
  const targetMs = useTimerStore((s) => s.targetMs);

  const [smooth, setSmooth] = useState(propProgress);

  useEffect(() => {
    if (status !== "FOCUSING") {
      // 비FOCUSING 상태에서는 prop progress 를 그대로 따라간다.
      setSmooth(propProgress);
      return;
    }
    let raf = 0;
    const loop = () => {
      if (startedAt === null || targetMs <= 0) return;
      const ref = pausedAt ?? Date.now();
      const elapsed = Math.max(0, ref - startedAt - pausedAccumulatedMs);
      const p = Math.max(0, Math.min(1, elapsed / targetMs));
      setSmooth(p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, startedAt, pausedAt, pausedAccumulatedMs, targetMs, propProgress]);

  return smooth;
}

export function TimerDisplay({
  status,
  mode = "focus",
  progress,
  remainingMs,
  targetMs,
  onMainAction,
  onLongPress,
}: TimerDisplayProps) {
  const isIdle = status === "IDLE";
  const isPaused = status === "PAUSED";
  const isFocusing = status === "FOCUSING";

  // 60fps smooth progress (FOCUSING 동안만 rAF; 그 외엔 prop 따라감).
  const smoothProgress = useSmoothProgress(progress, status);

  const bunnyKey = useMemo(
    () => pickBunny(status, smoothProgress, mode),
    [status, smoothProgress, mode],
  );
  const showMs = isIdle ? targetMs : remainingMs;
  const isUrgent = (isFocusing || isPaused) && remainingMs <= URGENT_MS && remainingMs > 0;

  const reduced = useMemo(prefersReducedMotion, []);
  const gradId = useId();
  const bunnyAsset = bunnyImages[bunnyKey];

  // 5장 preload — runtime side effect.
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    for (const k of PRELOAD_KEYS) {
      const asset = bunnyImages[k];
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = asset.src;
      link.type = "image/webp";
      document.head.appendChild(link);
      links.push(link);
    }
    return () => {
      for (const l of links) {
        try {
          document.head.removeChild(l);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  // SVG geometry (viewBox 좌표계 — 320 고정)
  const r = (VIEWBOX - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, smoothProgress));
  const offset = c * (1 - clamped);

  // endpoint dot 위치 — 12시 기준 시계방향.
  const angle = clamped * 2 * Math.PI - Math.PI / 2;
  const cx = VIEWBOX / 2 + r * Math.cos(angle);
  const cy = VIEWBOX / 2 + r * Math.sin(angle);

  const numberColor = (() => {
    if (isUrgent) return RED;
    if (isFocusing) return "var(--accent-carrot)";
    if (isPaused) return "var(--text-tertiary)";
    return "var(--text-primary)";
  })();

  const ringAriaLabel = (() => {
    const t = fmtTime(showMs);
    return `타이머 ${t} ${
      isIdle
        ? "탭해서 시작"
        : isFocusing
          ? "집중 중, 탭해서 일시정지"
          : isPaused
            ? "일시정지, 탭해서 다시 시작"
            : ""
    }`;
  })();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        userSelect: "none",
      }}
    >
      <LongPressButton
        onTap={() => {
          haptic(isIdle ? "medium" : "light");
          onMainAction();
        }}
        onLongPress={onLongPress}
        ariaLabel={ringAriaLabel}
      >
        {/* radial carrot aura pulse — focusing 동안만, reduced-motion off */}
        {isFocusing && !reduced && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0.2, scale: 0.92 }}
            animate={{ opacity: [0.18, 0.42, 0.18], scale: [0.92, 1.06, 0.92] }}
            transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
            style={{
              position: "absolute",
              inset: -28,
              borderRadius: "50%",
              background:
                "radial-gradient(closest-side, rgba(255, 153, 64, 0.32), rgba(255, 153, 64, 0) 70%)",
              filter: "blur(8px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}

        {/* Stage = ring 의 inner circle = timer 의 표면.
            border-radius:50% + overflow:hidden 로 hard CSS clip → bunny image 가
            stage 바깥으로 절대 누출되지 않는다 (mask 의존 X). stage 자체가 warm-tan
            radial 그라디언트라서 bunny webp 의 ambient 톤과 한 덩어리로 읽힌다. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: `${STAGE_PCT * 100}%`,
            height: `${STAGE_PCT * 100}%`,
            borderRadius: "9999px",
            overflow: "hidden",
            background:
              "radial-gradient(circle at 50% 38%, #F0E0C5 0%, #DCC8A8 55%, #C7B295 100%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
          data-testid="timer-stage"
        >
          <AnimatePresence mode="popLayout">
            <motion.img
              key={bunnyKey}
              src={bunnyAsset.src}
              srcSet={bunnyAsset.srcSet}
              alt={`타이머 토끼 ${bunnyKey}`}
              draggable={false}
              fetchPriority="high"
              decoding="async"
              initial={{ opacity: 0 }}
              animate={{ opacity: isPaused ? 0.55 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className={isFocusing && !reduced ? "bunny-breathe" : ""}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                // figure 가 stage 중앙-아래 자리. 디지트는 transparent overlay 라
                // 토끼 머리/귀가 가려지지 않는다.
                objectPosition: "center 62%",
                display: "block",
                filter: isPaused ? "saturate(0.7)" : undefined,
              }}
            />
          </AnimatePresence>
        </div>

        {/* SVG ring stroke + endpoint dot — stage 위에 얹혀 ring frame 을 그린다 */}
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFC857" />
              <stop offset="50%" stopColor="#FF9940" />
              <stop offset="100%" stopColor="#FF6B35" />
            </linearGradient>
          </defs>

          {/* track */}
          <circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={r}
            fill="none"
            stroke="#E8D2B0"
            strokeWidth={STROKE}
            transform={`rotate(-90 ${VIEWBOX / 2} ${VIEWBOX / 2})`}
          />

          {/* progress arc — Phase 7.9 polish: rAF-driven smoothProgress 가 매 프레임
              strokeDashoffset 을 갱신하므로 framer-motion 의 0.6s ease 없이 60fps 연속 motion. */}
          <circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={r}
            fill="none"
            stroke={isUrgent ? RED : isPaused ? "var(--text-tertiary)" : `url(#${gradId})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${VIEWBOX / 2} ${VIEWBOX / 2})`}
          />

          {/* endpoint dot */}
          {!isIdle && clamped > 0 && (
            <g style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.22))" }}>
              <circle cx={cx} cy={cy} r={STROKE / 2 + 3} fill="#fff" />
              <circle
                cx={cx}
                cy={cy}
                r={STROKE / 2}
                fill={isUrgent ? RED : "var(--accent-carrot)"}
              />
            </g>
          )}
        </svg>

        {/* 숫자 — 배경 pill 없이 transparent overlay. 토끼 머리/귀 가리지 않고
            단순한 text-shadow + carrot text 로 stage 위에서도 또렷이 읽힌다. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: "13%",
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          <motion.div
            data-testid="timer-digits"
            className="tabular-nums"
            animate={
              isUrgent && !reduced
                ? { scale: [1, 1.04, 1] }
                : { scale: 1 }
            }
            transition={
              isUrgent
                ? { duration: 1, ease: "easeInOut", repeat: Infinity }
                : { duration: 0.2 }
            }
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: numberColor,
              letterSpacing: "-0.04em",
              fontVariantNumeric: "tabular-nums",
              fontFeatureSettings: "'tnum' 1",
              lineHeight: 1,
              minWidth: "5.6ch",
              textAlign: "center",
              whiteSpace: "nowrap",
              // stage tan 위에서도 가독성 확보: 두 단계 soft shadow + 얇은 light halo.
              textShadow:
                "0 1px 0 rgba(255, 246, 220, 0.85), 0 2px 6px rgba(0, 0, 0, 0.18)",
            }}
          >
            {fmtTime(showMs)}
          </motion.div>
        </div>

        {/* PAUSED overlay — 토끼 위에 별도 zIndex */}
        {isPaused && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            <span
              style={{
                fontSize: 56,
                fontWeight: 800,
                color: "var(--text-primary)",
                textShadow: "0 2px 8px rgba(0,0,0,0.25)",
                lineHeight: 1,
              }}
            >
              ⏸
            </span>
          </div>
        )}
      </LongPressButton>
    </div>
  );
}

/**
 * Phase 8.0-c — long-press 5초 감지 버튼.
 * 일반 tap 은 즉시 onTap. 5초 이상 누르면 onLongPress (peekaboo trigger).
 * pointer move > 24px 또는 pointer up 시 long-press 카운트는 취소.
 */
function LongPressButton({
  children,
  onTap,
  onLongPress,
  ariaLabel,
}: {
  children: React.ReactNode;
  onTap: () => void;
  onLongPress?: () => void;
  ariaLabel: string;
}) {
  const timerRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    triggeredRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    if (onLongPress) {
      timerRef.current = window.setTimeout(() => {
        triggeredRef.current = true;
        try {
          haptic("success");
        } catch {
          /* ignore */
        }
        onLongPress();
      }, 5000);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startPosRef.current;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx > 24 || dy > 24) cancel();
  };

  const onPointerUp = () => {
    cancel();
    startPosRef.current = null;
  };

  const onClick = () => {
    if (triggeredRef.current) {
      // long-press 가 발동된 click 은 무시.
      triggeredRef.current = false;
      return;
    }
    onTap();
  };

  return (
    <motion.button
      type="button"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerMove={onPointerMove}
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      aria-label={ariaLabel}
      data-testid="button-timer-main"
      style={{
        position: "relative",
        width: RING_CSS_SIZE,
        height: RING_CSS_SIZE,
        aspectRatio: "1 / 1",
        padding: 0,
        margin: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        borderRadius: "50%",
        touchAction: "manipulation",
      }}
    >
      {children}
    </motion.button>
  );
}
