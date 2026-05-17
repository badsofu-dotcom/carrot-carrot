/**
 * HiddenBunnyLayer (PR-35) — 도감 토끼 농장 등장 메커닉.
 *
 * 5~30 분 random 간격으로 화면 가로지름 (오른쪽→왼쪽). 5 초 동안
 * 화면 폭 전체 통과. 탭하면:
 *   - 미획득 토끼: forceUnlock + cc:bunny-gacha:show (BunnyGachaModal
 *     surface). 큰 보상 — 도감 unlock 이 가장 값짐.
 *   - 이미 획득 토끼: 보석 +5 (소량 보너스).
 *
 * 시간대 / 시즌별 다른 토끼 등장은 v1 단순화: 모든 미획득 캐릭터에서
 * 균등 random. 향후 시즈널 풀 도입 시 확장.
 *
 * 사양 A (random 등장) 만 구현. 사양 B (히든 스팟) 는 follow-up.
 * 등장 간격 5~30 분은 데모 / 데일리 액티브 균형 — 사용자 spec
 * 1~8 시간은 prod 데이터로 튜닝 권장.
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
import { kstDayKey } from "../../lib/kst";
import { safeStorage } from "../../lib/safeStorage";

const MIN_INTERVAL_MS = 5 * 60_000; // 5 min
const MAX_INTERVAL_MS = 30 * 60_000; // 30 min
const CROSS_DURATION_MS = 5_000;
const DAILY_CAP = 4; // 너무 흔하지 않게

const KEY_COUNT = (d: string) => `cc.hiddenBunny.dailyCount.${d}`;

function readCount(day: string): number {
  const raw = safeStorage.get(KEY_COUNT(day));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function writeCount(day: string, n: number): void {
  try {
    safeStorage.set(KEY_COUNT(day), String(n));
  } catch {
    /* ignore */
  }
}

interface ActiveBunny {
  id: number;
  characterId: string;
  topPct: number;
  direction: "ltr" | "rtl";
}

export function HiddenBunnyLayer() {
  const [bunny, setBunny] = useState<ActiveBunny | null>(null);
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
    // 미획득 우선 → 모두 보유면 임의 캐릭터.
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
    const id = ++idCounter.current;
    const direction: "ltr" | "rtl" = Math.random() < 0.5 ? "ltr" : "rtl";
    const top = 30 + Math.random() * 25; // 30-55% (plot 영역 상단 ~ 중간)
    setBunny({ id, characterId: cid, topPct: top, direction });
    // animationEnd 이벤트 대신 setTimeout 으로 unmount 시점 보장
    setTimeout(() => {
      setBunny((cur) => (cur?.id === id ? null : cur));
      scheduleNext();
    }, CROSS_DURATION_MS);
  };

  const onTap = (active: ActiveBunny) => {
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
        toast("🐰 히든 토끼 발견! 도감 unlock");
      }
    } else {
      addItem("gem", 5);
      toast("🐰 히든 토끼 — 이미 보유 (보석 +5)");
    }
    setBunny(null);
  };

  useEffect(() => {
    scheduleNext();
    const onVisible = () => {
      if (document.hidden) clearSpawn();
      else if (!bunny) scheduleNext();
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
      {bunny && (
        <motion.button
          type="button"
          key={bunny.id}
          data-testid="hidden-bunny"
          aria-label="히든 토끼 — 탭하면 도감 unlock"
          onClick={() => onTap(bunny)}
          initial={{
            x: bunny.direction === "ltr" ? "-10vw" : "110vw",
            opacity: 0,
          }}
          animate={{
            x: bunny.direction === "ltr" ? "110vw" : "-10vw",
            opacity: 1,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: CROSS_DURATION_MS / 1000, ease: "linear" }}
          style={{
            position: "absolute",
            top: `${bunny.topPct}%`,
            left: 0,
            width: 64,
            height: 64,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            zIndex: 7,
            filter:
              "drop-shadow(0 4px 10px rgba(255,180,120,0.55)) drop-shadow(0 0 16px rgba(255,200,100,0.35))",
            fontSize: 48,
            lineHeight: 1,
          }}
        >
          <span aria-hidden>🐰</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
