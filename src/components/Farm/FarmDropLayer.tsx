/**
 * FarmDropLayer (PR-34) — 농장 화면에 간헐적으로 보석 / 도구 / 자원
 * 아이템이 떨어져 사용자가 탭해서 줍는 체류 유도 메커닉.
 *
 * 레퍼런스: 햄스터 콤뱃 탭-수익 / 애니멀크로싱 풍선·조개 / 하이데이
 * 새·벌 NPC. "잠시 자리 비우지 마세요" 시그널.
 *
 * 사양:
 *   - 15~60 초 random 간격으로 아이템 spawn
 *   - 동시 max 1 개 (UI 부담 회피)
 *   - 5 초 표시 후 fadeout 사라짐 (놓치면 못 받음)
 *   - 농장 plot 영역 외 (상단 sky 영역) random %
 *   - 탭 시 grant + SFX + haptic + toast
 *   - visibility:hidden 시 spawn 정지
 *   - 일일 max 30 drops (KST 리셋, anti-abuse)
 *
 * Drop 가중치 (raw, 합 92, 8% no-drop 가능):
 *   gem 25 / bolt 20 / heart 15 / hourglass 10 / juice 5 / soup 5 /
 *   cake 5 / seed 5 / golden 1 / hidden_bunny 1
 *
 * 히든 토끼 (hidden_bunny) 는 PR-35 에서 도감 unlock 경로 wire 됨.
 * 본 PR 은 placeholder grant (보석 +5) + 별도 토스트.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useItemsStore } from "../../features/collection/itemsStore";
import { useFarmStore } from "../../features/collection/farmStore";
import { useSoundStore } from "../../store/soundStore";
import { playSfx } from "../../lib/soundFx";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { safeStorage } from "../../lib/safeStorage";

const BASE: string =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

type DropKind =
  | "gem"
  | "bolt"
  | "heart"
  | "hourglass"
  | "juice"
  | "soup"
  | "cake"
  | "seed"
  | "golden"
  | "hidden_bunny";

interface DropSpec {
  kind: DropKind;
  weight: number;
  emoji: string;
  /** PNG path under BASE; fallback to emoji if missing. */
  iconRel?: string;
  /** Toast text when grant succeeds. */
  toast: string;
}

const DROPS: readonly DropSpec[] = [
  {
    kind: "gem",
    weight: 25,
    emoji: "💎",
    iconRel: "assets/farm/icons/icon_gem.png",
    toast: "💎 보석 +1",
  },
  {
    kind: "bolt",
    weight: 20,
    emoji: "⚡",
    iconRel: "assets/farm/icons/icon_energy.png",
    toast: "⚡ 번개 +1",
  },
  {
    kind: "heart",
    weight: 15,
    emoji: "🩷",
    iconRel: "assets/farm/icons/icon_heart_hp.png",
    toast: "🩷 하트 +1",
  },
  {
    kind: "hourglass",
    weight: 10,
    emoji: "⏳",
    iconRel: "assets/farm/icons/icon_timer.png",
    toast: "⏳ 모래시계 +1",
  },
  {
    kind: "juice",
    weight: 5,
    emoji: "🥤",
    iconRel: "assets/farm/foods/food_carrot_juice.png",
    toast: "🥤 주스 +1",
  },
  {
    kind: "soup",
    weight: 5,
    emoji: "🍲",
    iconRel: "assets/farm/foods/food_carrot_soup.png",
    toast: "🍲 수프 +1",
  },
  {
    kind: "cake",
    weight: 5,
    emoji: "🍰",
    iconRel: "assets/farm/foods/food_carrot_cake.png",
    toast: "🍰 케이크 +1",
  },
  {
    kind: "seed",
    weight: 5,
    emoji: "🌱",
    iconRel: "assets/farm/crops/crop_stage1_seed.webp",
    toast: "🌱 씨앗 +1",
  },
  {
    kind: "golden",
    weight: 1,
    emoji: "✨",
    iconRel: "assets/farm/currency/golden_carrot.png",
    toast: "✨ 황금당근 +1 (+10 P)",
  },
  {
    kind: "hidden_bunny",
    weight: 1,
    emoji: "🐰",
    // PR-35 가 실제 토끼 unlock 경로 wire. 본 PR 은 보석 +5 보너스로 대체.
    toast: "🐰 히든 토끼! 보석 +5 보너스",
  },
];

const TOTAL_WEIGHT = DROPS.reduce((s, d) => s + d.weight, 0);

function pickDrop(rng: () => number): DropSpec {
  const r = rng() * TOTAL_WEIGHT;
  let acc = 0;
  for (const d of DROPS) {
    acc += d.weight;
    if (r < acc) return d;
  }
  return DROPS[0]!; // unreachable
}

const MIN_SPAWN_MS = 15_000;
const MAX_SPAWN_MS = 60_000;
const VISIBLE_MS = 5_000;
const DAILY_CAP = 30;

function kstDayKey(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}
const STORAGE_COUNT_KEY = (day: string) => `cc.farmDrop.dailyCount.${day}`;

function readCount(day: string): number {
  const raw = safeStorage.get(STORAGE_COUNT_KEY(day));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function writeCount(day: string, n: number): void {
  try {
    safeStorage.set(STORAGE_COUNT_KEY(day), String(n));
  } catch {
    /* ignore */
  }
}

interface ActiveDrop {
  id: number;
  spec: DropSpec;
  topPct: number;
  leftPct: number;
}

export function FarmDropLayer() {
  const [drop, setDrop] = useState<ActiveDrop | null>(null);
  const idCounter = useRef(0);
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addItem = useItemsStore((s) => s.add);
  const incGolden = useFarmStore((s) => s.incGoldenCarrots);
  const growAllPlanted = useFarmStore((s) => s.growAllPlanted);

  // SFX 호출용 — getState 로 1회 dispatch 시 read.
  const playDropSfx = () => {
    const s = useSoundStore.getState();
    playSfx("giftbox", { muted: s.sfxMuted, masterVolume: s.sfxVolume });
  };

  const clearTimers = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    spawnTimer.current = null;
    fadeTimer.current = null;
  };

  const scheduleNext = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    const delay =
      MIN_SPAWN_MS + Math.floor(Math.random() * (MAX_SPAWN_MS - MIN_SPAWN_MS));
    spawnTimer.current = setTimeout(spawn, delay);
  };

  const spawn = () => {
    if (typeof document !== "undefined" && document.hidden) {
      // tab 숨겨졌으면 visibilitychange 가 재가동
      return;
    }
    const day = kstDayKey();
    if (readCount(day) >= DAILY_CAP) {
      // 일일 한도 초과 — 다음 KST 자정까지 spawn 정지. 다음 visible
      // 또는 자정 후 visibilitychange 가 다시 try.
      scheduleNext();
      return;
    }
    const spec = pickDrop(Math.random);
    // Safe zone — 상단 sky 영역 (top 12-25%) + horizontal 15-85%.
    // plot 영역 침범 방지.
    const top = 12 + Math.random() * 13;
    const left = 15 + Math.random() * 70;
    const id = ++idCounter.current;
    setDrop({ id, spec, topPct: top, leftPct: left });
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => {
      setDrop((cur) => (cur?.id === id ? null : cur));
      scheduleNext();
    }, VISIBLE_MS);
  };

  const grant = (active: ActiveDrop) => {
    const day = kstDayKey();
    writeCount(day, readCount(day) + 1);
    haptic("success");
    playDropSfx();
    const k = active.spec.kind;
    switch (k) {
      case "gem":
      case "bolt":
      case "heart":
      case "hourglass":
      case "juice":
      case "soup":
      case "cake":
        addItem(k, 1);
        break;
      case "seed":
        growAllPlanted(0, null, 1);
        break;
      case "golden":
        incGolden(1);
        break;
      case "hidden_bunny":
        // PR-35 가 실제 unlock 경로 wire. 본 PR 은 +5 gem 보너스로 대체.
        addItem("gem", 5);
        break;
    }
    toast(active.spec.toast);
    setDrop(null);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    scheduleNext();
  };

  useEffect(() => {
    // mount: 첫 spawn 예약 (즉시 X — 사용자가 화면 진입 후 자연스럽게)
    scheduleNext();
    const onVisible = () => {
      if (document.hidden) {
        clearTimers();
      } else {
        // 다시 보이면 spawn 재개. drop 이 활성 상태면 fade timer 재예약.
        if (!drop) scheduleNext();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimers();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: timer driven
  }, []);

  return (
    <AnimatePresence>
      {drop && (
        <motion.button
          type="button"
          key={drop.id}
          data-testid={`farm-drop-${drop.spec.kind}`}
          aria-label={drop.spec.toast.replace(/^[^\s]+\s/, "")}
          onClick={() => grant(drop)}
          initial={{ opacity: 0, scale: 0.5, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 10 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          style={{
            position: "absolute",
            top: `${drop.topPct}%`,
            left: `${drop.leftPct}%`,
            width: 48,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 60%, rgba(255,255,255,0) 100%)",
            cursor: "pointer",
            padding: 0,
            zIndex: 6,
            filter:
              "drop-shadow(0 2px 6px rgba(0,0,0,0.18)) drop-shadow(0 0 12px rgba(255,200,100,0.45))",
          }}
        >
          {drop.spec.iconRel ? (
            <img
              src={`${BASE}${drop.spec.iconRel}`}
              alt=""
              draggable={false}
              style={{
                width: 36,
                height: 36,
                objectFit: "contain",
              }}
            />
          ) : (
            <span aria-hidden style={{ fontSize: 28 }}>
              {drop.spec.emoji}
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
