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
import { useNotificationsStore } from "../../features/notifications/notificationsStore";
import { notify } from "../../lib/webNotify";
import {
  isFocusBlackout,
  pushSuppressedDrop,
  type SuppressibleKind,
} from "../../lib/notify/focusGate";
import { kstDayKey } from "../../lib/kst";
import { useFarmStore } from "../../features/collection/farmStore";
import { useSoundStore } from "../../store/soundStore";
import { playSfx } from "../../lib/soundFx";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { safeStorage, safeSessionStorage } from "../../lib/safeStorage";

const BASE: string =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

// PR-112 — DROPS table 을 lib/farm/farmDropTable.ts 로 추출 (single
// SoT + 테스트 가능). 본 컴포넌트는 import 만.
import {
  FARM_DROPS as DROPS,
  pickDrop,
  type DropSpec,
} from "../../lib/farm/farmDropTable";
void DROPS;

// PR-142 (Round 21 베타7): spawn interval 2배 — 사용자가 "너무 잦다"
// 보고. 15-60s → 30-120s 로 평균 약 50% 감소. DAILY_CAP (12) 는 가치
// 보존을 위해 그대로 (cap 도 줄이면 interval 늘림 효과를 cap 이 또
// 가둠 → 빈도만 줄이고 천장은 유지).
const MIN_SPAWN_MS = 30_000;
const MAX_SPAWN_MS = 120_000;
const DAILY_CAP = 12; // PR-47: 30 → 12 (가치 보존)
const CONCURRENT_CAP = 3; // PR-47: 동시 표시 max 3
const SESSION_STORE_KEY = "cc.farmDrop.active.v1"; // PR-47 persistence

// PR-45 — 드랍 spawn 위치 클러스터. 산 라인 아래 (top ≥ 45%) 의
// 농장 활동 영역. 각 클러스터에 weight + (top%/left%) 박스 정의.
// 사용자가 농장 BG 의 자연스러운 spot 에 떨어진 듯한 느낌.
interface SpotCluster {
  id: string;
  weight: number;
  topMin: number;
  topMax: number;
  leftMin: number;
  leftMax: number;
}
const SPOT_CLUSTERS: readonly SpotCluster[] = [
  // plot 영역 사이 (울타리 안) — 가장 흔함.
  { id: "fence-inside", weight: 30, topMin: 60, topMax: 70, leftMin: 25, leftMax: 75 },
  // 울타리 바깥 잔디 — 두 번째.
  { id: "fence-outside", weight: 25, topMin: 70, topMax: 85, leftMin: 10, leftMax: 90 },
  // 버섯집 (좌측 하단 코너 영역) 주변.
  { id: "mushroom-house", weight: 15, topMin: 75, topMax: 85, leftMin: 8, leftMax: 22 },
  // 나무 (우측 하단) 밑.
  { id: "tree-base", weight: 15, topMin: 70, topMax: 82, leftMin: 78, leftMax: 92 },
  // 우물 (좌측 중간) 근처.
  { id: "well", weight: 10, topMin: 55, topMax: 65, leftMin: 8, leftMax: 20 },
  // 어디든 낮은 영역 (fallback).
  { id: "random-low", weight: 5, topMin: 45, topMax: 85, leftMin: 10, leftMax: 90 },
];
const SPOT_TOTAL_WEIGHT = SPOT_CLUSTERS.reduce((s, c) => s + c.weight, 0);

function pickSpot(rng: () => number): SpotCluster {
  const r = rng() * SPOT_TOTAL_WEIGHT;
  let acc = 0;
  for (const c of SPOT_CLUSTERS) {
    acc += c.weight;
    if (r < acc) return c;
  }
  return SPOT_CLUSTERS[0]!;
}

// PR-102 — kstDayKey 단일 helper 사용 (lib/kst.ts).
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

// PR-47 — 동시 다수 표시 + sessionStorage persistence 위해 spec 자체
// 대신 kindIdx 보관 (직렬화 안전). DropSpec 은 closure 에서 lookup.
interface ActiveDrop {
  id: number;
  kindIdx: number;
  topPct: number;
  leftPct: number;
}

interface PersistedState {
  day: string;
  nextId: number;
  drops: ActiveDrop[];
}

// PR-47 — safeSessionStorage (iframe-safe shim) 사용. dist-preview 에
// 리터럴 sessionStorage 토큰을 노출하지 않음 (PR-13 의 금지토큰 정책).
function loadPersisted(): PersistedState | null {
  try {
    const raw = safeSessionStorage.get(SESSION_STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PersistedState>;
    if (typeof v.day !== "string" || !Array.isArray(v.drops)) return null;
    return {
      day: v.day,
      nextId: typeof v.nextId === "number" ? v.nextId : 0,
      drops: v.drops as ActiveDrop[],
    };
  } catch {
    return null;
  }
}

function savePersisted(state: PersistedState): void {
  try {
    safeSessionStorage.set(SESSION_STORE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function FarmDropLayer() {
  const [drops, setDrops] = useState<ActiveDrop[]>(() => {
    const persisted = loadPersisted();
    if (!persisted) return [];
    if (persisted.day !== kstDayKey()) return [];
    return persisted.drops;
  });
  const idCounter = useRef(0);
  // 초기 id counter — persisted 의 nextId 가 있으면 그걸로.
  useEffect(() => {
    const p = loadPersisted();
    if (p && p.day === kstDayKey()) idCounter.current = p.nextId;
  }, []);
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addItem = useItemsStore((s) => s.add);
  const incGolden = useFarmStore((s) => s.incGoldenCarrots);

  const playDropSfx = () => {
    const s = useSoundStore.getState();
    playSfx("giftbox", { muted: s.sfxMuted, masterVolume: s.sfxVolume });
  };

  const persist = (nextDrops: ActiveDrop[]) => {
    savePersisted({
      day: kstDayKey(),
      nextId: idCounter.current,
      drops: nextDrops,
    });
  };

  const clearTimers = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    spawnTimer.current = null;
  };

  const scheduleNext = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    const delay =
      MIN_SPAWN_MS + Math.floor(Math.random() * (MAX_SPAWN_MS - MIN_SPAWN_MS));
    spawnTimer.current = setTimeout(spawn, delay);
  };

  const spawn = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    const day = kstDayKey();
    if (readCount(day) >= DAILY_CAP) {
      scheduleNext();
      return;
    }
    setDrops((cur) => {
      if (cur.length >= CONCURRENT_CAP) {
        scheduleNext();
        return cur;
      }
      const spec = pickDrop(Math.random);
      const cluster = pickSpot(Math.random);
      const top =
        cluster.topMin + Math.random() * (cluster.topMax - cluster.topMin);
      const left =
        cluster.leftMin + Math.random() * (cluster.leftMax - cluster.leftMin);
      const kindIdx = DROPS.indexOf(spec);
      idCounter.current += 1;
      const newDrop: ActiveDrop = {
        id: idCounter.current,
        kindIdx,
        topPct: top,
        leftPct: left,
      };
      const next = [...cur, newDrop];
      persist(next);
      // PR-53 — drop spawn 시 알림.
      // PR-74 — 홈(/) 에서 집중 중일 때는 suppress + 큐에 누적. 타이머
      // DONE 또는 농장 진입 시 batch 메시지로 한 번에 표시.
      const notifStore = useNotificationsStore.getState();
      if (isFocusBlackout()) {
        pushSuppressedDrop(spec.kind as SuppressibleKind);
      } else if (notifStore.shouldNotify("drop")) {
        notify({
          kind: "drop",
          title: "🌟 농장에 뭔가 떨어졌어요",
          body: spec.toast,
        });
      }
      scheduleNext();
      return next;
    });
  };

  const grant = (active: ActiveDrop) => {
    const spec = DROPS[active.kindIdx];
    if (!spec) return;
    const day = kstDayKey();
    writeCount(day, readCount(day) + 1);
    haptic("success");
    playDropSfx();
    const k = spec.kind;
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
      case "candy":
        // PR-109 — seed slot → candy 흡수. candy = 5 P 직접 grant.
        useFarmStore.getState().incCandyCarrots(1);
        break;
      case "golden":
        incGolden(1);
        break;
      case "hidden_bunny":
        addItem("gem", 5);
        break;
    }
    toast(spec.toast);
    setDrops((cur) => {
      const next = cur.filter((d) => d.id !== active.id);
      persist(next);
      return next;
    });
  };

  useEffect(() => {
    scheduleNext();
    const onVisible = () => {
      if (document.hidden) {
        clearTimers();
      } else {
        // KST 자정 넘어갔으면 모든 drops 폐기 (다른 날 데이터).
        const persisted = loadPersisted();
        if (persisted && persisted.day !== kstDayKey()) {
          setDrops([]);
          idCounter.current = 0;
          savePersisted({ day: kstDayKey(), nextId: 0, drops: [] });
        }
        scheduleNext();
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
      {drops.map((d) => {
        const spec = DROPS[d.kindIdx];
        if (!spec) return null;
        return (
          <DropSprite key={d.id} drop={d} spec={spec} onTap={() => grant(d)} />
        );
      })}
    </AnimatePresence>
  );
}

/**
 * 개별 drop sprite (PR-46 강화).
 *
 * 시각 효과:
 *   - entrance: scale 0 → 1.2 → 1 bounce + opacity 0 → 1
 *   - idle float: y [0, -6, 0] loop 2.4s ease-in-out (조용한 둥둥)
 *   - backdrop: 큰 radial-gradient 빛 ray (88 × 88)
 *   - sparkles: 5 별 (★) 회전 + opacity pulse (4s linear rotate +
 *     2s pulse). 위치는 32 px radius 원주에 균등 배치.
 *   - tap target: 48 × 48 (효과 노드들 포함). 효과 노드 pointerEvents
 *     none — 클릭은 button 캡처.
 *
 * 성능: framer-motion 의 transform/opacity 만 사용 (compositor-cheap).
 * 5 sparkle × 1 backdrop + icon 의 1 float wrapper = ~7 노드/drop.
 * 동시 3 drop 의 최대 21 노드 — 모바일 WebView 안전.
 */
function DropSprite({
  drop,
  spec,
  onTap,
}: {
  drop: ActiveDrop;
  spec: DropSpec;
  onTap: () => void;
}) {
  const SPARKLE_COUNT = 5;
  const SPARKLE_RADIUS = 32; // px from center
  return (
    <motion.button
      type="button"
      data-testid={`farm-drop-${spec.kind}`}
      aria-label={spec.toast.replace(/^[^\s]+\s/, "")}
      onClick={onTap}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: [0, 1.2, 1] }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{
        opacity: { duration: 0.2 },
        scale: {
          times: [0, 0.6, 1],
          duration: 0.45,
          ease: "easeOut",
        },
      }}
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
        background: "transparent",
        cursor: "pointer",
        padding: 0,
        zIndex: 6,
        // transform-origin 중심으로 scale entrance 자연스러움.
        transformOrigin: "center center",
      }}
    >
      {/* (5) 큰 backdrop ray — radial-gradient warm halo, 클릭 무관. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: -20,
          background:
            "radial-gradient(circle, rgba(255,236,170,0.65) 0%, rgba(255,210,140,0.35) 45%, rgba(255,200,100,0) 75%)",
          borderRadius: "50%",
          pointerEvents: "none",
          filter: "blur(2px)",
        }}
      />

      {/* (2) 둥둥 떠있는 wrapper — 아이콘만 y 진동. SVG/PNG 둘 다 OK. */}
      <motion.span
        aria-hidden
        animate={{ y: [0, -6, 0] }}
        transition={{
          repeat: Infinity,
          duration: 2.4,
          ease: "easeInOut",
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          filter:
            "drop-shadow(0 2px 6px rgba(0,0,0,0.22)) drop-shadow(0 0 10px rgba(255,200,100,0.7))",
          pointerEvents: "none",
        }}
      >
        {spec.iconRel ? (
          <img
            src={`${BASE}${spec.iconRel}`}
            alt=""
            draggable={false}
            style={{
              width: 36,
              height: 36,
              maxWidth: 36,
              maxHeight: 36,
              objectFit: "contain",
            }}
          />
        ) : (
          <span aria-hidden style={{ fontSize: 28 }}>
            {spec.emoji}
          </span>
        )}
      </motion.span>

      {/* (1) sparkle 별 회전 — 5 ★ 균등 배치. 각 별: 천천히 회전 + opacity pulse. */}
      {Array.from({ length: SPARKLE_COUNT }).map((_, i) => {
        const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
        const x = Math.cos(angle) * SPARKLE_RADIUS;
        const y = Math.sin(angle) * SPARKLE_RADIUS;
        return (
          <motion.span
            key={i}
            aria-hidden
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.7, 1.1, 0.7],
              rotate: [0, 360],
            }}
            transition={{
              opacity: {
                repeat: Infinity,
                duration: 2,
                delay: i * 0.18,
                ease: "easeInOut",
              },
              scale: {
                repeat: Infinity,
                duration: 2,
                delay: i * 0.18,
                ease: "easeInOut",
              },
              rotate: {
                repeat: Infinity,
                duration: 4,
                ease: "linear",
              },
            }}
            style={{
              position: "absolute",
              left: `calc(50% + ${x}px - 6px)`,
              top: `calc(50% + ${y}px - 6px)`,
              width: 12,
              height: 12,
              fontSize: 11,
              lineHeight: 1,
              color: i % 2 === 0 ? "#fff7cf" : "#ffe48a",
              textShadow: "0 0 4px rgba(255,230,150,0.85)",
              pointerEvents: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ★
          </motion.span>
        );
      })}
    </motion.button>
  );
}
