import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { useFarmStore, type CropStage } from "./farmStore";
import { useToolStore, type ToolId } from "./toolStore";
import { useItemsStore } from "./itemsStore";
import { safeStorage } from "../../lib/safeStorage";
import {
  FARM_BG_AUTO_KEY,
  autoFromStorageValue,
  msUntilNextHour,
  pickFarmBackground,
  pickFarmBackgroundSlot,
} from "../../lib/farmBackground";
import {
  computePerfectCombo,
  rollHarvestGacha,
} from "../../lib/seasonalBunny";
import { drawBunny, HARVEST_BUNNY_CHANCE } from "../../lib/bunnyGacha";
import { drawBunnyOnServer, loadBunnyCollection } from "./bunniesSync";
import { useRewardsStore } from "./rewardsStore";
import { useCollectionStore } from "./collectionStore";
import { BunnyGachaModal } from "../../components/Inventory/BunnyGachaModal";
import { AdRewardChannelModal } from "../../components/Inventory/AdRewardChannelModal";
import { ToolDock, TOOL_SELECTED_EVENT } from "../../components/Farm/ToolDock";
import { FxLayer, type FxEvent, type FxKind } from "../../components/Farm/Effects";
import { Atmosphere, variantForSlot } from "../../components/Farm/Atmosphere";
import { SkyView } from "../../components/Farm/SkyView";

// vite `base: "./"` 빌드 호환을 위해 절대 root 경로 (`/assets/...`) 대신
// `import.meta.env.BASE_URL` prefix 를 쓴다. 일반 호스팅은 BASE_URL 이 `/`,
// 정적 미리보기 (Perplexity preview iframe / 서브패스 호스팅) 는 `./` 또는
// 임의 prefix 가 되어, host root 가 아닌 번들의 실제 위치를 기준으로 해소된다.
const BASE = import.meta.env.BASE_URL;
const BG_NATURAL_W = 1536;
const BG_NATURAL_H = 2752;

const CROP_ASSETS = {
  seed: `${BASE}assets/farm/crops/crop_stage1_seed.webp`,
  sprout: `${BASE}assets/farm/crops/crop_stage2_sprout.webp`,
  leaves: `${BASE}assets/farm/crops/crop_stage3_leaves.webp`,
  ripe: `${BASE}assets/farm/crops/crop_stage4_ripe.webp`,
} as const;

// One polygon per visible raised plot tile (9 tiles total). Each polygon
// uses that tile's own four corner points — the rhombus top/right/bottom/
// left extremes of the brown raised surface — shrunk slightly toward the
// centroid so the body fits inside the tile and excludes the darker gaps
// between neighbouring tiles. Coordinates are percent space in viewBox
// "0 0 100 100" and matched to bg_day.webp via preserveAspectRatio="none".
// Guide ordering: scanline top-to-bottom, left-to-right of the diamond
// 3×3 grid (#1 back-center, #5 grid-center, #9 front-center).
export const PLOT_POLYGONS: ReadonlyArray<{ id: number; points: string }> = [
  { id: 0, points: "50.49,48.83 62.08,52.36 51.06,55.73 39.94,51.83" }, // #1 back-center
  { id: 1, points: "34.70,53.29 46.29,56.98 33.64,61.15 22.72,56.71" }, // #2 back-left
  { id: 2, points: "65.96,53.17 78.99,56.97 67.59,61.04 55.32,56.65" }, // #3 back-right
  { id: 3, points: "16.5,58.1 28.7,62.3 13.3,67.1 2.6,62.4" }, // #4 mid-left
  { id: 4, points: "50.07,58.27 63.10,62.61 50.26,67.21 38.09,62.13" }, // #5 mid-center
  { id: 5, points: "83.3,57.8 97.8,62.1 86.0,66.8 72.5,62.3" }, // #6 mid-right
  { id: 6, points: "32.25,64.03 44.99,68.85 30.52,74.36 18.16,68.47" }, // #7 front-left
  { id: 7, points: "67.84,63.92 82.40,68.94 69.85,74.24 55.47,68.30" }, // #8 front-right
  { id: 8, points: "49.63,70.62 64.48,76.24 50.21,82.76 35.54,75.92" }, // #9 front-center
];

// Production default: hide validation overlay. Toggle with ?debug=1.
const FARM_PLOT_DEBUG = false;

// Crop sprites share one rendered box per plot, independent of stage,
// so stage1→stage4 do not visually inflate. The asset itself depicts
// growth via internal artwork; the bounding box stays constant.
// Kept ≤ ~1.25× of plot height so the soil base never spills into the
// dark gaps between neighbouring tiles — otherwise the 3×3 grid visually
// merges into one continuous blob.
const CROP_SIZE_RATIO = 1.2;

function stageLabel(stage: CropStage): string {
  switch (stage) {
    case 0: return "빈 밭";
    case 1: return "씨앗";
    case 2: return "새싹";
    case 3: return "잎";
    case 4: return "수확 가능";
  }
}

function stageAction(stage: CropStage): string {
  switch (stage) {
    case 0: return "심기";
    case 1:
    case 2:
    case 3: return "자라는 중";
    case 4: return "수확";
  }
}

function stageAsset(stage: CropStage): string | null {
  switch (stage) {
    case 1: return CROP_ASSETS.seed;
    case 2: return CROP_ASSETS.sprout;
    case 3: return CROP_ASSETS.leaves;
    case 4: return CROP_ASSETS.ripe;
    default: return null;
  }
}

interface PolyBounds {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

function polygonBounds(points: string): PolyBounds {
  const pts = points
    .trim()
    .split(/\s+/)
    .map((p) => p.split(",").map(Number));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function urlDebugFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("debug");
    return v === "1" || v === "true" || v === "farm";
  } catch {
    return false;
  }
}

function urlDebugFarmFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "farm";
  } catch {
    return false;
  }
}

interface FarmHubProps {
  /** Open the existing dogam (collection grid) view. Optional now that
   *  CollectionPage's compact header owns the dogam button. */
  onOpenDogam?: () => void;
  /** Kept for backwards-compat; no longer rendered inside the card. */
  obtainedCount?: number;
  totalCount?: number;
  /** Force overlay on/off; defaults to ?debug=1 URL flag or FARM_PLOT_DEBUG. */
  debugOverlay?: boolean;
}

/**
 * FarmHub — visual landing inside the 농장 tab. Shows the bg_day farm
 * background with a 3×3 perspective plot grid. Each plot is a tap target
 * that cycles through 빈 밭 → 씨앗 → 새싹 → 잎 → 수확 → 빈 밭.
 */
export function FarmHub({
  debugOverlay,
}: FarmHubProps) {
  const initialDebug =
    debugOverlay ?? (urlDebugFlag() || FARM_PLOT_DEBUG);
  const [debug, setDebug] = useState(initialDebug);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Plot/carrot state lives in farmStore so it survives tab navigation.
  // (Carrot count is now displayed by CollectionPage's compact header.)
  const stages = useFarmStore((s) => s.stages);
  const plant = useFarmStore((s) => s.plant);
  const harvest = useFarmStore((s) => s.harvest);
  const cycleDebug = useFarmStore((s) => s.cycleDebug);
  const hydrate = useFarmStore((s) => s.hydrate);
  const hydrateItems = useItemsStore((s) => s.hydrate);
  const hydrateBunnies = useCollectionStore((s) => s.hydrateBunniesFromRemote);

  // Pull canonical farm + inventory + bunny ownership from the server on
  // mount. No-op for guest/mock — every adapter resolves silently when
  // the API base / token is missing.
  useEffect(() => {
    void hydrate();
    void hydrateItems();
    void (async () => {
      const r = await loadBunnyCollection();
      if (r.ok && "collection" in r) {
        hydrateBunnies(r.collection.bunnies.map((b) => b.bunny_id));
      }
    })();
  }, [hydrate, hydrateItems, hydrateBunnies]);

  // Time-of-day background. Recomputes at mount, on tab focus (`visibilitychange`),
  // and at the next KST hour boundary so dawn → morning → day etc. flip
  // automatically. The auto toggle lives in Settings → 외관 → 배경 자동 변경.
  const [bgSrc, setBgSrc] = useState<string>(() => {
    const auto = autoFromStorageValue(safeStorage.get(FARM_BG_AUTO_KEY));
    return pickFarmBackground(new Date(), { autoEnabled: auto });
  });
  const [bgSlot, setBgSlot] = useState(() => {
    const auto = autoFromStorageValue(safeStorage.get(FARM_BG_AUTO_KEY));
    return pickFarmBackgroundSlot(new Date(), { autoEnabled: auto });
  });
  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const recompute = () => {
      if (cancelled) return;
      const auto = autoFromStorageValue(safeStorage.get(FARM_BG_AUTO_KEY));
      const nextSrc = pickFarmBackground(new Date(), { autoEnabled: auto });
      const nextSlot = pickFarmBackgroundSlot(new Date(), { autoEnabled: auto });
      setBgSrc((cur) => (cur === nextSrc ? cur : nextSrc));
      setBgSlot((cur) => (cur === nextSlot ? cur : nextSlot));
      // 5-minute polling per spec — handles weather/season overrides
      // even when the user is mid-hour. msUntilNextHour stays as a
      // ceiling so we don't drift past the next slot's start.
      const delay = Math.min(5 * 60_000, msUntilNextHour());
      timeout = setTimeout(recompute, delay);
    };
    recompute();
    const onVisible = () => {
      if (document.visibilityState === "visible") recompute();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Allow runtime toggle via ?debug=1 when location changes (e.g. demos).
  useEffect(() => {
    if (debugOverlay !== undefined) return;
    if (urlDebugFlag()) setDebug(true);
  }, [debugOverlay]);

  const plotBounds = useMemo(
    () => PLOT_POLYGONS.map((p) => ({ id: p.id, ...polygonBounds(p.points) })),
    [],
  );
  const debugFarm = useMemo(() => urlDebugFarmFlag(), []);
  useEffect(() => {
    if (!debugFarm) return;
    // One-shot log of plot centers in the 100×100 viewBox percent space.
    console.log("[farm] PLOT_CENTERS (% in viewBox 100x100):");
    for (const b of plotBounds) {
      console.log(
        `  #${b.id + 1} (id=${b.id}) cx=${b.cx.toFixed(2)} cy=${b.cy.toFixed(2)} w=${b.width.toFixed(2)} h=${b.height.toFixed(2)}`,
      );
    }
    console.log(
      "[farm] background slot:",
      pickFarmBackgroundSlot(new Date(), {
        autoEnabled: autoFromStorageValue(safeStorage.get(FARM_BG_AUTO_KEY)),
      }),
    );
  }, [debugFarm, plotBounds]);

  const plantedCount = stages.filter((s) => s >= 1 && s <= 3).length;
  const readyCount = stages.filter((s) => s === 4).length;
  const helpCopy =
    readyCount > 0
      ? "수확 가능! 익은 밭을 눌러 당근을 거두자"
      : plantedCount > 0
        ? "5분 이상 집중하면 작물이 자라요"
        : "빈 밭을 눌러 씨앗을 심자";

  // --- FX layer --------------------------------------------------------
  const fxCounter = useRef(0);
  const [fxEvents, setFxEvents] = useState<FxEvent[]>([]);
  const pushFx = useCallback(
    (kind: FxKind, b: { cx: number; cy: number }) => {
      const id = ++fxCounter.current;
      setFxEvents((prev) => [...prev, { id, kind, cx: b.cx, cy: b.cy }]);
      // Auto-cleanup after 1.2s — longer than any individual FX duration.
      setTimeout(() => {
        setFxEvents((prev) => prev.filter((e) => e.id !== id));
      }, 1200);
    },
    [],
  );

  // --- Tool selection --------------------------------------------------
  const selectedTool = useToolStore((s) => s.selected);
  const selectTool = useToolStore((s) => s.select);
  const spendWatering = useToolStore((s) => s.spendWatering);
  const growAllPlanted = useFarmStore((s) => s.growAllPlanted);
  const incCandyCarrots = useFarmStore((s) => s.incCandyCarrots);
  const incGoldenCarrots = useFarmStore((s) => s.incGoldenCarrots);
  const unlockMedal = useRewardsStore((s) => s.unlockMedal);
  const forceUnlock = useCollectionStore((s) => s.forceUnlock);
  const ownedIdsArr = useCollectionStore((s) => s.ownedCharacters);

  // --- Sky-view -------------------------------------------------------
  const [skyOpen, setSkyOpen] = useState(false);
  // --- Bunny gacha modal ----------------------------------------------
  const [gachaBunnyId, setGachaBunnyId] = useState<string | null>(null);
  // Ad-reward channel modal — opened via cc:ad-channel:open from
  // ToolDock or any future ad-watch CTA.
  const [adChannelOpen, setAdChannelOpen] = useState(false);
  useEffect(() => {
    const open = () => setAdChannelOpen(true);
    window.addEventListener("cc:ad-channel:open", open);
    return () => window.removeEventListener("cc:ad-channel:open", open);
  }, []);

  // Mirror dock-driven selection changes (event bus) into local state.
  // The store is the source of truth; this is here so a future dock
  // re-mount or external dispatch syncs without prop-drilling.
  useEffect(() => {
    const onEv = () => {
      /* the store already updated — re-render triggered by selector */
    };
    window.addEventListener(TOOL_SELECTED_EVENT, onEv);
    return () => window.removeEventListener(TOOL_SELECTED_EVENT, onEv);
  }, []);

  // --- Plot click logic ------------------------------------------------
  /**
   * Tool semantics:
   *   - empty plot + shovel       → plant + dirt_burst
   *   - empty plot + no tool      → auto-select shovel, then plant
   *   - sprout/leaves + watering  → spend a charge; if charges left,
   *     advance one stage and water_splash. Else gentle toast.
   *   - ripe + basket / no tool   → harvest + harvest_pop (+ perfect
   *     combo flash if the snapshot just turned all-ripe).
   *   - mismatched tool ⇒ guidance toast.
   * Debug mode (?debug=1) keeps the old manual cycle.
   */
  const onPlotClick = (id: number) => {
    if (debug) {
      haptic("light");
      cycleDebug(id);
      return;
    }
    const current = stages[id];
    const bounds = plotBounds.find((b) => b.id === id);
    if (!bounds) return;
    const tool: ToolId | null = selectedTool;

    if (current === 0) {
      if (tool === "shovel" || tool === null) {
        if (tool === null) selectTool("shovel");
        plant(id);
        haptic("light");
        pushFx("dirt_burst", bounds);
        toast("씨앗을 심었어요");
      } else if (tool === "watering_can") {
        toast("물뿌리개는 자라는 작물에 사용할 수 있어요");
      } else if (tool === "basket") {
        toast("바구니는 익은 작물에 사용할 수 있어요");
      }
      return;
    }

    if (current === 4) {
      if (tool === "basket" || tool === null || tool === "shovel") {
        // Roll the harvest gacha BEFORE applying the base +1 carrot so
        // the candy/golden flavors stack on top: every harvest gives
        // +1 carrot plus optionally +1 candy/golden via the rare-roll
        // table (see src/lib/seasonalBunny.ts).
        harvest(id);
        haptic("medium");
        const outcome = rollHarvestGacha();
        if (outcome.kind === "candy") {
          incCandyCarrots(1);
          pushFx("sparkle", bounds);
          unlockMedal("first_candy");
          toast("🍬 캔디 당근! +5 P");
        } else if (outcome.kind === "golden") {
          incGoldenCarrots(1);
          pushFx("sparkle", bounds);
          unlockMedal("first_golden");
          toast("✨ 황금 당근! +10 P");
        } else {
          pushFx("harvest_pop", bounds);
          toast("당근 +1");
        }
        unlockMedal("first_harvest");
        // useFarmStore.carrots is the SoT; using getState() to avoid
        // re-subscribing for this one-shot check.
        if (useFarmStore.getState().carrots >= 5) unlockMedal("five_carrots");
        // Rare 0.5% bunny pull from harvest (legendary excluded). The
        // 0.5% gate runs client-side so we don't burn a network round-
        // trip on every harvest; on a hit, the server makes the
        // authoritative pick + records ownership. Offline or noop
        // (preview / guest / missing migration) falls back to the
        // local `drawBunny` so the dogam stays interactive.
        if (Math.random() < HARVEST_BUNNY_CHANCE) {
          void (async () => {
            let bunnyId: string | null = null;
            try {
              const server = await drawBunnyOnServer(true);
              if (
                server.ok &&
                "draw" in server &&
                server.draw?.bunny?.bunny_id
              ) {
                bunnyId = server.draw.bunny.bunny_id;
              }
            } catch {
              /* fall through to local pick */
            }
            if (!bunnyId) {
              const result = drawBunny({
                ownedIds: new Set(ownedIdsArr),
                excludeLegendary: true,
              });
              bunnyId = result.bunnyId;
            }
            if (bunnyId) {
              forceUnlock(bunnyId);
              setGachaBunnyId(bunnyId);
            }
          })();
        }
      } else if (tool === "watering_can") {
        toast("이미 다 자랐어요 — 바구니로 수확하세요");
      }
      return;
    }

    // current ∈ {1,2,3} — growing.
    if (tool === "watering_can") {
      if (spendWatering()) {
        // Use growAllPlanted's per-snapshot dedupe by passing a unique
        // id — Date.now() guarantees this watering tap is counted.
        growAllPlanted(1, Date.now(), 0);
        haptic("light");
        pushFx("water_splash", bounds);
        toast("물을 주었어요");
      } else {
        toast("오늘 물뿌리개를 다 썼어요 🥲");
      }
      return;
    }
    if (tool === "shovel") {
      toast("이미 심은 자리에요");
      return;
    }
    if (tool === "basket") {
      toast("조금만 더 집중하면 자라요 🌱");
      return;
    }
    // No tool selected — gentle reminder.
    haptic("light");
    toast("집중을 완료하면 자라요");
  };

  // Perfect-combo detection: when stages flip to all-4, fire the
  // fullscreen sparkle once and toast.
  const lastAllRipe = useRef(false);
  useEffect(() => {
    const allRipe = stages.every((s) => s === 4);
    if (allRipe && !lastAllRipe.current) {
      pushFx("perfect_combo", { cx: 50, cy: 50 });
      toast("🌟 퍼펙트 콤보! 다음 수확이 좋아질거에요");
      unlockMedal("perfect_combo");
    }
    lastAllRipe.current = allRipe;
  }, [stages, pushFx, unlockMedal]);
  // computePerfectCombo is the helper unit-tested in seasonalBunny.test;
  // keep it referenced so tree-shakers don't drop it from a future
  // analyzer pass and so the helper stays one-to-one with the UI logic.
  void computePerfectCombo;

  return (
    <section
      data-testid="farm-hub"
      style={{
        // Visible card: fills the FarmView flex column. Width clamps at
        // --app-max-width (480px); height fills available space.
        position: "relative",
        width: "100%",
        height: "100%",
        maxWidth: 480,
        margin: "0 auto",
        borderRadius: 16,
        overflow: "hidden",
        background: "var(--surface-2, #f5e9d5)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      {/* Aspect-stage wrapper. Locked to the bg image's natural aspect
          (1536:2752) and sized so it ALWAYS covers the visible card:
          `min-width:100%; min-height:100%` plus aspect-ratio gives the
          browser exactly one valid size — whichever min dimension wins
          dictates the other via the ratio. The wrapper is centered via
          translate(-50%,-50%), so the visible card crops the bg
          symmetrically. Because <img> and <svg> share this same
          aspect-stage, the 9 polygons in the 100×100 viewBox stay
          pixel-aligned to bg_day.webp regardless of card aspect. */}
      <div
        data-testid="farm-stage"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          aspectRatio: `${BG_NATURAL_W} / ${BG_NATURAL_H}`,
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
      {/* Crossfade backgrounds when the time-of-day picker switches
          slots. AnimatePresence keys on the actual src so the old layer
          fades out beneath the new one for 0.8s. pointer-events:none on
          both so the polygons stay clickable. */}
      <AnimatePresence>
        <motion.img
          key={bgSrc}
          src={bgSrc}
          alt="농장 배경"
          loading="eager"
          decoding="async"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "fill",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </AnimatePresence>

      {/* Atmosphere — clouds always; rain/snow/cherry/autumn keyed to
          the current bg slot. Cheap CSS keyframes, pointer-events:none. */}
      <Atmosphere variant={variantForSlot(bgSlot)} />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-label="농장 밭"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        {/* Crops rendered as SVG images so they share the polygon's
            percent-space and scale perfectly with the bg.
            One element per plot (stable key); when stage===0 we render
            nothing and skip the fade-out so harvest is an immediate snap
            (no ghost/afterimage). Stage 1↔4 transitions animate via the
            stage-keyed `animate` prop without remount, so the old sprite
            does not overlap the new one. */}
        {plotBounds.map((b) => {
          const stage = stages[b.id];
          const asset = stageAsset(stage);
          if (!asset) return null;
          const size = b.height * CROP_SIZE_RATIO;
          const x = b.cx - size / 2;
          const y = b.cy - size * 0.75;
          return (
            <motion.image
              key={b.id}
              href={asset}
              x={x}
              y={y}
              width={size}
              height={size}
              preserveAspectRatio="xMidYMax meet"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              style={{
                pointerEvents: "none",
                filter:
                  stage === 4
                    ? "drop-shadow(0 0.4px 0.7px rgba(255,160,60,0.45))"
                    : "drop-shadow(0 0.15px 0.4px rgba(0,0,0,0.25))",
              }}
              aria-label={stageLabel(stage)}
            />
          );
        })}

        {PLOT_POLYGONS.map((p) => {
          const isHovered = hoveredId === p.id;
          const debugColor = debugFarm
            ? "rgba(255,40,40,"
            : "rgba(0,255,255,";
          const fill = debug
            ? isHovered
              ? `${debugColor}0.45)`
              : `${debugColor}0.18)`
            : "transparent";
          const stroke = debug ? `${debugColor}0.95)` : "transparent";
          return (
            <polygon
              key={p.id}
              points={p.points}
              fill={fill}
              stroke={stroke}
              strokeWidth={debug ? 0.4 : 0}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: "pointer" }}
              data-testid={`farm-plot-${p.id}`}
              aria-label={`${p.id + 1}번 밭 ${stageLabel(stages[p.id])} — ${stageAction(stages[p.id])}`}
              role="button"
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onPlotClick(p.id)}
            />
          );
        })}
      </svg>

      {/* One-shot effects rendered as absolute-positioned HTML INSIDE
          the aspect-stage wrapper. The wrapper is locked to the bg's
          1536:2752 ratio, so `left: cx%; top: cy%` (cx/cy from
          polygonBounds) lands on the same logical point the SVG
          polygon does — but each effect renders at its own natural
          aspect, so circles stay circles and PNGs aren't stretched. */}
      <FxLayer events={fxEvents} />
      </div>

      {/* "하늘 보기" affordance — small subtle chip pinned to the upper
          sky area. Tap opens SkyView with the current slot's sky image
          + cozy message. */}
      <button
        type="button"
        data-testid="farm-sky-open"
        aria-label="하늘 보기"
        onClick={() => {
          haptic("light");
          setSkyOpen(true);
        }}
        style={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.6)",
          color: "rgba(43, 24, 16, 0.78)",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.01em",
          textShadow: "0 1px 1px rgba(255,255,255,0.4)",
          zIndex: 5,
        }}
      >
        ☁ 하늘 보기
      </button>

      {/* Bottom-of-card tool dock. Absolute inside .farm-hub, above
          the help-copy chip. Selecting a tool dispatches the
          cc:tool:selected event read by onPlotClick. */}
      <ToolDock />

      {/* Fullscreen sky overlay. Renders only when skyOpen. */}
      <SkyView open={skyOpen} slot={bgSlot} onClose={() => setSkyOpen(false)} />

      {/* Bunny gacha success modal — opens when harvest hits 0.5% rare pull. */}
      <BunnyGachaModal
        open={gachaBunnyId !== null}
        bunnyId={gachaBunnyId}
        onClose={() => setGachaBunnyId(null)}
      />

      {/* Ad-reward channel chooser — opens on cc:ad-channel:open. */}
      <AdRewardChannelModal
        open={adChannelOpen}
        onClose={() => setAdChannelOpen(false)}
      />

      {/* CollectionPage's FarmView owns the compact header (carrot/plot
          inventory + dogam button). The in-card chips were removed to
          avoid duplication and reclaim vertical space for the plots.
          Carrot/plot state hooks below are still used by the click logic
          and the help copy. */}

      {/* Bottom-center help copy — non-interactive, no timer */}
      <div
        data-testid="farm-help-copy"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 10,
          transform: "translateX(-50%)",
          padding: "5px 11px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.85)",
          color: "var(--text-secondary, #5a5a5a)",
          border: "1px solid rgba(0,0,0,0.05)",
          fontSize: 11,
          fontWeight: 500,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          whiteSpace: "nowrap",
          maxWidth: "calc(100% - 24px)",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        {helpCopy}
      </div>

      {import.meta.env.DEV && (
        <button
          type="button"
          onClick={() => setDebug((d) => !d)}
          aria-label="밭 디버그 오버레이 토글"
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(0,0,0,0.06)",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {debug ? "🔧 plots" : "plots"}
        </button>
      )}
    </section>
  );
}

