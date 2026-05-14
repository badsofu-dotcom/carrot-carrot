/**
 * 세션 종료 오버레이 — Phase 7.7 재설계.
 *
 * 성공:
 *   - fullscreen overlay, 사용자 명시적 dismiss (자동 dismiss 없음).
 *   - bunny_success 280×280 중앙.
 *   - 상단 "흐흐 잘했어!" Display 28/900.
 *   - 하단 "당근 +1" floating/countup.
 *   - orange/gold CSS confetti 20개, 2초 후 fade.
 *   - Primary "한 판 더", Ghost "쉬었다 갈게".
 *
 * 실패:
 *   - bunny_cry 240, 눈물방울 SVG 2개 반복.
 *   - "흐ㅣㅣ..." + 위로 멘트.
 *   - Secondary "다시 해볼게".
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bunny } from "../../components/Bunny";
import { Button } from "../../design-system/ui";

interface SessionOverlayProps {
  /** "complete" | "abandon" | null. null 이면 닫힘. */
  kind: "complete" | "abandon" | null;
  onClose: () => void;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function SessionOverlay({ kind, onClose }: SessionOverlayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduced = useMemo(prefersReducedMotion, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {kind === "complete" && (
        <SuccessOverlay key="success" reduced={reduced} onClose={onClose} />
      )}
      {kind === "abandon" && (
        <FailureOverlay key="failure" reduced={reduced} onClose={onClose} />
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ------------------------ Success ------------------------ */

function SuccessOverlay({
  reduced,
  onClose,
}: {
  reduced: boolean;
  onClose: () => void;
}) {
  // 컨페티 — 20 조각 (Phase 7.7 명시), 2s 후 fade.
  const pieces = useMemo(
    () =>
      Array.from({ length: reduced ? 0 : 20 }).map((_, i) => ({
        id: i,
        angle: (i / 20) * 360 + (Math.random() * 24 - 12),
        distance: 140 + Math.random() * 130,
        color: pickColor(i),
        delay: Math.random() * 0.18,
        size: 6 + Math.random() * 8,
      })),
    [reduced],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
      role="alertdialog"
      aria-label="집중 성공"
      data-testid="overlay-success"
      style={overlayStyle()}
    >
      {/* fullscreen flash — 부드럽게 */}
      {!reduced && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(40% 40% at 50% 45%, rgba(255,200,90,0.95), rgba(255,107,53,0.25) 60%, transparent 80%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* confetti — 2s fade */}
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          aria-hidden
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.6, rotate: 0 }}
          animate={{
            x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            opacity: 0,
            scale: 1,
            rotate: 360,
          }}
          transition={{ duration: 2.0, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            left: "50%",
            top: "44%",
            width: p.size,
            height: p.size * 0.4,
            borderRadius: 2,
            background: p.color,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}

      {/* center card */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        style={cardStyle()}
        data-testid="overlay-success-card"
      >
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
          }}
        >
          흐흐 잘했어!
        </h2>
        <motion.div
          initial={{ scale: 0.4, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 14, delay: 0.1 }}
          style={{ display: "inline-block" }}
        >
          <Bunny
            variant="success"
            size={280}
            frame="circle"
            breathe={false}
            alt="성공한 토끼"
            glow
          />
        </motion.div>

        {/* +1 floating */}
        <motion.div
          initial={{ y: 0, opacity: 0, scale: 0.8 }}
          animate={{ y: -16, opacity: [0, 1, 1, 1], scale: 1 }}
          transition={{ duration: 0.8, delay: 0.25, ease: "easeOut" }}
          style={{
            marginTop: 12,
            color: "var(--accent-carrot)",
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: "-0.02em",
          }}
        >
          당근 +1
        </motion.div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 22,
          }}
        >
          <Button
            variant="primary"
            fullWidth
            size="md"
            onClick={onClose}
            data-testid="button-overlay-success-close"
          >
            한 판 더
          </Button>
          <Button
            variant="ghost"
            fullWidth
            size="sm"
            onClick={onClose}
            data-testid="button-overlay-success-rest"
          >
            쉬었다 갈게
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------ Failure ------------------------ */

function FailureOverlay({
  reduced,
  onClose,
}: {
  reduced: boolean;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      role="alertdialog"
      aria-label="집중 포기"
      data-testid="overlay-failure"
      style={overlayStyle("rgba(15, 12, 8, 0.62)")}
    >
      <motion.div
        animate={reduced ? undefined : { x: [0, -8, 8, -6, 6, -3, 3, 0] }}
        transition={{ duration: 0.6 }}
        style={cardStyle()}
      >
        <div style={{ position: "relative", display: "inline-block" }}>
          <Bunny
            variant="cry"
            size={240}
            frame="circle"
            breathe={false}
            alt="우는 토끼"
          />
          {/* tear drops — 2개 SVG 반복 */}
          {!reduced && <TearDrops />}
        </div>
        <h2
          style={{
            margin: "12px 0 4px",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          흐ㅣㅣ...
        </h2>
        <p
          className="t-body"
          style={{ margin: 0, color: "var(--text-secondary)" }}
        >
          괜찮아, 다음 판은 잡을 수 있어.
        </p>
        <Button
          variant="secondary"
          fullWidth
          size="md"
          style={{ marginTop: 18 }}
          onClick={onClose}
          data-testid="button-overlay-failure-close"
        >
          다시 해볼게
        </Button>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------ helpers ------------------------ */

function TearDrops() {
  return (
    <>
      {[
        { x: -28, delay: 0 },
        { x: 28, delay: 0.4 },
      ].map((d, i) => (
        <motion.svg
          key={i}
          aria-hidden
          width={14}
          height={20}
          viewBox="0 0 14 20"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 200, opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 1.6,
            delay: d.delay,
            repeat: Infinity,
            repeatDelay: 0.4,
            ease: "easeIn",
          }}
          style={{
            position: "absolute",
            left: `calc(50% + ${d.x}px)`,
            top: 70,
            pointerEvents: "none",
          }}
        >
          <path
            d="M7 0 C 7 0, 0 10, 0 14 a 7 7 0 0 0 14 0 c 0 -4 -7 -14 -7 -14 z"
            fill="url(#teargrad)"
          />
          <defs>
            <linearGradient id="teargrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(150, 220, 255, 0.95)" />
              <stop offset="100%" stopColor="rgba(80, 160, 240, 0.85)" />
            </linearGradient>
          </defs>
        </motion.svg>
      ))}
    </>
  );
}

function overlayStyle(bg = "rgba(15, 12, 8, 0.5)"): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 400,
    background: bg,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };
}

function cardStyle(): React.CSSProperties {
  return {
    position: "relative",
    background: "var(--bg-elevated)",
    borderRadius: 28,
    padding: "24px 24px 20px",
    width: "min(360px, 100%)",
    boxShadow: "var(--shadow-lg)",
    border: "1px solid var(--border-subtle)",
    textAlign: "center",
  };
}

function pickColor(i: number): string {
  // orange / gold 위주
  const palette = [
    "#FF6B35",
    "#FF994B",
    "#FFC857",
    "#FFD86B",
    "#F39237",
    "#E8AF34",
  ];
  return palette[i % palette.length];
}
