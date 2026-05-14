/**
 * BunnyGachaModal — celebratory unlock screen.
 *
 * Mounted from FarmHub's harvest branch when the rare 0.5% bunny roll
 * succeeds (or from the legendary-star purchase). Closes on tap.
 *
 * Render uses the existing `CHARACTERS` / `SLOTS` data so the
 * unlock visually matches the dogam grid. fx_level_up_ring +
 * emotion_love asset pieces overlay the bunny portrait for a quick
 * pop.
 */
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CHARACTERS,
  SLOTS,
  RARITY_COLOR,
  RARITY_LABEL,
  type CharacterDef,
} from "../../features/collection/collectionData";

const BASE = import.meta.env.BASE_URL;
const FX_RING = `${BASE}assets/farm/fx/fx_level_up_ring.png`;
const FX_LOVE = `${BASE}assets/farm/fx/emotion_love.png`;

interface Props {
  open: boolean;
  bunnyId: string | null;
  onClose: () => void;
}

export function BunnyGachaModal({ open, bunnyId, onClose }: Props) {
  const bunny = bunnyId ? findBunny(bunnyId) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && bunny && (
        <motion.div
          data-testid="bunny-gacha-modal"
          role="dialog"
          aria-modal="true"
          aria-label="새로운 토끼"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {/* Level-up ring backdrop */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.9, 0.6], scale: [0.6, 1.4, 1.8] }}
            transition={{ duration: 1, times: [0, 0.4, 1] }}
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              backgroundImage: `url(${FX_RING})`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              pointerEvents: "none",
            }}
          />
          {/* Card */}
          <motion.div
            initial={{ y: 20, scale: 0.9 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            style={{
              position: "relative",
              background: "#FFF8EE",
              borderRadius: 24,
              padding: "20px 24px",
              width: "min(320px, 80vw)",
              textAlign: "center",
              boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                color: RARITY_COLOR[bunny.rarity],
                letterSpacing: "0.04em",
              }}
            >
              새로운 토끼 — {RARITY_LABEL[bunny.rarity]}
            </p>
            <h2
              style={{
                margin: "6px 0 12px",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {bunny.name}
            </h2>
            <div
              style={{
                position: "relative",
                width: 140,
                height: 140,
                margin: "0 auto 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={bunny.imageSrc}
                alt=""
                width={140}
                height={140}
                style={{ objectFit: "contain" }}
              />
              <img
                aria-hidden
                src={FX_LOVE}
                alt=""
                width={36}
                height={36}
                style={{
                  position: "absolute",
                  top: 4,
                  right: -4,
                  opacity: 0.9,
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                }}
              />
            </div>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                lineHeight: 1.5,
                color: "#555",
              }}
            >
              {bunny.bio ?? "도감에 새로운 토끼가 추가되었어요."}
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 12,
                border: "none",
                background: "#FF7B61",
                color: "#fff",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              도감에 담기
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function findBunny(id: string): CharacterDef | null {
  const direct = CHARACTERS.find((c) => c.id === id);
  if (direct) return direct;
  for (const s of SLOTS) {
    if (s.character?.id === id) return s.character;
  }
  return null;
}
