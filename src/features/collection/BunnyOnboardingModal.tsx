/**
 * BunnyOnboardingModal — v2 overlay speech-bubble onboarding.
 *
 * The previous bottom-sheet design hid the "Next" button behind BottomNav
 * (TabBar) on short viewports and locked swipe through framer-motion's
 * drag overlay. This rewrite is a plain fixed-position overlay:
 *
 *   - Fullscreen scrim at z-index 1000 (BottomNav is z-index 100), so the
 *     CTA is always reachable above the bottom tab bar.
 *   - Bunny illustration anchored bottom-left, well above safe-area
 *     inset + 96px, so the cropped knife edge of the device never clips
 *     it.
 *   - Speech bubble to the bunny's right, capped at 60vw with a CSS
 *     left-tail triangle.
 *   - 4 dot indicator (top center): active #FF7B61, inactive #E5E5E5.
 *   - Skip text button top-right ("건너뛰기"), #999 size 14.
 *   - Primary CTA inside the bubble column: full bubble-width, height 52,
 *     radius 14, bg #FF7B61. Steps 1-3 "다음", step 4 "시작하기".
 *   - Horizontal touch-swipe: left ≥50px → next step; right ≥50px →
 *     previous step. No ESC handler.
 *   - On finish (CTA on step 4 or skip), writes `onboarded:v1 = "true"`
 *     via safeStorage and unmounts.
 *
 * Asset: `public/assets/farm/bunny_planting.webp` (only transparent-alpha
 * bunny in the repo). Loaded via BASE_URL so nested-base preview works.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { safeStorage } from "../../lib/safeStorage";
import { haptic } from "../../design-system/haptic";

export const ONBOARDING_KEY = "onboarded:v1";

const STEPS: string[] = [
  "안녕! 나는 콩이 🐰 25분 집중하면 작물이 한 단계씩 자라요",
  "수확한 당근은 토스포인트로 바꿀 수 있어요 (1당근 = 1P)",
  "확률에 따라 캔디당근(5P), 황금당근(10P)도 나와요!",
  "오른쪽 위 도감에서 토끼·아이템 컬렉션을 모아보세요",
];

const ACCENT = "#FF7B61";
const INACTIVE_DOT = "#E5E5E5";
const SKIP_COLOR = "#999";
const SWIPE_THRESHOLD = 50;

const BASE = import.meta.env.BASE_URL;
const BUNNY_SRC = `${BASE}assets/farm/bunny_planting.webp`;

interface Props {
  /** If true, show even when safeStorage flag is set. */
  forceOpen?: boolean;
  /** Called when the user finishes / dismisses. */
  onClose?: () => void;
}

/**
 * URL-based overrides for QA / preview:
 *   ?resetOnboarding=1  — clear the safeStorage flag on mount, so the
 *                          modal opens this session. The flag is set
 *                          back to "true" when the user finishes/skips.
 *   ?onboarding=1       — force-open the modal regardless of the flag.
 *                          Surviving `시작하기` writes the flag, but the
 *                          ?onboarding=1 URL keeps re-opening it on every
 *                          new page load, so users can stay in QA mode.
 *
 * Both flags are query-string only; no URL fragment changes are needed.
 * The flag-check stays defensive (`try` / fallback false) so the modal
 * still renders if `window.location` is unavailable (SSR).
 */
function readUrlOnboardingFlags(): { force: boolean; reset: boolean } {
  if (typeof window === "undefined") return { force: false, reset: false };
  try {
    const params = new URLSearchParams(window.location.search);
    const force = params.get("onboarding") === "1";
    const reset = params.get("resetOnboarding") === "1";
    return { force, reset };
  } catch {
    return { force: false, reset: false };
  }
}

/**
 * Imperatively re-open the onboarding from anywhere in the app
 * (Settings → 온보딩 다시 보기). Dispatched as a CustomEvent so any
 * mounted modal listens without needing a global store binding.
 */
export const ONBOARDING_REOPEN_EVENT = "cc:onboarding:reopen";

export function reopenOnboarding(): void {
  try {
    window.dispatchEvent(new CustomEvent(ONBOARDING_REOPEN_EVENT));
  } catch {
    /* SSR / event ctor unavailable — caller should fall back to flag */
  }
}

export function BunnyOnboardingModal({ forceOpen = false, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const url = readUrlOnboardingFlags();
    if (url.reset) {
      // Wipe the persisted flag so the modal opens this session.
      safeStorage.set(ONBOARDING_KEY, "false");
    }
    if (forceOpen || url.force || url.reset) {
      setOpen(true);
      setStep(0);
      return;
    }
    const seen = safeStorage.get(ONBOARDING_KEY) === "true";
    if (!seen) {
      setOpen(true);
      setStep(0);
    }
  }, [forceOpen]);

  // Listen for an external re-open request (Settings replay button).
  useEffect(() => {
    const onReopen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(ONBOARDING_REOPEN_EVENT, onReopen);
    return () => window.removeEventListener(ONBOARDING_REOPEN_EVENT, onReopen);
  }, []);

  const finish = () => {
    safeStorage.set(ONBOARDING_KEY, "true");
    setOpen(false);
    onClose?.();
  };

  const goNext = () => {
    haptic("light");
    setStep((s) => (s >= STEPS.length - 1 ? s : s + 1));
  };

  const goPrev = () => {
    setStep((s) => (s <= 0 ? 0 : s - 1));
  };

  const onCta = () => {
    haptic("light");
    if (step >= STEPS.length - 1) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const onTouchStart: React.TouchEventHandler = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd: React.TouchEventHandler = (e) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (dx <= -SWIPE_THRESHOLD) goNext();
    else if (dx >= SWIPE_THRESHOLD) goPrev();
  };

  const isLast = step === STEPS.length - 1;
  const ctaLabel = isLast ? "시작하기" : "다음";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="farm-onboarding"
          aria-modal="true"
          role="dialog"
          aria-label="버니타임 온보딩"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.25)",
            pointerEvents: "auto",
          }}
        >
          {/* Skip — top right */}
          <button
            type="button"
            onClick={finish}
            data-testid="onboarding-skip"
            aria-label="건너뛰기"
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top) + 12px)",
              right: 16,
              background: "transparent",
              border: "none",
              color: SKIP_COLOR,
              fontSize: 14,
              fontWeight: 500,
              padding: 6,
              cursor: "pointer",
            }}
          >
            건너뛰기
          </button>

          {/* 4-dot indicator — top center */}
          <div
            aria-hidden
            data-testid="onboarding-dots"
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top) + 16px)",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 8,
            }}
          >
            {STEPS.map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === step ? 22 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: i === step ? ACCENT : INACTIVE_DOT,
                  transition: "width 0.25s ease",
                }}
              />
            ))}
          </div>

          {/* Bunny — vertical center / upper-third (NOT bottom-anchored).
              Explicit `zIndex` to sit above the scrim background even
              when AnimatePresence is mid-transition. Aria label keeps
              the testid distinct from the speech bubble. */}
          <img
            data-testid="onboarding-bunny"
            aria-label="콩이 토끼"
            src={BUNNY_SRC}
            alt=""
            draggable={false}
            onError={(e) => {
              // Defensive: if BASE_URL resolution loses the file under a
              // nested-proxy host, fall back to the absolute bundled path
              // and emit a single console warning so QA sees it in DevTools.
              const img = e.currentTarget;
              if (!img.dataset.fallbackTried) {
                img.dataset.fallbackTried = "1";
                console.warn("[onboarding-bunny] primary src failed:", img.src);
                img.src = "./assets/farm/bunny_planting.webp";
              }
            }}
            style={{
              position: "absolute",
              left: 16,
              top: "30vh",
              width: "40vw",
              maxWidth: 200,
              height: "auto",
              zIndex: 2,
              filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.15))",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />

          {/* Speech bubble — alongside the bunny, visually higher than
              before. Sits above the CTA region so the bubble + bunny
              compose the dialogue panel and the button is its own row. */}
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            data-testid={`onboarding-step-${step}`}
            data-bubble="onboarding-bubble"
            data-step={step}
            style={{
              position: "absolute",
              left: "calc(16px + 40vw + 12px)",
              right: 16,
              top: "30vh",
              maxWidth: "60vw",
              background: "#ffffff",
              borderRadius: 20,
              padding: "16px 20px",
              fontSize: 16,
              lineHeight: 1.5,
              fontWeight: 500,
              color: "#222",
              boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
              pointerEvents: "auto",
            }}
          >
            {/* Left tail */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 22,
                left: -10,
                width: 0,
                height: 0,
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                borderRight: "10px solid #ffffff",
                filter: "drop-shadow(-1px 0 0 rgba(0,0,0,0.04))",
              }}
            />
            {STEPS[step]}
          </motion.div>

          {/* CTA — pinned to the bottom, 24px above the BottomNav safe-
              area inset, full-width. Always visible, never covered. */}
          <button
            type="button"
            onClick={onCta}
            data-testid={isLast ? "onboarding-start" : "onboarding-next"}
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom:
                "calc(env(safe-area-inset-bottom) + var(--tabbar-reserved, 84px) + 24px)",
              height: 52,
              borderRadius: 14,
              background: ACCENT,
              color: "#ffffff",
              border: "none",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 16px rgba(255,123,97,0.32)",
              pointerEvents: "auto",
            }}
          >
            {ctaLabel}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
