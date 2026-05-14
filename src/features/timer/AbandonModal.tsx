/**
 * 포기 확인 모달 — Phase 7.7.
 *
 * - bunny_cry 240×240 중앙
 * - 눈물방울 SVG 2개 반복
 * - Title "진짜 포기할거야?" 24/800
 * - Body "토끼가 울어버린다고 😢"
 * - Primary "계속할게", destructive ghost "미안해..."
 */

import { motion } from "framer-motion";
import { Bunny } from "../../components/Bunny";
import { BottomSheet, Button } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";

interface AbandonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function TearDrops() {
  return (
    <>
      {[
        { x: -26, delay: 0 },
        { x: 26, delay: 0.4 },
      ].map((d, i) => (
        <motion.svg
          key={i}
          aria-hidden
          width={14}
          height={20}
          viewBox="0 0 14 20"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 180, opacity: [0, 1, 1, 0] }}
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
            top: 80,
            pointerEvents: "none",
          }}
        >
          <path
            d="M7 0 C 7 0, 0 10, 0 14 a 7 7 0 0 0 14 0 c 0 -4 -7 -14 -7 -14 z"
            fill="url(#teargradAbandon)"
          />
          <defs>
            <linearGradient id="teargradAbandon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(150, 220, 255, 0.95)" />
              <stop offset="100%" stopColor="rgba(80, 160, 240, 0.85)" />
            </linearGradient>
          </defs>
        </motion.svg>
      ))}
    </>
  );
}

export function AbandonModal({ open, onClose, onConfirm }: AbandonModalProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="진짜 포기할거야?">
      <div style={{ textAlign: "center", padding: "4px 0 12px" }}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          style={{ display: "inline-block", position: "relative" }}
        >
          <Bunny
            variant="cry"
            size={240}
            frame="circle"
            breathe={false}
            alt="울먹이는 토끼"
          />
          <TearDrops />
        </motion.div>
        <p
          style={{
            marginTop: 14,
            marginBottom: 6,
            color: "var(--text-primary)",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          진짜 포기할거야?
        </p>
        <p
          className="t-body"
          style={{ marginTop: 0, marginBottom: 18, color: "var(--text-secondary)" }}
        >
          토끼가 울어버린다고 😢
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button
            variant="primary"
            fullWidth
            size="md"
            onClick={() => {
              haptic("light");
              onClose();
            }}
            data-testid="button-abandon-cancel"
          >
            계속할게
          </Button>
          <Button
            variant="ghost"
            fullWidth
            size="sm"
            onClick={() => {
              haptic("warning");
              onConfirm();
            }}
            style={{ color: "var(--accent-devil)" }}
            data-testid="button-abandon-confirm"
          >
            미안해...
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
