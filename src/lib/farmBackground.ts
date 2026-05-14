/**
 * Farm background picker (KST time-of-day → asset URL).
 *
 * The actual asset files that exist in this repo today are:
 *   - public/assets/farm/bg_day.webp        ← only base asset present
 *
 * Every other slot below (sky_dawn, bg_morning, bg_evening, bg_night,
 * bg_cherry, bg_autumn, bg_snowy, bg_rainy) falls back to bg_day.webp
 * because the artist deliverables are not yet in the repo. When those
 * land, drop them in `public/assets/farm/<filename>.webp` and the map
 * here resolves them automatically — no code change.
 *
 * Resolves URLs through `import.meta.env.BASE_URL` so the bundle stays
 * nested-base safe (Perplexity preview iframe etc.).
 *
 * The picker is pure — caller is responsible for re-invoking at the
 * appropriate cadence. `FarmHub` recomputes on mount, on tab focus,
 * and at the next hour boundary.
 */

const BASE = import.meta.env.BASE_URL;
const url = (filename: string) => `${BASE}assets/farm/${filename}`;

/** Files we *want*. Missing ones fall back to bg_day.webp. */
/**
 * Slot → file mapping. `bg_day` is the original WebP at the farm root;
 * every other slot lives under `bg/` as jpegs sourced from the
 * bunny_assets pack (see assets-missing.md). When future artwork is
 * delivered as WebP, swap the filename here.
 */
const SLOT_FILES = {
  sky_dawn: "bg/sky_dawn.jpeg",
  bg_morning: "bg/bg_morning.jpeg",
  bg_day: "bg_day.webp",
  bg_evening: "bg/bg_evening.jpeg",
  bg_night: "bg/bg_night.jpeg",
  bg_cherry: "bg/bg_cherry.jpeg",
  bg_autumn: "bg/bg_autumn.jpeg",
  bg_snowy: "bg/bg_snowy.jpeg",
  bg_rainy: "bg/bg_rainy.jpeg",
} as const;

/**
 * Files actually present in `public/assets/farm/`. All nine slots now
 * have art — the inventory is full. Kept as a set for symmetry with
 * future deletion / partial repacks.
 */
const PRESENT: ReadonlySet<keyof typeof SLOT_FILES> = new Set([
  "sky_dawn",
  "bg_morning",
  "bg_day",
  "bg_evening",
  "bg_night",
  "bg_cherry",
  "bg_autumn",
  "bg_snowy",
  "bg_rainy",
]);

export const MISSING_ASSETS = (
  Object.keys(SLOT_FILES) as (keyof typeof SLOT_FILES)[]
).filter((k) => !PRESENT.has(k)).map((k) => SLOT_FILES[k]);

function resolveSlot(slot: keyof typeof SLOT_FILES): string {
  if (PRESENT.has(slot)) return url(SLOT_FILES[slot]);
  return url(SLOT_FILES.bg_day);
}

export type FarmBgSlot = keyof typeof SLOT_FILES;

export interface PickFarmBackgroundOpts {
  /** Defaults to true; reads VITE_FARM_BG_AUTO at module load time. */
  autoEnabled?: boolean;
  /** Future: weather-based override. "rain" → bg_rainy if present. */
  weather?: "rain" | "snow" | null;
  /** If true, overlay seasonal palette (March → cherry etc.). */
  seasonOverlay?: boolean;
}

const ENV_AUTO_DEFAULT = (() => {
  const v = (import.meta.env as Record<string, unknown>)["VITE_FARM_BG_AUTO"];
  if (typeof v === "string") return v !== "false";
  return true;
})();

/** Settings-toggle storage key for "auto background". "0" disables. */
export const FARM_BG_AUTO_KEY = "cc.farm.bgAuto.v1";

/**
 * Read the per-user override from safeStorage. The caller is responsible
 * for importing safeStorage — kept out of this module so the picker
 * stays pure and tree-shakeable from non-UI contexts.
 */
export function autoFromStorageValue(raw: string | null): boolean {
  if (raw === null || raw === undefined) return ENV_AUTO_DEFAULT;
  return raw !== "0";
}

/**
 * Convert a Date to KST (UTC+9) hour-of-day [0..23], independent of the
 * runner's local TZ.
 */
function kstHour(d: Date): number {
  const kstMs = d.getTime() + 9 * 3600 * 1000;
  return new Date(kstMs).getUTCHours();
}

function kstMonth(d: Date): number {
  const kstMs = d.getTime() + 9 * 3600 * 1000;
  return new Date(kstMs).getUTCMonth() + 1; // 1..12
}

/** Time-of-day base slot (KST). */
function baseSlot(h: number): FarmBgSlot {
  if (h >= 5 && h < 8) return "sky_dawn";
  if (h >= 8 && h < 11) return "bg_morning";
  if (h >= 11 && h < 17) return "bg_day";
  if (h >= 17 && h < 20) return "bg_evening";
  return "bg_night"; // 20..04
}

/** Optional seasonal overlay (Korean four-season palette). */
function seasonSlot(month: number): FarmBgSlot | null {
  if (month === 3) return "bg_cherry";
  if (month >= 9 && month <= 11) return "bg_autumn";
  if (month === 12 || month <= 2) return "bg_snowy";
  return null;
}

export function pickFarmBackgroundSlot(
  now: Date = new Date(),
  opts: PickFarmBackgroundOpts = {},
): FarmBgSlot {
  const auto = opts.autoEnabled ?? ENV_AUTO_DEFAULT;
  if (!auto) return "bg_day";

  // Weather overlay wins outright when set (caller-driven).
  if (opts.weather === "rain") return "bg_rainy";
  if (opts.weather === "snow") return "bg_snowy";

  const h = kstHour(now);
  const base = baseSlot(h);

  if (opts.seasonOverlay) {
    const m = kstMonth(now);
    const season = seasonSlot(m);
    // Season overrides daytime slots, but never night — night ambience
    // wins so the player isn't surprised by midnight cherry blossoms.
    if (season && base !== "bg_night") return season;
  }

  return base;
}

export function pickFarmBackground(
  now: Date = new Date(),
  opts: PickFarmBackgroundOpts = {},
): string {
  return resolveSlot(pickFarmBackgroundSlot(now, opts));
}

/**
 * Returns a number of ms until the next hour boundary (KST). Useful for
 * `setTimeout`-based recomputation so the bg flips at top of the hour.
 */
export function msUntilNextHour(now: Date = new Date()): number {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const nextHour = new Date(kst);
  nextHour.setUTCMinutes(60, 0, 0);
  return Math.max(1000, nextHour.getTime() - kst.getTime());
}
