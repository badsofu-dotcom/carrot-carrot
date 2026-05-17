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
import {
  CHARACTER_BY_ID,
  type Rarity,
} from "../../features/collection/collectionData";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { playSfx } from "../../lib/soundFx";
import { useSoundStore } from "../../store/soundStore";

// PR-128 — rarity-specific entrance copy + glow tier.
const RARITY_GREETING: Record<Rarity, string> = {
  common: "🐰 안녕! 놀러왔어",
  rare: "🐰 오! 너 집중 잘하네!",
  sr: "✨ 엄청난 손님이 왔어!",
  ssr: "✨ SSR 손님이 왔어!",
  legendary: "🌟 전설의 손님이 강림했다!",
};

// CSS box-shadow per rarity. common = none, others get a soft glow that
// matches the rarity token color so the visitor "feels" rare without
// shouting. legendary gets a stronger, slightly animated pulse via the
// `--visitor-pulse` animation in base.css (added in this PR).
function rarityGlow(r: Rarity | undefined): string {
  switch (r) {
    case "legendary":
      return "0 0 0 2px rgba(255,200,80,0.85), 0 0 18px 4px rgba(255,180,60,0.6)";
    case "ssr":
      return "0 0 0 2px rgba(255,120,200,0.75), 0 0 14px 3px rgba(255,120,200,0.45)";
    case "sr":
      return "0 0 0 2px rgba(140,90,255,0.7), 0 0 12px 2px rgba(140,90,255,0.4)";
    case "rare":
      return "0 0 0 2px rgba(80,160,255,0.6), 0 0 10px 2px rgba(80,160,255,0.3)";
    default:
      return "none";
  }
}

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
    // PR-13: visitor entrance SFX. Read sfxMuted/sfxVolume directly from
    // the store so we don't subscribe just for this side-effect.
    const s = useSoundStore.getState();
    playSfx("bunny", { muted: s.sfxMuted, masterVolume: s.sfxVolume });
    const timer = window.setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [shouldShow]);

  if (!visitor) return null;

  const character = CHARACTER_BY_ID[visitor.bunnyId];
  const bunnyKey = character?.bunnyKey;
  // If the server picked an id the client doesn't render, fall back to
  // a safe default so the sprite still appears.
  const safeBunnyKey = bunnyKey ?? "idle";
  const rarity: Rarity = character?.rarity ?? "common";
  const greeting = RARITY_GREETING[rarity];
  const glow = rarityGlow(rarity);
  const isHighTier = rarity === "sr" || rarity === "ssr" || rarity === "legendary";

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
            {greeting}
          </motion.div>
          <div
            style={{
              // Round 17.5 — transparent cutouts render with their own
              // alpha. Drop the rounded-rect chip background; keep glow
              // as a soft halo behind the silhouette.
              borderRadius: "50%",
              boxShadow: glow,
              animation: isHighTier
                ? "visitor-pulse 2.4s ease-in-out infinite"
                : undefined,
            }}
          >
            <Bunny
              variant={safeBunnyKey}
              size={80}
              frame="none"
              breathe
              transparent
              alt=""
            />
          </div>
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
