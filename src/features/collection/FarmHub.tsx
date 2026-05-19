import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { useFarmStore, type CropStage } from "./farmStore";
import { useToolStore, type ToolId } from "./toolStore";
import { useItemsStore } from "./itemsStore";
import { useBuffsStore } from "./buffsStore";
import { safeStorage } from "../../lib/safeStorage";
import {
  FARM_BG_AUTO_KEY,
  FARM_FORCE_SLOT_KEY,
  autoFromStorageValue,
  isValidSlot,
  msUntilNextHour,
  pickFarmBackground,
  pickFarmBackgroundSlot,
  type FarmBgSlot,
} from "../../lib/farmBackground";
import {
  computePerfectCombo,
  rollHarvestGacha,
} from "../../lib/seasonalBunny";
import { drawBunny, HARVEST_BUNNY_CHANCE } from "../../lib/bunnyGacha";
import { drawBunnyOnServer, loadBunnyCollection } from "./bunniesSync";
import { playSfx } from "../../lib/soundFx";
import { useSoundStore } from "../../store/soundStore";
import { useRewardsStore } from "./rewardsStore";
import { useCollectionStore } from "./collectionStore";
import { passivesFromOwned } from "../../lib/dogamPassives";
import { useMissionsStore } from "../missions/missionsStore";
import { useWeeklyMissionsStore } from "../missions/weeklyMissionsStore";
import {
  consumeSuppressedDrops,
  formatSuppressedMessage,
} from "../../lib/notify/focusGate";
import { BunnyGachaModal } from "../../components/Inventory/BunnyGachaModal";
import { GemTradeModal } from "../../components/Inventory/GemTradeModal";
import { BunnyPityModal } from "../../components/Inventory/BunnyPityModal";
import { HeartUseModal } from "../../components/Inventory/HeartUseModal";
import { useStreakStore } from "./streakStore";
import { AdRewardChannelModal } from "../../components/Inventory/AdRewardChannelModal";
import { ToolDock, TOOL_SELECTED_EVENT } from "../../components/Farm/ToolDock";
import { BuffChipsRow } from "../buffs/BuffChipsRow";
import { FarmDropLayer } from "../../components/Farm/FarmDropLayer";
import { HiddenBunnyLayer } from "../../components/Farm/HiddenBunnyLayer";
import { HiddenBunnyPeek } from "../../components/Farm/HiddenBunnyPeek";
import {
  AdSuggestionModal,
  suggestAdFor,
} from "../../components/Farm/AdSuggestionModal";
import { FxLayer, type FxEvent, type FxKind } from "../../components/Farm/Effects";
import { Atmosphere, variantForSlot } from "../../components/Farm/Atmosphere";
import { SkyView } from "../../components/Farm/SkyView";
import { VisitorBunny } from "../../components/Farm/VisitorBunny";
import { BgmQuickToggle } from "../../components/Farm/BgmQuickToggle";
import { useFriendsStore } from "./friendsStore";
// PR-152 (Round 25) — 데코 v2. v1 (catalog 22 + OutdoorSlots +
// FurnitureShopModal + fragmentStore) 는 features/_decor_v1_archive/ 로.
// v2 는 MushroomHouseRoom 진입점만 — 가구 배치/지급은 별도 흐름.
import { MushroomHouseRoom } from "../decor/MushroomHouseRoom";
import { MushroomHouseHitRegion } from "./MushroomHouseHitRegion";
import { MushroomHouseEntryLabel } from "./MushroomHouseEntryLabel";

// PR-137 — shared pill style for the top-center 하늘 보기 + BGM 토글
// row. Keeping it as a CSSProperties const (not a CSS class) so the
// existing inline-style pattern in this file doesn't fork.
const pillStyle: React.CSSProperties = {
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
};

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
  const rolloverHearts = useItemsStore((s) => s.rolloverHeartsIfNeeded);
  const hydrateBunnies = useCollectionStore((s) => s.hydrateBunniesFromRemote);
  const hydrateFriends = useFriendsStore((s) => s.hydrate);
  const sfxMuted = useSoundStore((s) => s.sfxMuted);
  // PR-13 — SFX now has its own volume slider, decoupled from the
  // white-noise BGM volume that drives the focus-mode player.
  const masterVolume = useSoundStore((s) => s.sfxVolume);

  // PR-74 — 농장 진입 시 누적된 suppressed drop 메시지 flush. 사용자
  // 가 집중 중 홈에서 그냥 농장으로 넘어와도 한 번에 확인 가능.
  useEffect(() => {
    const counts = consumeSuppressedDrops();
    const msg = formatSuppressedMessage(counts);
    if (msg) toast(msg, { duration: 4000 });
  }, []);

  // R27 PHASE 1 (PR-163) → R33 PR-195 — 4 stage sprite preload + decode.
  // 빠른 연속 탭 시 새 stage 의 sprite href 가 비동기 로딩 → 1~2 frame
  // "잔상" 으로 보고됨. mount 시 모든 stage 자산을 디코더 캐시에 올려
  // 둠 + .decode() 호출로 픽셀까지 메모리에 완전 디코딩 (HTTP 캐시 만
  // 채우는 것보다 강함 — WKWebView SVG <image> 의 href swap 시 paint
  // 직전 ms 단위 race 차단).
  useEffect(() => {
    const urls = [
      CROP_ASSETS.seed,
      CROP_ASSETS.sprout,
      CROP_ASSETS.leaves,
      CROP_ASSETS.ripe,
    ];
    const imgs: HTMLImageElement[] = [];
    for (const u of urls) {
      const img = new Image();
      img.src = u;
      // .decode() Promise — 디코딩 완료까지 대기. WKWebView 의 GPU
      // 합성 시 즉시 paint 가능한 상태. 실패해도 throw 안 함 (silent).
      img.decode?.().catch(() => {
        /* ignore — best-effort warmup */
      });
      imgs.push(img);
    }
    return () => {
      // GC hint — 빠른 unmount 시 디코더 작업 취소.
      for (const img of imgs) img.src = "";
    };
  }, []);

  // Pull canonical farm + inventory + bunny ownership + today's visitor
  // from the server on mount. No-op for guest/mock — every adapter
  // resolves silently when the API base / token is missing.
  useEffect(() => {
    void hydrate();
    void hydrateItems();
    void hydrateFriends();
    // PR-24 — KST 자정 heart 리필. mount + visibilitychange 모두에서
    // idempotent 호출. 최초 사용자는 day key 비어 있어 즉시 +3 부여
    // → ad 슬롯이 처음부터 활성 상태.
    rolloverHearts();
    // R34 PR-204 — 일일 출석 streak claim. 오늘 첫 진입 시 자동 carrot
    // 보너스 + toast. 이미 수령했으면 no-op.
    const streakResult = useStreakStore.getState().claimDaily();
    if (streakResult.ok && streakResult.reward > 0) {
      // streak grant 는 광고 source 아님 → 일반 cap 적용.
      useFarmStore.getState().incCarrots(streakResult.reward);
      toast(
        `🔥 ${streakResult.streak}일 연속 출석 — 당근 +${streakResult.reward}`,
        { duration: 3500 },
      );
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") rolloverHearts();
    };
    document.addEventListener("visibilitychange", onVisible);
    void (async () => {
      const r = await loadBunnyCollection();
      if (r.ok && "collection" in r) {
        hydrateBunnies(r.collection.bunnies.map((b) => b.bunny_id));
      }
    })();
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hydrate, hydrateItems, hydrateBunnies, hydrateFriends, rolloverHearts]);

  // Time-of-day background. Recomputes at mount, on tab focus (`visibilitychange`),
  // and at the next KST hour boundary so dawn → morning → day etc. flip
  // automatically. The auto toggle lives in Settings → 외관 → 배경 자동 변경.
  // Reads BOTH the auto-bg toggle and (PR-19) the DEV force-slot key.
  // forceSlot wins inside pickFarmBackgroundSlot; production users never
  // have the key set so the path collapses to the original behavior.
  const readSlotOpts = () => {
    const auto = autoFromStorageValue(safeStorage.get(FARM_BG_AUTO_KEY));
    const forceRaw = safeStorage.get(FARM_FORCE_SLOT_KEY);
    const forceSlot: FarmBgSlot | null = isValidSlot(forceRaw)
      ? (forceRaw as FarmBgSlot)
      : null;
    return { autoEnabled: auto, forceSlot };
  };
  const [bgSrc, setBgSrc] = useState<string>(() =>
    pickFarmBackground(new Date(), readSlotOpts()),
  );
  const [bgSlot, setBgSlot] = useState(() =>
    pickFarmBackgroundSlot(new Date(), readSlotOpts()),
  );
  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const recompute = () => {
      if (cancelled) return;
      const opts = readSlotOpts();
      const nextSrc = pickFarmBackground(new Date(), opts);
      const nextSlot = pickFarmBackgroundSlot(new Date(), opts);
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
    // PR-19 — DEV panel's "force time slot" action dispatches this
    // event so the background updates immediately instead of waiting
    // for the 5-min poll.
    const onForceSlot = () => recompute();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("cc:dev:forceSlot", onForceSlot);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("cc:dev:forceSlot", onForceSlot);
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
  // R28 PHASE 2 — "5분 이상 집중하면 작물이 자라요" 카피는 홈 화면 전용.
  // HomePage idle 상태에서 노출되므로 농장에서 중복 노출하면 사용자가
  // "왜 또 보여?" → 농장에서는 planted 상태 안내 자체를 생략.
  // empty / ready 상태 hint 만 유지.
  const helpCopy =
    readyCount > 0
      ? "수확 가능! 익은 밭을 눌러 당근을 거두자"
      : plantedCount > 0
        ? ""
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
  // PR-133 — broadcast sky state so CollectionPage can rebuild the
  // bgm context (CollectionPage owns the bgmEngine wiring; FarmHub owns
  // the toggle).
  useEffect(() => {
    try {
      window.dispatchEvent(
        new CustomEvent("cc:sky:state", { detail: { open: skyOpen } }),
      );
    } catch {
      /* SSR */
    }
  }, [skyOpen]);

  // PR-130 (Round 17 beta2 feedback): natural-panning model — finger
  // moves DOWN on the farm → camera pans UP → sky comes into view.
  // Previously was swipe-up-opens; user's mental model is map-style
  // (drag content with finger). SkyView's close gesture is inverted to
  // match (swipe up to "push" the farm back up).
  //
  // Threshold values still match across farm/sky for hand-feel consistency.
  const swipeStartY = useRef<number | null>(null);
  const swipeMoved = useRef(false);
  const wheelAcc = useRef(0);
  const wheelResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const FARM_SWIPE_THRESHOLD_PX = 80;
  const FARM_WHEEL_THRESHOLD = 60;
  const onFarmTouchStart: React.TouchEventHandler = (e) => {
    swipeStartY.current = e.touches[0]?.clientY ?? null;
    swipeMoved.current = false;
  };
  const onFarmTouchMove: React.TouchEventHandler = (e) => {
    const start = swipeStartY.current;
    if (start == null) return;
    const cur = e.touches[0]?.clientY ?? start;
    if (Math.abs(cur - start) > 8) swipeMoved.current = true;
  };
  const onFarmTouchEnd: React.TouchEventHandler = (e) => {
    const start = swipeStartY.current;
    swipeStartY.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientY ?? start;
    // Down swipe: end > start (finger moved down, clientY increased).
    // Natural panning — drag content down → sky above comes into view.
    if (end - start >= FARM_SWIPE_THRESHOLD_PX && !skyOpen) {
      haptic("light");
      setSkyOpen(true);
    }
  };
  const onFarmWheel: React.WheelEventHandler = (e) => {
    // Accumulate within a 250 ms rolling window so trackpads (small
    // deltaY per event) can still trigger but a single sharp scroll
    // doesn't compete with the deltaY decay.
    wheelAcc.current += e.deltaY;
    if (wheelResetTimer.current) clearTimeout(wheelResetTimer.current);
    wheelResetTimer.current = setTimeout(() => {
      wheelAcc.current = 0;
    }, 250);
    // Positive deltaY = scroll down — consistent with the touch
    // natural-pan direction (drag down → sky shows).
    if (wheelAcc.current >= FARM_WHEEL_THRESHOLD && !skyOpen) {
      wheelAcc.current = 0;
      setSkyOpen(true);
    }
  };
  // --- Bunny gacha modal ----------------------------------------------
  const [gachaBunnyId, setGachaBunnyId] = useState<string | null>(null);
  // PR-33 — GemTradeModal 의 legendary 옵션이 cc:bunny-gacha:show 로
  // 결과를 surfacing. FarmHub 가 listener 로 모달 트리거.
  useEffect(() => {
    const onShow = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bunnyId?: string }>).detail;
      if (detail?.bunnyId) setGachaBunnyId(detail.bunnyId);
      if (detail?.bunnyId) {
      }
    };
    const onMedal = () => {
    };
    window.addEventListener("cc:bunny-gacha:show", onShow);
    window.addEventListener("cc:medal:unlocked", onMedal);
    return () => {
      window.removeEventListener("cc:bunny-gacha:show", onShow);
      window.removeEventListener("cc:medal:unlocked", onMedal);
    };
  }, []);

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
        playSfx("dig", { muted: sfxMuted, masterVolume });
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
        playSfx("harvest", { muted: sfxMuted, masterVolume });
        // Consume the juice buff (당근 주스) for this single roll if
        // active. PR-8: one-shot +5%p candy on top of the existing
        // base / boost / batch bonuses.
        const juiceActive = useBuffsStore.getState().consume("juice");
        // PR-92 — soup 재설계: 다음 수확 황금당근 +5%p.
        const soupActive = useBuffsStore.getState().consume("soup");
        // R33 PR-191 — heart 부스트: 다음 수확 candy +10%p.
        const heartActive = useBuffsStore.getState().consume("heart");
        // PR-38 — 도감 패시브 (캔디 +0.1%p / 황금 +0.1%p) 적용.
        const dogamOwned = useCollectionStore.getState().ownedCharacters.length;
        const passives = passivesFromOwned(dogamOwned);
        const outcome = rollHarvestGacha({
          juiceActive,
          soupActive,
          heartActive,
          candyBonusP: passives.candyBonusP,
          goldenBonusP: passives.goldenBonusP,
        });
        if (outcome.kind === "candy") {
          incCandyCarrots(1);
          pushFx("sparkle", bounds);
          unlockMedal("first_candy");

          toast("🍬 캔디 당근! +1");
        } else if (outcome.kind === "golden") {
          incGoldenCarrots(1);
          pushFx("sparkle", bounds);
          unlockMedal("first_golden");

          toast("✨ 황금 당근! +1");
        } else {
          pushFx("harvest_pop", bounds);
          toast("당근 +1");
        }
        // PR-63 — 도감 10마리 이상 시 sessionCarrotMul (×1.05) 보너스.
        // base harvest +1 carrot 위에 5% 확률로 +1 추가 — 평균 1.05.
        if (passives.sessionCarrotMul > 1) {
          const extraChance = passives.sessionCarrotMul - 1; // 0.05
          if (Math.random() < extraChance) {
            useFarmStore.getState().incCarrots(1);
          }
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
        growAllPlanted(1, Date.now());
        haptic("light");
        playSfx("water", { muted: sfxMuted, masterVolume });
        pushFx("water_splash", bounds);
        toast("물을 주었어요");
      } else {
        // PR-27 — 물뿌리개 잔여 0 → 광고 시청 안내 팝업 (spam guard
        // cooldown 5분 + 일일 cap 3 회). 가드 통과 못 하면 모달은
        // 안 뜨고 fallback toast 만 노출.
        const shown = suggestAdFor(
          "watering",
          "물뿌리개가 부족해요!",
          "광고를 보면 물뿌리개를 3회 충전할 수 있어요.",
        );
        if (!shown) toast("오늘 물뿌리개를 다 썼어요 🥲");
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

      // PR-75 — 학습 중심 active 미션 트리거.
      useMissionsStore.getState().incrementProgress("perfectCombo1", 1);
      // PR-76 — 주간 미션. weeklyPerfectCombo5 카운터.
      useWeeklyMissionsStore.getState().recordPerfectCombo();
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
      onTouchStart={onFarmTouchStart}
      onTouchMove={onFarmTouchMove}
      onTouchEnd={onFarmTouchEnd}
      onWheel={onFarmWheel}
      style={{
        // R35 — bg 풀화면 노출. SkyView 처럼 viewport 전체 cover.
        //   - position:fixed inset:0 → safe-area / tabbar 영역까지 모두 bg.
        //   - z-index 0 → TabBar (z:100) / 헤더 칩 (z:5) 아래.
        //   - aspect-stage 의 min-width/min-height 100% + aspect-ratio 가
        //     viewport 기준으로 재계산 → bg 가 자연 비율로 viewport cover.
        //   - bg 아트와 정렬 필요한 UI (MushroomHouseHitRegion / Entry
        //     Label) 는 aspect-stage 내부로 이동시켜 동일 좌표계 공유.
        //   - chrome UI (ToolDock / sky+BGM pills) 는 viewport / safe-area
        //     기준으로 다시 anchor.
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "var(--surface-2, #f5e9d5)",
        zIndex: 0,
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
        {/* R33 PR-198 — SVG <defs> + <symbol> + <use> 패턴 (잔상 근본
            fix).

            기존 SVG <image> + href swap 의 잔상 원인 정리:
              (a) stage 전환 시 React unmount + remount → GPU layer
                  cleanup race (1 frame 잔여)
              (b) href async decode → paint 직전 race (1 frame 깜박임)

            본 PR 의 fix:
              - 4 stage sprite 를 <defs> 안의 <symbol> 로 정의 (mount 시
                한 번 decode, 영구 보유).
              - 9 plot 의 <use> 를 항상 mount 시켜놓음 (stage 0 일 때도
                visibility=hidden 으로 숨김, unmount X).
              - stage 변경 시 <use> 의 href + visibility attribute 만
                toggle. DOM node 재생성 없음 → GPU layer cleanup race
                source 자체 제거.
              - <symbol> 안의 image 는 이미 decoded → href swap 시 추가
                decode 없음 → decode race 도 제거.

            정렬: symbol viewBox 100×100 + preserveAspectRatio
              "xMidYMax meet" 가 기존 <image> 의 preserveAspectRatio
              와 동일 효과 (sprite 의 아래쪽 정렬). use 의 x/y/width/
              height 는 기존 image 와 동일하게 polygonBounds 기반.

            PR 히스토리 (참고):
              PR-163: popLayout + exit → PR-179 에서 제거
              PR-195: framer-motion + willChange 제거
              PR-196: HTML <img> overlay 시도 → 좌표 어긋남으로 롤백
              PR-198 (현재): defs + symbol + use — 잔상 근본 fix 시도 */}

        {/* 4 stage sprite 정의 (mount 시 1회 decode, defs 안에서 영구
            보유). use 가 href 로 참조. */}
        <defs>
          {([1, 2, 3, 4] as const).map((s) => {
            const asset = stageAsset(s as CropStage);
            if (!asset) return null;
            return (
              <symbol
                key={s}
                id={`crop-symbol-${s}`}
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMax meet"
              >
                <image
                  href={asset}
                  x={0}
                  y={0}
                  width={100}
                  height={100}
                  preserveAspectRatio="xMidYMax meet"
                />
              </symbol>
            );
          })}
        </defs>

        {plotBounds.map((b) => {
          const stage = stages[b.id];
          const size = b.height * CROP_SIZE_RATIO;
          const x = b.cx - size / 2;
          const y = b.cy - size * 0.75;
          // stage 0 일 때도 element 는 mount 유지, visibility 만 hidden.
          // href 는 안전한 stage 1 reference (보이지 않으므로 무관).
          const visible = stage >= 1 && stage <= 4;
          const refStage = visible ? stage : 1;
          return (
            <use
              key={b.id}
              href={`#crop-symbol-${refStage}`}
              x={x}
              y={y}
              width={size}
              height={size}
              visibility={visible ? "visible" : "hidden"}
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

      {/* R35 — bg 풀화면화 와 함께 aspect-stage 내부로 이동.
          기존: section % 좌표계 → section 크기 변하면 bg 와 어긋남.
          현재: aspect-stage % = bg 자연 좌표 % → bg 아트와 항상 정렬. */}
      <MushroomHouseHitRegion />
      <MushroomHouseEntryLabel />
      </div>

      {/* "하늘 보기" + BGM 빠른 토글 — frosted pill 2개. R35 — 칩 행이
          최상단 (safe-top+8, 높이 36) → 그 아래 행에 sky+BGM 배치.
          ~ safe-top + 52px 정도. */}
      <div
        style={{
          position: "absolute",
          top: "calc(var(--safe-top, 0px) + 52px)",
          left: "50%",
          transform: "translateX(-50%)",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          zIndex: 5,
        }}
      >
        <button
          type="button"
          data-testid="farm-sky-open"
          aria-label="하늘 보기"
          onClick={() => {
            haptic("light");
            setSkyOpen(true);
          }}
          style={pillStyle}
        >
          ☁ 하늘 보기
        </button>
        <BgmQuickToggle />
      </div>

      {/* PR-59 — 활성 buff chips (juice / soup / cake). 잔여시간 +
          progress bar + 탭 시 BuffInfoPopover. 만료 5초 전 깜빡임.
          PR-17a 의 BuffIndicator 폐기 후 본 컴포넌트가 대체. */}
      <BuffChipsRow />

      {/* PR-34 — 농장 드랍 layer. 15~60s 간격으로 sky 영역에 아이템
          spawn. 탭 시 grant + SFX. 일일 max 30. */}
      <FarmDropLayer />

      {/* PR-35 — 히든 토끼 사양 A (가로지름). 5~30분, 5초 통과. 일일 4. */}
      <HiddenBunnyLayer />

      {/* PR-64 — 히든 토끼 사양 B (spot peek). 10~30분, 3초 살짝
          보임. 농장 배경 5 spot. 일일 3. */}
      <HiddenBunnyPeek />

      {/* PR-27 — 자원 부족 광고 안내 모달. cc:ad-suggest:open 이벤트
          listener. 가드 통과 시만 표시. */}
      <AdSuggestionModal />

      {/* Bottom-of-card tool dock. Absolute inside .farm-hub, above
          the help-copy chip. Selecting a tool dispatches the
          cc:tool:selected event read by onPlotClick. */}
      <ToolDock />

      {/* Visitor bunny — 6s pop on mount, dismisses on tap or timeout.
          The only place an idle bunny is allowed on the farm card
          (CLAUDE.md). Sky overlay being open suppresses the visitor so
          it doesn't compete with the sky scene. */}
      <VisitorBunny visible={!skyOpen} />

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

      {/* PR-33 — 보석 사용 5 옵션 모달. cc:gem-trade:open 리스너. */}
      <GemTradeModal />

      {/* R32 PR-184 — 캔디/황금당근 가챠 pity 모달. cc:bunny-pity:open
          리스너. R32 PR-185 의 RewardsPanel "친구 만나기" CTA 가
          dispatch. */}
      <BunnyPityModal />

      {/* R33 PR-191 — 하트 부스트 모달. cc:heart-use:open 리스너.
          R33 PR-192 InventoryModal heart "사용하기" 액션이 dispatch. */}
      <HeartUseModal />

      {/* PR-152 (Round 25) — 데코 v2 MushroomHouseRoom. RewardsPanel
          "🍄 버섯집 들어가기" 카드 + cc:mushroom-house:open 이벤트로
          진입. */}
      <MushroomHouseRoom />

      {/* CollectionPage's FarmView owns the compact header (carrot/plot
          inventory + dogam button). The in-card chips were removed to
          avoid duplication and reclaim vertical space for the plots.
          Carrot/plot state hooks below are still used by the click logic
          and the help copy. */}

      {/* Bottom-center help copy — non-interactive, no timer.
          R28 PHASE 2 — helpCopy 가 empty 면 pill 자체를 렌더 X (planted
          상태는 농장에서 안내 생략). */}
      {helpCopy && (
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
      )}

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

