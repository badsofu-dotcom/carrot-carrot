/**
 * VisitorBunny — short visitor-of-the-day pop on the farm card.
 *
 * Design constraints (CLAUDE.md):
 *   - "No idle bunny on the farm outside the visitor 6-second pop."
 *     So this sprite is mounted only when `visitor` is non-null AND
 *     we haven't yet waved today. Auto-dismiss after 6 s if the user
 *     ignores it.
 *   - Reuses the existing transparent bunny set under
 *     `src/assets/characters/` — no new art.
 *   - Bottom-left of the farm card, above the ToolDock but offset so
 *     they never overlap (measured at 390×844 baseline).
 *
 * Tap behavior:
 *   - Wave → POST /friends/wave via friendsStore. On `ok`, a small
 *     heart-pop animation flashes and the sprite exits.
 *   - Already-waved (race condition or store cache): toast + exit.
 *   - Network failure: toast the friendly error, leave the sprite up
 *     so the user can retry.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bunny } from "../Bunny";
import { useFriendsStore } from "../../features/collection/friendsStore";
import { CHARACTER_BY_ID } from "../../features/collection/collectionData";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";

const AUTO_DISMISS_MS = 6_000;

interface Props {
  /** When false, the sprite is unmounted regardless of visitor state. */
  visible: boolean;
}

export function VisitorBunny({ visible }: Props) {
  const visitor = useFriendsStore((s) => s.visitor);
  const wave = useFriendsStore((s) => s.wave);
  const [dismissed, setDismissed] = useState(false);
  const [heartPop, setHeartPop] = useState(false);

  const shouldShow =
    visible &&
    !dismissed &&
    visitor !== null &&
    !visitor.waved;

  useEffect(() => {
    if (!shouldShow) return;
    const timer = window.setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [shouldShow]);

  if (!visitor) return null;

  const character = CHARACTER_BY_ID[visitor.bunnyId];
  const bunnyKey = character?.bunnyKey;
  // If the server picked an id the client doesn't render, fall back to
  // a safe default so the sprite still appears.
  const safeBunnyKey = bunnyKey ?? "idle";

  const handleTap = async () => {
    haptic("medium");
    const r = await wave();
    if (r.ok) {
      setHeartPop(true);
      toast(`🩷 ${character?.name ?? "이웃 토끼"}가 하트를 두고 갔어요`);
      // Hide the sprite shortly after the heart-pop animation completes.
      window.setTimeout(() => setDismissed(true), 900);
    } else if (r.reason === "already_waved") {
      toast("오늘은 이미 인사했어요");
      setDismissed(true);
    } else {
      toast("이웃 토끼가 잠시 다른 길로 갔어요 — 다시 한 번");
    }
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.button
          type="button"
          onClick={handleTap}
          initial={{ opacity: 0, y: 24, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          aria-label={`오늘의 이웃 — ${character?.name ?? visitor.bunnyId}, 탭하면 하트가 떨어져요`}
          data-testid="visitor-bunny"
          style={{
            position: "absolute",
            left: 14,
            bottom: 92,
            zIndex: 12,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          {/* Speech bubble */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.25 }}
            style={{
              position: "absolute",
              left: 64,
              top: -8,
              background: "#FFF8EE",
              color: "#3a2a18",
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 14,
              boxShadow: "0 4px 10px rgba(0,0,0,0.16)",
              whiteSpace: "nowrap",
            }}
          >
            🐰 오늘 놀러왔어!
          </motion.div>
          <Bunny variant={safeBunnyKey} size={64} frame="rounded" breathe alt="" />
          {/* Heart pop fx */}
          <AnimatePresence>
            {heartPop && (
              <motion.span
                aria-hidden
                initial={{ opacity: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: [0, 1, 0], y: -42, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  left: 22,
                  top: 8,
                  fontSize: 28,
                  pointerEvents: "none",
                }}
              >
                🩷
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
