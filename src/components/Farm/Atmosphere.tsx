/**
 * Atmospheric particle layer over the farm card.
 *
 * Pure CSS — DOM-only, no canvas, no requestAnimationFrame loop. The
 * particles are absolutely-positioned spans with `transform` keyframes
 * applied via inline animations. Compositor-only properties keep it
 * cheap on low-end WebViews.
 *
 * Variants:
 *   - "rain"   → 20 slanted streaks, light gray, fast falls
 *   - "snow"   → 18 round flakes, slow falls + slight horizontal drift
 *   - "cherry" → 14 pink petals, gentle sway
 *   - "autumn" → 12 amber leaves, rotation + fall
 *   - "clouds" → always-on, slow horizontal parallax
 *   - "none"   → nothing
 *
 * Clouds always render. The variant overlays on top of clouds.
 */
import { useMemo } from "react";
import type { FarmBgSlot } from "../../lib/farmBackground";

export type AtmosphereVariant = "rain" | "snow" | "cherry" | "autumn" | "none";

export function variantForSlot(slot: FarmBgSlot): AtmosphereVariant {
  switch (slot) {
    case "bg_rainy":
      return "rain";
    case "bg_snowy":
      return "snow";
    case "bg_cherry":
      return "cherry";
    case "bg_autumn":
      return "autumn";
    default:
      return "none";
  }
}

export function Atmosphere({ variant }: { variant: AtmosphereVariant }) {
  // Particles built once per variant — render order is stable, no
  // layout thrash. Math.random is fine: this only runs when the
  // variant changes, not on every animation frame.
  const particles = useMemo(() => makeParticles(variant), [variant]);

  return (
    <div
      data-testid={`atmosphere-${variant}`}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {/* Slow cloud parallax — always on */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: 0,
          width: "200%",
          height: "12%",
          backgroundImage:
            "radial-gradient(closest-side, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)",
          backgroundRepeat: "repeat-x",
          backgroundSize: "30% 100%",
          animation: "cc-cloud-drift 70s linear infinite",
          opacity: 0.6,
        }}
      />

      {particles}

      <style>{KEYFRAMES}</style>
    </div>
  );
}

function makeParticles(v: AtmosphereVariant) {
  if (v === "none") return null;

  if (v === "rain") {
    return Array.from({ length: 20 }).map((_, i) => {
      const left = ((i * 53) % 100) + Math.random() * 4;
      const duration = 0.7 + Math.random() * 0.4;
      const delay = Math.random() * 1.2;
      return (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -20,
            left: `${left}%`,
            width: 1.5,
            height: 14,
            background: "rgba(150,170,200,0.55)",
            transform: "rotate(15deg)",
            animation: `cc-fall ${duration}s linear ${delay}s infinite`,
            borderRadius: 2,
          }}
        />
      );
    });
  }

  if (v === "snow") {
    return Array.from({ length: 18 }).map((_, i) => {
      const left = ((i * 67) % 100) + Math.random() * 4;
      const duration = 4 + Math.random() * 2;
      const delay = Math.random() * 4;
      const size = 3 + Math.random() * 3;
      return (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -10,
            left: `${left}%`,
            width: size,
            height: size,
            background: "rgba(255,255,255,0.85)",
            borderRadius: "50%",
            boxShadow: "0 0 4px rgba(255,255,255,0.6)",
            animation: `cc-snow ${duration}s linear ${delay}s infinite`,
          }}
        />
      );
    });
  }

  if (v === "cherry") {
    return Array.from({ length: 14 }).map((_, i) => {
      const left = ((i * 79) % 100) + Math.random() * 4;
      const duration = 5 + Math.random() * 3;
      const delay = Math.random() * 5;
      return (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -16,
            left: `${left}%`,
            width: 6,
            height: 6,
            background: "rgba(255, 190, 200, 0.75)",
            borderRadius: "60% 40% 60% 40%",
            animation: `cc-petal ${duration}s linear ${delay}s infinite`,
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.06))",
          }}
        />
      );
    });
  }

  if (v === "autumn") {
    return Array.from({ length: 12 }).map((_, i) => {
      const left = ((i * 83) % 100) + Math.random() * 4;
      const duration = 5 + Math.random() * 3;
      const delay = Math.random() * 5;
      const palette = ["#d97a3a", "#c14e2b", "#e7a23b"];
      const color = palette[i % palette.length];
      return (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -14,
            left: `${left}%`,
            width: 8,
            height: 8,
            background: color,
            borderRadius: "50% 0 50% 0",
            animation: `cc-leaf ${duration}s linear ${delay}s infinite`,
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.08))",
          }}
        />
      );
    });
  }

  return null;
}

const KEYFRAMES = `
@keyframes cc-cloud-drift {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes cc-fall {
  0%   { transform: translateY(0) rotate(15deg); opacity: 0; }
  10%  { opacity: 0.6; }
  100% { transform: translateY(110%) rotate(15deg); opacity: 0; }
}
@keyframes cc-snow {
  0%   { transform: translate3d(0, 0, 0); opacity: 0; }
  10%  { opacity: 0.85; }
  100% { transform: translate3d(10px, 110%, 0); opacity: 0; }
}
@keyframes cc-petal {
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.85; }
  100% { transform: translate3d(-20px, 110%, 0) rotate(360deg); opacity: 0; }
}
@keyframes cc-leaf {
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.9; }
  100% { transform: translate3d(15px, 110%, 0) rotate(-360deg); opacity: 0; }
}
`;
