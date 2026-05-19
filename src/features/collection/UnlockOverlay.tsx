/**
 * Phase 5 — 신규 캐릭터 획득 오버레이.
 *
 * - 풀스크린 dimmed bg + center card flip
 * - 컨페티 / 골드 글로우 / NEW! badge
 * - legendary 는 conic-gradient hologram 강화
 * - 여러 개 unlock 시 queue 로 순차 표시
 * - haptic heavy (legendary 는 success 두 번)
 *
 * reduced motion: flip/confetti 최소, 텍스트만 페이드.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bunny } from "../../components/Bunny";
import { Button } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";
import { useTossBackButton } from "../../lib/tossBackButton";
import {
  CHARACTER_BY_ID,
  RARITY_COLOR,
  RARITY_LABEL,
  type CharacterDef,
  type Rarity,
} from "./collectionData";

interface UnlockOverlayProps {
  /** unlock 된 캐릭터 id queue. 순차 표시. */
  queue: string[];
  onClose: () => void;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function UnlockOverlay({ queue, onClose }: UnlockOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const reduced = useMemo(prefersReducedMotion, []);

  useEffect(() => setMounted(true), []);

  // queue 가 바뀌면 index 0 부터 다시.
  useEffect(() => {
    setIndex(0);
  }, [queue]);

  const isLast = index >= queue.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  };

  // R35 — 토스/하드웨어 back 시 다음 unlock 으로 진행 (마지막이면 닫기).
  // 다중 unlock queue 의 "탭하면 다음" 동작과 일치.
  useTossBackButton(handleNext, mounted && queue.length > 0);

  if (!mounted || typeof document === "undefined") return null;
  if (queue.length === 0) return null;

  const currentId = queue[index];
  const character = currentId ? CHARACTER_BY_ID[currentId] : null;

  return createPortal(
    <AnimatePresence mode="wait">
      {character && (
        <UnlockCardScreen
          key={character.id}
          character={character}
          reduced={reduced}
          isLast={isLast}
          remaining={queue.length - index - 1}
          onNext={handleNext}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface ScreenProps {
  character: CharacterDef;
  reduced: boolean;
  isLast: boolean;
  remaining: number;
  onNext: () => void;
}

function UnlockCardScreen({ character, reduced, isLast, remaining, onNext }: ScreenProps) {
  // mount 시 haptic
  useEffect(() => {
    if (character.rarity === "legendary") {
      haptic("success");
      window.setTimeout(() => haptic("heavy"), 400);
    } else if (character.rarity === "ssr" || character.rarity === "sr") {
      haptic("heavy");
    } else {
      haptic("medium");
    }
  }, [character]);

  // 컨페티 — common 은 6개, rare 는 14개, sr/ssr/legendary 는 22개
  const piecesCount = reduced
    ? 0
    : character.rarity === "legendary"
      ? 28
      : character.rarity === "ssr" || character.rarity === "sr"
        ? 22
        : character.rarity === "rare"
          ? 14
          : 8;

  const pieces = useMemo(
    () =>
      Array.from({ length: piecesCount }).map((_, i) => ({
        id: i,
        angle: (i / Math.max(piecesCount, 1)) * 360 + (Math.random() * 30 - 15),
        distance: 160 + Math.random() * 140,
        color: pickColor(character.rarity, i),
        delay: Math.random() * 0.22,
        size: 6 + Math.random() * 10,
      })),
    [piecesCount, character.rarity],
  );

  const isLegendary = character.rarity === "legendary";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
      role="alertdialog"
      aria-label={`신규 캐릭터 획득: ${character.name}`}
      data-testid="overlay-unlock"
      style={overlayStyle()}
    >
      {/* 골드 라디얼 플래시 */}
      {!reduced && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0.95, scale: 0.6 }}
          animate={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 1.0, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            background: isLegendary
              ? "radial-gradient(45% 45% at 50% 45%, rgba(255,215,90,0.95), rgba(212,160,23,0.4) 50%, transparent 80%)"
              : "radial-gradient(40% 40% at 50% 45%, rgba(255,200,90,0.9), rgba(255,107,53,0.25) 60%, transparent 80%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 컨페티 */}
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
            rotate: 480,
          }}
          transition={{ duration: 1.4, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            left: "50%",
            top: "42%",
            width: p.size,
            height: p.size * 0.4,
            borderRadius: 2,
            background: p.color,
            boxShadow: `0 0 10px ${p.color}`,
          }}
        />
      ))}

      {/* center card with flip */}
      <motion.div
        initial={{ scale: 0.65, opacity: 0, rotateY: reduced ? 0 : -180 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={
          reduced
            ? { duration: 0.25 }
            : {
                rotateY: { duration: 0.7, ease: [0.32, 0.72, 0, 1] },
                scale: { type: "spring", stiffness: 280, damping: 20 },
                opacity: { duration: 0.32 },
              }
        }
        style={cardStyle(character.rarity)}
        data-testid={`unlock-card-${character.id}`}
      >
        {/* hologram overlay (legendary) */}
        {isLegendary && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 28,
              background:
                "conic-gradient(from 0deg at 50% 50%, rgba(255,215,90,0.25), rgba(180,130,255,0.25), rgba(255,150,200,0.22), rgba(120,200,255,0.22), rgba(255,215,90,0.25))",
              animation: "legendary-spin 6s linear infinite",
              mixBlendMode: "overlay",
              pointerEvents: "none",
            }}
          />
        )}

        {/* NEW! badge */}
        <motion.span
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: -8 }}
          transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.5 }}
          aria-hidden
          style={{
            position: "absolute",
            top: -10,
            left: -10,
            zIndex: 4,
            background: isLegendary
              ? "linear-gradient(135deg, #FFD256 0%, #FF9544 50%, #C73E1D 100%)"
              : "var(--accent-carrot)",
            color: "#fff",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: 1,
            padding: "6px 14px",
            borderRadius: 14,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
        >
          NEW!
        </motion.span>

        {/* rarity chip */}
        <span
          className="t-micro"
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 999,
            background: `color-mix(in oklab, ${RARITY_COLOR[character.rarity]} 20%, transparent)`,
            color: RARITY_COLOR[character.rarity],
            border: `1px solid ${RARITY_COLOR[character.rarity]}66`,
            fontWeight: 800,
            letterSpacing: 0.4,
            position: "relative",
            zIndex: 3,
          }}
        >
          {RARITY_LABEL[character.rarity].toUpperCase()}
        </span>

        <div
          style={{
            position: "relative",
            zIndex: 3,
            margin: "16px 0 8px",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              filter: isLegendary
                ? "drop-shadow(0 0 22px rgba(255,200,90,0.7))"
                : "drop-shadow(0 0 14px rgba(255,153,75,0.45))",
            }}
          >
            <Bunny
              variant={character.bunnyKey}
              size={170}
              frame="rounded"
              breathe
              alt={character.name}
              glow={isLegendary}
            />
          </div>
        </div>

        <h2
          className="t-display"
          style={{
            margin: "8px 0 4px",
            color: "var(--text-primary)",
            position: "relative",
            zIndex: 3,
          }}
          data-testid="unlock-name"
        >
          {character.name}
        </h2>
        <p
          className="t-caption"
          style={{
            margin: 0,
            color: "var(--text-tertiary)",
            position: "relative",
            zIndex: 3,
          }}
        >
          {character.unlockHint}
        </p>
        <p
          className="t-body"
          style={{
            marginTop: 14,
            marginBottom: 0,
            padding: 12,
            borderRadius: 14,
            background: "var(--bg-sunken)",
            color: "var(--text-primary)",
            fontStyle: "italic",
            fontWeight: 600,
            position: "relative",
            zIndex: 3,
          }}
        >
          “{character.quotes[0]}”
        </p>

        <Button
          variant="primary"
          fullWidth
          size="md"
          style={{ marginTop: 18, position: "relative", zIndex: 3 }}
          onClick={onNext}
          data-testid="button-unlock-next"
        >
          {isLast ? "도감에 새겨두기" : `다음 (${remaining} 더 있어!)`}
        </Button>
      </motion.div>
    </motion.div>
  );
}

/* ----------------------- helpers ----------------------- */

function overlayStyle(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 500,
    background: "rgba(15, 12, 8, 0.72)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  };
}

function cardStyle(rarity: Rarity): React.CSSProperties {
  const ringColor = RARITY_COLOR[rarity];
  return {
    position: "relative",
    background: "var(--bg-elevated)",
    borderRadius: 28,
    padding: "22px 22px 20px",
    width: "min(360px, 100%)",
    boxShadow: `0 32px 80px rgba(0,0,0,0.45), 0 0 0 2px ${ringColor}55, 0 0 40px ${ringColor}40`,
    border: `1px solid ${ringColor}55`,
    textAlign: "center",
    overflow: "hidden",
    transformStyle: "preserve-3d",
    perspective: 1000,
  };
}

function pickColor(rarity: Rarity, i: number): string {
  const palettes: Record<Rarity, string[]> = {
    common: ["#FF994B", "#FFC857", "#7BD389"],
    rare: ["#5EC2D8", "#4F9CFF", "#FFC857", "#A78BFA"],
    sr: ["#B46CFF", "#FFC857", "#FF6BB6", "#A78BFA"],
    ssr: ["#FF89C9", "#FFC857", "#A78BFA", "#FF6B35"],
    legendary: ["#FFD256", "#D4A017", "#FF6B35", "#FFC857", "#B46CFF"],
  };
  const p = palettes[rarity];
  return p[i % p.length];
}
