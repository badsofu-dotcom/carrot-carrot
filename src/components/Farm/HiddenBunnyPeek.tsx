/**
 * HiddenBunnyPeek (PR-64) — 히든 토끼 사양 B.
 *
 * PR-35 의 사양 A (HiddenBunnyLayer) 가 화면 가로지름이라면, B 는
 * 농장 배경의 특정 spot 에 살짝 보임 (3초 fade in/out). 사용자가
 * 짧은 시간 안에 발견-탭 해야 보상.
 *
 * 사양:
 *   - 간격: 10~30 분 random
 *   - 표시 시간: 3 초 (fade-in 0.4 + hold 2.2 + fade-out 0.4)
 *   - 위치: 5 spot 클러스터 (mushroom-house / tree-base / well /
 *     behind-house / behind-tree) random 선택
 *   - 일일 max: 3 (PR-35 의 max 4 와 분리 — 별도 cc.hiddenBunnyPeek
 *     카운터)
 *   - 탭 시 같은 grant 경로: 미획득 → forceUnlock + BunnyGachaModal,
 *     보유 → gem +5
 *
 * 풀: 미획득 캐릭터 우선, 모두 보유 시 전체 풀 (PR-35 와 동일 정책).
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCollectionStore } from "../../features/collection/collectionStore";
import { CHARACTERS } from "../../features/collection/collectionData";
import { useItemsStore } from "../../features/collection/itemsStore";
import { useSoundStore } from "../../store/soundStore";
import { playSfx } from "../../lib/soundFx";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { safeStorage } from "../../lib/safeStorage";

const MIN_INTERVAL_MS = 10 * 60_000; // 10 min
const MAX_INTERVAL_MS = 30 * 60_000; // 30 min
const VISIBLE_MS = 3_000;
const DAILY_CAP = 3;

interface Spot {
  id: string;
  topMin: number;
  topMax: number;
  leftMin: number;
  leftMax: number;
}

const SPOTS: readonly Spot[] = [
  { id: "mushroom-house", topMin: 75, topMax: 85, leftMin: 8, leftMax: 22 },
  { id: "tree-base", topMin: 70, topMax: 82, leftMin: 78, leftMax: 92 },
  { id: "well", topMin: 55, topMax: 65, leftMin: 8, leftMax: 20 },
  { id: "behind-house", topMin: 52, topMax: 62, leftMin: 28, leftMax: 42 },
  { id: "behind-tree", topMin: 58, topMax: 68, leftMin: 70, leftMax: 82 },
];

function pickSpot(): Spot {
  return SPOTS[Math.floor(Math.random() * SPOTS.length)]!;
}

function kstDayKey(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}
const KEY_COUNT = (d: string) => `cc.hiddenBunnyPeek.dailyCount.${d}`;
function readCount(d: string): number {
  const raw = safeStorage.get(KEY_COUNT(d));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function writeCount(d: string, n: number): void {
  try {
    safeStorage.set(KEY_COUNT(d), String(n));
  } catch {
    /* ignore */
  }
}

interface ActivePeek {
  id: number;
  characterId: string;
  topPct: number;
  leftPct: number;
}

export function HiddenBunnyPeek() {
  const [peek, setPeek] = useState<ActivePeek | null>(null);
  const idCounter = useRef(0);
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const owned = useCollectionStore((s) => s.ownedCharacters);
  const forceUnlock = useCollectionStore((s) => s.forceUnlock);
  const addItem = useItemsStore((s) => s.add);

  const clearSpawn = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    spawnTimer.current = null;
  };

  const scheduleNext = () => {
    clearSpawn();
    const delay =
      MIN_INTERVAL_MS +
      Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS));
    spawnTimer.current = setTimeout(spawn, delay);
  };

  const pickCharacterId = (): string | null => {
    const unowned = CHARACTERS.filter((c) => !owned.includes(c.id));
    const pool = unowned.length > 0 ? unowned : CHARACTERS;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)]?.id ?? null;
  };

  const spawn = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    const day = kstDayKey();
    if (readCount(day) >= DAILY_CAP) {
      scheduleNext();
      return;
    }
    const cid = pickCharacterId();
    if (!cid) return;
    const spot = pickSpot();
    const top = spot.topMin + Math.random() * (spot.topMax - spot.topMin);
    const left = spot.leftMin + Math.random() * (spot.leftMax - spot.leftMin);
    const id = ++idCounter.current;
    setPeek({ id, characterId: cid, topPct: top, leftPct: left });
    setTimeout(() => {
      setPeek((cur) => (cur?.id === id ? null : cur));
      scheduleNext();
    }, VISIBLE_MS);
  };

  const onTap = (active: ActivePeek) => {
    haptic("success");
    const s = useSoundStore.getState();
    playSfx("bunny", { muted: s.sfxMuted, masterVolume: s.sfxVolume });
    const day = kstDayKey();
    writeCount(day, readCount(day) + 1);
    if (!owned.includes(active.characterId)) {
      const unlocked = forceUnlock(active.characterId);
      if (unlocked) {
        try {
          window.dispatchEvent(
            new CustomEvent("cc:bunny-gacha:show", {
              detail: { bunnyId: unlocked },
            }),
          );
        } catch {
          /* SSR */
        }
        toast("🌿 숨어있던 토끼 발견! 도감 unlock");
      }
    } else {
      addItem("gem", 5);
      toast("🌿 숨은 토끼 — 이미 보유 (보석 +5)");
    }
    setPeek(null);
  };

  useEffect(() => {
    scheduleNext();
    const onVisible = () => {
      if (document.hidden) clearSpawn();
      else if (!peek) scheduleNext();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearSpawn();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer driven
  }, []);

  return (
    <AnimatePresence>
      {peek && (
        <motion.button
          type="button"
          key={peek.id}
          data-testid="hidden-bunny-peek"
          aria-label="숨어있는 토끼 — 탭하면 unlock"
          onClick={() => onTap(peek)}
          initial={{ opacity: 0, scale: 0.6, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 6 }}
          transition={{
            duration: 0.4,
            ease: "easeOut",
          }}
          style={{
            position: "absolute",
            top: `${peek.topPct}%`,
            left: `${peek.leftPct}%`,
            width: 44,
            height: 44,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            zIndex: 7,
            filter:
              "drop-shadow(0 3px 8px rgba(160,120,80,0.55)) drop-shadow(0 0 12px rgba(255,210,140,0.4))",
            fontSize: 32,
            lineHeight: 1,
          }}
        >
          <span aria-hidden>🐰</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
