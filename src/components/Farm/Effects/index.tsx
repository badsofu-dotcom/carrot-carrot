/**
 * One-shot farm effects.
 *
 * Rendered as absolutely-positioned HTML inside the farm card, NOT
 * inside the SVG. The SVG uses `preserveAspectRatio="none"` so anything
 * drawn in viewBox coordinates inherits the card's aspect stretch —
 * which is exactly what makes circles look like ovals and PNGs look
 * elongated. Positioning these via plain CSS `left: X%; top: Y%`
 * inside the same farm-stage wrapper resolves to identical logical
 * points (the wrapper IS aspect-locked at 1536:2752 internally) while
 * each effect itself renders at its natural ratio.
 *
 * Coordinates: `cx` / `cy` are still 0..100 (matching `polygonBounds`),
 * mapped to CSS percent so callers don't have to know the change.
 *
 * Effects:
 *   - dirt_burst   — 8 small earth-toned particles spreading outward.
 *                    NO ring. Pure CSS dots.
 *   - water_splash — PNG asset (kept square via aspect-ratio: 1/1).
 *   - harvest_pop  — PNG asset.
 *   - sparkle      — PNG asset, 1s.
 *   - perfect_combo — fullscreen confetti flash, 0.8s.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL;
const FX_SPARKLE = `${BASE}assets/farm/fx/fx_sparkle.png`;
const FX_WATER = `${BASE}assets/farm/fx/fx_water_splash.png`;
// FX_HARVEST (fx_harvest_pop.png) intentionally removed — the PNG
// rendered as a tall vertical halo against the farm card aspect, so
// `HarvestPop` below replaces it with a CSS/SVG particle burst that
// reads as a compact carrot pop and stays square no matter what.
const FX_CONFETTI = `${BASE}assets/farm/fx/fx_confetti.png`;

export type FxKind =
  | "dirt_burst"
  | "water_splash"
  | "harvest_pop"
  | "sparkle"
  | "perfect_combo";

export interface FxEvent {
  id: number;
  kind: FxKind;
  /** Percent in the 0..100 polygon coordinate space. */
  cx: number;
  cy: number;
}

export function FxLayer({ events }: { events: FxEvent[] }) {
  return (
    <div
      data-testid="fx-layer"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 3,
      }}
    >
      <AnimatePresence>
        {events.map((e) => (
          <Fx key={e.id} ev={e} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Fx({ ev }: { ev: FxEvent }) {
  switch (ev.kind) {
    case "water_splash":
      return <PngBurst src={FX_WATER} cx={ev.cx} cy={ev.cy} sizePx={56} ms={500} />;
    case "harvest_pop":
      return <HarvestPop cx={ev.cx} cy={ev.cy} />;
    case "sparkle":
      return <PngBurst src={FX_SPARKLE} cx={ev.cx} cy={ev.cy} sizePx={52} ms={1000} />;
    case "perfect_combo":
      return <PerfectCombo />;
    case "dirt_burst":
    default:
      return <DirtBurst cx={ev.cx} cy={ev.cy} />;
  }
}

/**
 * Square PNG one-shot. The wrapper is `aspect-ratio: 1/1; width: NN px`
 * so the image always stays proportional — never stretched by the card
 * shape. Scales 0.6 → 1.2 → 1, fades.
 */
function PngBurst({
  src,
  cx,
  cy,
  sizePx,
  ms,
}: {
  src: string;
  cx: number;
  cy: number;
  sizePx: number;
  ms: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.2, 1, 1] }}
      transition={{ duration: ms / 1000, times: [0, 0.2, 0.6, 1] }}
      style={{
        position: "absolute",
        left: `${cx}%`,
        top: `${cy}%`,
        width: sizePx,
        height: sizePx,
        marginLeft: -sizePx / 2,
        marginTop: -sizePx / 2,
        backgroundImage: `url(${src})`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        // aspect-ratio is implicit via width == height; this comment is
        // just to flag the invariant for future tweaks.
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Particle-only dirt burst — 8 small earth-toned dots radiating outward
 * from the plot center. No ring (the previous SVG <circle> rendered as
 * an oval inside the aspect-stretched viewBox). Each particle is
 * absolutely positioned with the same `left: X%; top: Y%` anchor and
 * animates its own `x` / `y` via framer-motion. Stays inside ~60px so
 * it never spills into neighbouring plots.
 */
function DirtBurst({ cx, cy }: { cx: number; cy: number }) {
  const N = 8;
  const RADIUS_PX = 26;
  const SIZE_PX = 5;
  return (
    <>
      {Array.from({ length: N }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / N + Math.PI / N;
        const dx = Math.cos(angle) * RADIUS_PX;
        // Bias upward slightly so dirt "kicks" up before falling.
        const dy = Math.sin(angle) * RADIUS_PX * 0.55 - 4;
        const delay = (i % 3) * 0.04;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0.95, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: [0.95, 0.95, 0], x: [0, dx], y: [0, dy], scale: [1, 0.7] }}
            transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.5, 1] }}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              width: SIZE_PX,
              height: SIZE_PX,
              marginLeft: -SIZE_PX / 2,
              marginTop: -SIZE_PX / 2,
              borderRadius: "50%",
              background:
                i % 2 === 0
                  ? "rgba(101, 67, 33, 0.92)"
                  : "rgba(140, 95, 55, 0.92)",
              boxShadow: "0 1px 1px rgba(0,0,0,0.18)",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
}

/**
 * HarvestPop — CSS/SVG particle burst centred on the harvested plot.
 *
 * Composition (all sized in CSS px, never SVG units, so the farm-card
 * aspect can't stretch the result):
 *   - **Center pop**: a small carrot-orange ring scales 0.4 → 1.05 → 0
 *     in 0.5 s. Reads as a soft "thud" at the harvest point.
 *   - **Carrot wedges** (3 of them): tiny orange teardrops with a
 *     green tip. Each launches at a different angle, rotates, falls
 *     slightly under gravity. ~26 px throw.
 *   - **Leaf flecks** (4 of them): small green commas, lower opacity,
 *     drift wider than the wedges.
 *   - **Sparkle dots** (4 of them): cream highlights that fade out
 *     fastest. Adds a little sparkle without a PNG asset.
 *
 * Total: 12 particles + 1 ring, ~500 ms. Pure framer-motion. Lightweight
 * and cheap on Apps-in-Toss WebView.
 */
function HarvestPop({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      {/* Center ring */}
      <motion.span
        aria-hidden
        initial={{ opacity: 0.8, scale: 0.4 }}
        animate={{ opacity: [0.8, 0.7, 0], scale: [0.4, 1.05, 1.1] }}
        transition={{ duration: 0.5, ease: [0.2, 0.7, 0.5, 1] }}
        style={{
          position: "absolute",
          left: `${cx}%`,
          top: `${cy}%`,
          width: 28,
          height: 28,
          marginLeft: -14,
          marginTop: -14,
          borderRadius: "50%",
          border: "2px solid rgba(255,123,40,0.85)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.45) inset, 0 2px 6px rgba(255,123,40,0.25)",
          pointerEvents: "none",
        }}
      />

      {/* Carrot wedges — orange triangle bodies with a tiny green tip */}
      {[0, 1, 2].map((i) => {
        // Spread three wedges across the upper half, slight asymmetry.
        const angle =
          (-Math.PI / 2) + (i - 1) * (Math.PI / 3.4) + (i === 1 ? 0.05 : 0);
        const r = 26;
        const dx = Math.cos(angle) * r;
        const dy = Math.sin(angle) * r * 0.55 - 6; // bias upward
        const rotEnd = (i - 1) * 40 + 18;
        return (
          <motion.span
            key={`w${i}`}
            aria-hidden
            initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.7 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [0, dx, dx],
              y: [0, dy, dy + 6],
              rotate: [0, rotEnd / 2, rotEnd],
              scale: [0.7, 1, 0.9],
            }}
            transition={{
              duration: 0.5,
              times: [0, 0.2, 0.7, 1],
              delay: i * 0.02,
              ease: [0.2, 0.7, 0.5, 1],
            }}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              width: 7,
              height: 12,
              marginLeft: -3.5,
              marginTop: -6,
              // Triangular carrot body via clip-path
              background:
                "linear-gradient(180deg, #ff8c3a 0%, #f4641f 95%)",
              clipPath:
                "polygon(50% 0%, 90% 35%, 65% 100%, 35% 100%, 10% 35%)",
              filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.18))",
              pointerEvents: "none",
            }}
          >
            {/* Green tuft */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -3,
                left: "50%",
                transform: "translateX(-50%)",
                width: 6,
                height: 5,
                background: "#5db04a",
                clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
              }}
            />
          </motion.span>
        );
      })}

      {/* Leaf flecks — wider spread, lower opacity */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (Math.PI * 2 * (i + 0.5)) / 4 + 0.4;
        const r = 30;
        const dx = Math.cos(angle) * r;
        const dy = Math.sin(angle) * r * 0.5 - 3;
        return (
          <motion.span
            key={`l${i}`}
            aria-hidden
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.8 }}
            animate={{
              opacity: [0, 0.85, 0],
              x: [0, dx],
              y: [0, dy],
              scale: [0.8, 1, 0.9],
              rotate: [0, 220 * (i % 2 === 0 ? 1 : -1)],
            }}
            transition={{ duration: 0.55, delay: 0.03 * i, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              width: 6,
              height: 6,
              marginLeft: -3,
              marginTop: -3,
              background: "#6dba53",
              borderRadius: "60% 40% 60% 40%",
              filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.12))",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Sparkle dots — fastest, cream highlights */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
        const r = 18;
        const dx = Math.cos(angle) * r;
        const dy = Math.sin(angle) * r * 0.55 - 4;
        return (
          <motion.span
            key={`s${i}`}
            aria-hidden
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
            animate={{
              opacity: [0, 1, 0],
              x: [0, dx],
              y: [0, dy],
              scale: [0.6, 1, 0.4],
            }}
            transition={{ duration: 0.35, delay: 0.04 * i, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              width: 3,
              height: 3,
              marginLeft: -1.5,
              marginTop: -1.5,
              borderRadius: "50%",
              background: "rgba(255,247,220,0.95)",
              boxShadow: "0 0 4px rgba(255,247,220,0.7)",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
}

/**
 * Fullscreen confetti flash — 0.8s.
 */
function PerfectCombo() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 800);
    return () => clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, times: [0, 0.25, 1] }}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${FX_CONFETTI})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}
    </AnimatePresence>
  );
}
