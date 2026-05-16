/**
 * SkyView — fullscreen overlay that lifts the player out of the farm
 * for a few seconds of cozy "look up" reverie. The atmospheric
 * background matches the current farm slot (KST-time, weather, season).
 *
 * Polish v2 (this PR):
 *   - Tap inside the overlay cycles the message (deterministic by
 *     index, mod the slot pool of 12 entries).
 *   - Long-press 600 ms triggers a quick sparkle particle burst.
 *   - Daily-first sky entry rolls a special-event override:
 *       5 % shooting-star on any non-rainy slot
 *      30 % rainbow when the underlying slot is `bg_rainy`
 *     The chosen override stays for the duration of this open.
 *   - Sky time is accumulated via safeStorage; on hitting 5 min total
 *     the `quiet_sky` medal unlocks. Per-day visit count + last-visit
 *     timestamp are persisted so the daily-first special-event roll
 *     fires at most once per KST day.
 *   - Close fades out in 500 ms.
 *
 * z-index 1100 so it sits above BottomNav (z=100).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { skyImageFor, skyTintFor } from "../../lib/skyView";
import { pickSkyMessageAt } from "../../lib/skyMessages";
import { Atmosphere, variantForSlot } from "./Atmosphere";
import type { FarmBgSlot } from "../../lib/farmBackground";
import { safeStorage } from "../../lib/safeStorage";
import { useRewardsStore } from "../../features/collection/rewardsStore";

const SWIPE_DISMISS_PX = 80;
const LONG_PRESS_MS = 600;
const QUIET_SKY_THRESHOLD_SEC = 5 * 60; // 5 minutes total accumulates the medal.
const SHOOTING_STAR_P = 0.05;
const RAINBOW_AFTER_RAIN_P = 0.3;

const STORAGE_SKY_VISITS_DAY = "cc.sky.visits.day.v1";
const STORAGE_SKY_TIME_SEC = "cc.sky.time.sec.v1";

const BASE = import.meta.env.BASE_URL;
const SKY_SHOOTING = `${BASE}assets/farm/sky/sky_shooting_star.jpeg`;
const SKY_RAINBOW = `${BASE}assets/farm/sky/sky_rainbow.png`;

function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the special-event image override for today, or null. Called
 * once at sky-view open. Persists the choice so the same visit shows
 * the same scene if the user closes & reopens within the same KST day.
 */
function rollDailyEvent(baseSlot: FarmBgSlot): string | null {
  const today = kstDayKey();
  const stored = safeStorage.get(STORAGE_SKY_VISITS_DAY);
  let visits: { day: string; count: number; event: string | null } = {
    day: today,
    count: 0,
    event: null,
  };
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && parsed.day === today) {
        visits = parsed;
      }
    } catch {
      /* corrupted */
    }
  }
  const isFirstToday = visits.count === 0;
  if (!isFirstToday) {
    // Already opened today — re-use whatever event we picked (could be null).
    visits.count += 1;
    safeStorage.set(STORAGE_SKY_VISITS_DAY, JSON.stringify(visits));
    return visits.event;
  }
  // First open today — roll.
  let event: string | null = null;
  const r = Math.random();
  if (baseSlot === "bg_rainy" && r < RAINBOW_AFTER_RAIN_P) {
    event = SKY_RAINBOW;
  } else if (baseSlot !== "bg_rainy" && r < SHOOTING_STAR_P) {
    event = SKY_SHOOTING;
  }
  visits = { day: today, count: 1, event };
  safeStorage.set(STORAGE_SKY_VISITS_DAY, JSON.stringify(visits));
  return event;
}

function accumulateSkyTime(deltaSec: number): number {
  if (deltaSec <= 0) return readSkyTime();
  const cur = readSkyTime();
  const next = cur + Math.floor(deltaSec);
  safeStorage.set(STORAGE_SKY_TIME_SEC, String(next));
  return next;
}

function readSkyTime(): number {
  const v = Number(safeStorage.get(STORAGE_SKY_TIME_SEC) ?? "0");
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

interface Props {
  open: boolean;
  slot: FarmBgSlot;
  onClose: () => void;
}

export function SkyView({ open, slot, onClose }: Props) {
  const unlockMedal = useRewardsStore((s) => s.unlockMedal);
  const [messageIdx, setMessageIdx] = useState(0);
  const [longPressFx, setLongPressFx] = useState(0);
  const [eventImg, setEventImg] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const touchStartY = useRef<number | null>(null);
  const touchStartT = useRef<number>(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedAt = useRef<number | null>(null);
  const tapMoved = useRef(false);

  // Resolve the active image: event override (shooting star / rainbow)
  // when present, otherwise the slot's normal sky asset.
  const baseImg = skyImageFor(slot);
  const img = eventImg ?? baseImg;
  const tint = skyTintFor(slot);
  const variant = variantForSlot(slot);
  const message = useMemo(() => pickSkyMessageAt(slot, messageIdx), [slot, messageIdx]);

  // Per-open setup
  useEffect(() => {
    if (!open) {
      setImgLoaded(false);
      openedAt.current = null;
      return;
    }
    openedAt.current = Date.now();
    setMessageIdx(Math.floor(Math.random() * 12));
    setEventImg(rollDailyEvent(slot));
    return () => {
      // accumulate this visit's duration on close
      if (openedAt.current != null) {
        const sec = Math.max(0, (Date.now() - openedAt.current) / 1000);
        const total = accumulateSkyTime(sec);
        if (total >= QUIET_SKY_THRESHOLD_SEC) {
          unlockMedal("quiet_sky");
        }
      }
    };
  }, [open, slot, unlockMedal]);

  const onTouchStart: React.TouchEventHandler = (e) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
    touchStartT.current = Date.now();
    tapMoved.current = false;
    // Long-press timer
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setLongPressFx((n) => n + 1);
    }, LONG_PRESS_MS);
  };

  const onTouchMove: React.TouchEventHandler = (e) => {
    const start = touchStartY.current;
    if (start == null) return;
    const cur = e.touches[0]?.clientY ?? start;
    if (Math.abs(cur - start) > 8) {
      tapMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const onTouchEnd: React.TouchEventHandler = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientY ?? start;
    // PR-16 — dismiss only on a DOWN swipe (start → end going down,
    // i.e. end - start positive). Previously closed on either direction
    // which was inconsistent with the new farm-side swipe-up-to-open
    // gesture (an up swipe inside SkyView would re-trigger the farm
    // gesture model). Down only keeps the mental model: up = open sky,
    // down = back to farm.
    if (end - start >= SWIPE_DISMISS_PX) {
      onClose();
      return;
    }
    if (!tapMoved.current && Date.now() - touchStartT.current < LONG_PRESS_MS) {
      // Treat as a tap → cycle the message.
      setMessageIdx((n) => n + 1);
    }
  };

  // Pointer events (mouse / desktop) — simpler: backdrop click cycles
  // message; close button stays.
  const onBackdropClick: React.MouseEventHandler = () => {
    setMessageIdx((n) => n + 1);
  };

  // PR-16 — desktop mouse wheel: cumulative downward scroll closes.
  const wheelAcc = useRef(0);
  const wheelResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SKY_WHEEL_THRESHOLD = 60;
  const onSkyWheel: React.WheelEventHandler = (e) => {
    wheelAcc.current += e.deltaY;
    if (wheelResetTimer.current) clearTimeout(wheelResetTimer.current);
    wheelResetTimer.current = setTimeout(() => {
      wheelAcc.current = 0;
    }, 250);
    if (wheelAcc.current >= SKY_WHEEL_THRESHOLD) {
      wheelAcc.current = 0;
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="sky-view"
          role="dialog"
          aria-modal="true"
          aria-label="하늘 보기"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onSkyWheel}
          onClick={onBackdropClick}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: tint,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            cursor: "pointer",
          }}
        >
          <img
            src={img}
            alt=""
            onLoad={() => setImgLoaded(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "opacity 0.6s ease",
              opacity: imgLoaded ? 1 : 0,
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.18) 100%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.9,
            }}
          >
            {/* PR-15: suppress the always-on cloud parallax so the
                sky's stars / moon / shooting-star aren't fogged.
                Weather particles (rain/snow/cherry/autumn) still play. */}
            <Atmosphere variant={variant} noClouds />
          </div>

          {/* Long-press sparkle burst */}
          <AnimatePresence>
            {Array.from({ length: 8 }, (_, i) => `${longPressFx}-${i}`).map(
              (key, i) =>
                longPressFx > 0 && (
                  <motion.span
                    key={key}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                    animate={{
                      opacity: [0, 1, 0],
                      x: Math.cos((i / 8) * Math.PI * 2) * 80,
                      y: Math.sin((i / 8) * Math.PI * 2) * 80,
                      scale: [0.4, 1, 0.6],
                    }}
                    transition={{ duration: 0.8, delay: i * 0.03 }}
                    style={{
                      position: "absolute",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "rgba(255,247,220,0.95)",
                      boxShadow: "0 0 8px rgba(255,247,220,0.7)",
                      pointerEvents: "none",
                    }}
                  />
                ),
            )}
          </AnimatePresence>

          {/* Cozy message */}
          <motion.p
            key={messageIdx}
            data-testid="sky-message"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: "relative",
              maxWidth: "calc(100% - 48px)",
              margin: 0,
              padding: "0 8px",
              color: "#FFF7EC",
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.45,
              textAlign: "center",
              textShadow:
                "0 1px 3px rgba(0,0,0,0.55), 0 0 8px rgba(0,0,0,0.35)",
              WebkitTextStroke: "2px rgba(43,24,16,0.55)",
              paintOrder: "stroke fill",
              pointerEvents: "none",
              letterSpacing: "0.01em",
            }}
          >
            {message}
          </motion.p>

          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: "calc(env(safe-area-inset-bottom) + 24px)",
              color: "rgba(255,247,236,0.85)",
              fontSize: 12,
              textShadow: "0 1px 2px rgba(0,0,0,0.4)",
              pointerEvents: "none",
            }}
          >
            탭하면 다음 한 줄 · 길게 누르면 반짝 · 위/아래로 쓸면 닫혀요
          </span>

          {/* Special-event banner */}
          {eventImg && (
            <span
              aria-hidden
              data-testid="sky-event-banner"
              style={{
                position: "absolute",
                top: "calc(env(safe-area-inset-top) + 16px)",
                left: "50%",
                transform: "translateX(-50%)",
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.32)",
                color: "#FFF7EC",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                pointerEvents: "none",
                textShadow: "0 1px 2px rgba(0,0,0,0.4)",
              }}
            >
              {eventImg === SKY_SHOOTING ? "✨ 별똥별" : "🌈 무지개"}
            </span>
          )}

          <button
            type="button"
            data-testid="sky-close"
            aria-label="하늘 닫기"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top) + 16px)",
              right: 16,
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: 999,
              background: "rgba(0,0,0,0.28)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#FFF7EC",
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
