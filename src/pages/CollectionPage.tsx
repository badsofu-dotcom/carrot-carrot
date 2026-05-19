import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bunny } from "../components/Bunny";
import { bunnyImages } from "../assets/characters";
import {
  BottomSheet,
  Button,
  Card,
  Chip,
  ProgressRing,
  toast,
} from "../design-system/ui";
import { haptic } from "../design-system/haptic";
import { FarmHub } from "../features/collection/FarmHub";
import { useFarmStore } from "../features/collection/farmStore";
import { FarmOnboarding } from "../features/collection/FarmOnboarding";
import { RewardsPanel } from "../components/Farm/RewardsPanel";
import { InventoryModal } from "../components/Inventory/InventoryModal";
import { useRewardsStore, WEEKLY_TREASURE_GOAL } from "../features/collection/rewardsStore";
import { AchievementsCard } from "../features/collection/AchievementsCard";
import { useSoundStore } from "../store/soundStore";
import { bgmEngine, consumeFirstVisit } from "../lib/bgmEngine";
import { playSfx } from "../lib/soundFx";
import {
  RARITY_COLOR,
  RARITY_LABEL,
  SLOTS,
  TOTAL_SLOTS,
  DOGAM_TOTAL,
  type CharacterDef,
  type Rarity,
  type SlotDef,
} from "../features/collection/collectionData";
import {
  useCollectionStore,
  useOwnedByRarity,
  useOwnedSet,
} from "../features/collection/collectionStore";
// PR-132 (Round 18) — daily/weekly mission cards moved off HomePage.
// PR-136 (Round 19) — and then moved again from inline farm cards
// into a 🎯 BottomSheet so the 9-plot field gets its space back.
// useTimerStore-based forceCollapsed is no longer needed (the sheet
// itself is the user intent; cards stay expanded inside).
import { MissionsSheet } from "../features/missions/MissionsSheet";
import { useMissionsStore } from "../features/missions/missionsStore";
import { useWeeklyMissionsStore } from "../features/missions/weeklyMissionsStore";
import { useTimerStore } from "../store/timerStore";
// PR-152 (Round 25) — 데코 v1 archive. useDogamRewardGrant 호출 제거
// (golden_carrot_statue 보상 시스템 자체가 v1, 사용자 폐기 결정).
// v2 가구 지급 트리거는 R26 에서 결정.

const ALL_FILTERS: ("all" | Rarity)[] = [
  "all",
  "common",
  "rare",
  "sr",
  "ssr",
  "legendary",
];

interface DisplaySlot extends SlotDef {
  obtained: boolean;
  obtainedAt?: string;
}

export function CollectionPage() {
  const ownedSet = useOwnedSet();
  const ownedAt = useCollectionStore((s) => s.ownedAt);
  const ownedByRarity = useOwnedByRarity();

  const slots: DisplaySlot[] = useMemo(
    () =>
      SLOTS.map((sl) => {
        const obtained =
          !!sl.character && ownedSet.has(sl.character.id);
        return {
          ...sl,
          obtained,
          obtainedAt:
            obtained && sl.character ? ownedAt[sl.character.id] : undefined,
        };
      }),
    [ownedSet, ownedAt],
  );

  const [filter, setFilter] = useState<(typeof ALL_FILTERS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 농장 hub vs 기존 도감 그리드. 기본값은 농장 hub.
  const [view, setView] = useState<"farm" | "dogam">("farm");

  const filtered = filter === "all" ? slots : slots.filter((s) => s.rarity === filter);
  const obtainedCount = ownedSet.size;
  // PR-127 (Round 16): denominator is DOGAM_TOTAL (the number of real,
  // unlockable characters — 12). The remaining TOTAL_SLOTS − DOGAM_TOTAL
  // are "coming soon" placeholders and shouldn't dilute the progress
  // percentage. Clamp to 1 in case future tooling unlocks beyond the
  // designated set.
  const progress = Math.min(1, obtainedCount / DOGAM_TOTAL);
  const comingSoonCount = TOTAL_SLOTS - DOGAM_TOTAL;

  const selected = selectedId ? slots.find((s) => s.id === selectedId) : null;

  if (view === "farm") {
    return <FarmView
      onOpenDogam={() => { haptic("light"); setView("dogam"); }}
      obtainedCount={obtainedCount}
    />;
  }

  return (
    <main
      className="app-screen"
      data-testid="page-collection"
      style={{ paddingTop: 24 }}
    >
      <header
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => {
            haptic("light");
            setView("farm");
          }}
          aria-label="농장으로 돌아가기"
          data-testid="dogam-back-to-farm"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 999,
            border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
            background: "var(--surface-1, #fff)",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M15 6l-6 6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div>
          <p className="t-micro" style={{ marginBottom: 6 }}>
            나의 도감
          </p>
          <h1 className="t-display" style={{ margin: 0 }}>
            토끼 도감
          </h1>
        </div>
      </header>

      {/* Progress card */}
      <Card
        elevated
        padded
        style={{
          marginBottom: 18,
          display: "flex",
          gap: 16,
          alignItems: "center",
          background: "var(--gradient-mesh)",
          borderRadius: 26,
        }}
      >
        <ProgressRing
          size={92}
          stroke={9}
          progress={progress}
          color="var(--accent-carrot)"
          ariaLabel={`수집 진행률 ${Math.round(progress * 100)}%`}
        >
          <div style={{ textAlign: "center" }}>
            <div
              className="t-display-num"
              style={{ fontSize: 24, color: "var(--text-primary)" }}
            >
              {obtainedCount}
            </div>
            <div
              className="t-micro"
              style={{ marginTop: 2, color: "var(--text-tertiary)" }}
            >
              / {DOGAM_TOTAL}
            </div>
          </div>
        </ProgressRing>
        <div style={{ flex: 1 }}>
          <p className="t-micro" style={{ margin: 0, marginBottom: 4 }}>
            수집 진행
          </p>
          <h2 className="t-h2" style={{ margin: 0, marginBottom: 4 }}>
            {obtainedCount} / {DOGAM_TOTAL} 마리
          </h2>
          <p
            className="t-micro"
            style={{
              margin: 0,
              marginBottom: 6,
              color: "var(--text-tertiary)",
            }}
          >
            +{comingSoonCount} 칸은 곧 추가돼요
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["legendary", "ssr", "sr", "rare"] as Rarity[]).map((r) => {
              const count = ownedByRarity[r];
              if (count === 0) return null;
              return (
                <span
                  key={r}
                  className="t-micro"
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    background:
                      "color-mix(in oklab, " +
                      RARITY_COLOR[r] +
                      " 15%, transparent)",
                    color: RARITY_COLOR[r],
                    border: `1px solid ${RARITY_COLOR[r]}40`,
                  }}
                >
                  {RARITY_LABEL[r]} {count}
                </span>
              );
            })}
          </div>
        </div>
      </Card>

      {/* PR-26 — 도전 과제 (구 RewardsPanel 훈장 섹션). 도감 페이지의
          진행도 카드 바로 아래에 자연스럽게 자리. RewardsPanel 은
          광고/포인트 허브로 재정의. */}
      <AchievementsCard />

      {/* Filter chips */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 6,
          marginBottom: 14,
          marginInline: -4,
          paddingInline: 4,
          scrollbarWidth: "none",
        }}
        aria-label="희귀도 필터"
        role="tablist"
      >
        {ALL_FILTERS.map((f) => (
          <Chip
            key={f}
            active={filter === f}
            tone="carrot"
            onClick={() => setFilter(f)}
            role="tab"
            aria-selected={filter === f}
            data-testid={`chip-filter-${f}`}
          >
            {f === "all" ? "전체" : RARITY_LABEL[f]}
          </Chip>
        ))}
      </div>

      {/* Grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        {filtered.map((slot, i) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            index={i}
            onOpen={() => {
              if (slot.obtained) {
                haptic("medium");
                setSelectedId(slot.id);
              } else {
                haptic("light");
                toast(
                  slot.character
                    ? "아직 못 만났어. 집중 한 판 더 가자 흐흐"
                    : "이 칸은 곧 새 친구가 와요 ✨",
                );
              }
            }}
          />
        ))}
      </section>

      <BottomSheet
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.character?.name ?? "???"}
      >
        {selected?.character && selected.obtained && (
          <CharacterSheetContent
            character={selected.character}
            obtainedAt={selected.obtainedAt}
          />
        )}
      </BottomSheet>
    </main>
  );
}

interface CharacterSheetContentProps {
  character: CharacterDef;
  obtainedAt?: string;
}

function CharacterSheetContent({ character, obtainedAt }: CharacterSheetContentProps) {
  // 대사 cycling — 5초마다 다음 대사
  const [quoteIdx, setQuoteIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setQuoteIdx((i) => (i + 1) % character.quotes.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [character.quotes.length]);

  const isLegendary = character.rarity === "legendary";

  return (
    <div data-testid={`sheet-character-${character.id}`}>
      <div
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          margin: "8px 0 16px",
        }}
      >
        {isLegendary && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              width: 232,
              height: 232,
              borderRadius: "50%",
              background:
                "conic-gradient(from 0deg at 50% 50%, rgba(255,215,90,0.25), rgba(180,130,255,0.25), rgba(255,150,200,0.22), rgba(120,200,255,0.22), rgba(255,215,90,0.25))",
              animation: "legendary-spin 7s linear infinite",
              mixBlendMode: "overlay",
              pointerEvents: "none",
              WebkitMaskImage:
                "radial-gradient(circle, #000 55%, rgba(0,0,0,0) 80%)",
              maskImage:
                "radial-gradient(circle, #000 55%, rgba(0,0,0,0) 80%)",
            }}
          />
        )}
        <Bunny
          variant={character.bunnyKey}
          size={200}
          frame="rounded"
          glow={isLegendary}
          eager
          alt={character.name}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          className="t-micro"
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background:
              "color-mix(in oklab, " +
              RARITY_COLOR[character.rarity] +
              " 18%, transparent)",
            color: RARITY_COLOR[character.rarity],
            border: `1px solid ${RARITY_COLOR[character.rarity]}55`,
            fontWeight: 700,
          }}
        >
          {RARITY_LABEL[character.rarity]}
        </span>
        <span
          className="t-caption"
          style={{ color: "var(--text-tertiary)" }}
        >
          {character.unlockHint}
        </span>
        {obtainedAt && (
          <span
            className="t-caption"
            style={{ color: "var(--text-tertiary)" }}
          >
            · {obtainedAt} 획득
          </span>
        )}
      </div>

      {/* cycling quote */}
      <div
        style={{
          minHeight: 64,
          padding: 14,
          borderRadius: 14,
          background: "var(--bg-sunken)",
          marginBottom: 16,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={quoteIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="t-body"
            style={{
              margin: 0,
              fontStyle: "italic",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
            data-testid="character-quote"
          >
            “{character.quotes[quoteIdx]}”
          </motion.p>
        </AnimatePresence>
        {character.quotes.length > 1 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: 10,
              bottom: 8,
              display: "flex",
              gap: 3,
            }}
          >
            {character.quotes.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background:
                    i === quoteIdx
                      ? "var(--accent-carrot)"
                      : "var(--border-medium)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Button
        variant="primary"
        fullWidth
        size="lg"
        onClick={() => saveBunnyImage(character)}
        data-testid="button-save-bunny"
      >
        이미지 저장
      </Button>
    </div>
  );
}

async function saveBunnyImage(character: CharacterDef) {
  haptic("medium");
  try {
    const asset = bunnyImages[character.bunnyKey];
    const res = await fetch(asset.src);
    const blob = await res.blob();
    const fileName = `${character.id}.webp`;
    const file = new File([blob], fileName, { type: blob.type || "image/webp" });

    // 내부 구현은 OS native file save (Web Share Level 2 with files) 우선,
    // 미지원이면 anchor download 로 fallback. 사용자 UI 에는 "공유" / "다운로드" /
    // "갤러리" / "파일함" 같은 시스템 용어를 노출하지 않고 결과만 "저장 완료" 로 표시.
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData & { files?: File[] }) => boolean;
      share?: (data: ShareData & { files?: File[] }) => Promise<void>;
    };
    if (
      typeof nav.share === "function" &&
      typeof nav.canShare === "function" &&
      nav.canShare({ files: [file] })
    ) {
      try {
        await nav.share({ files: [file], title: character.name });
        toast("저장 완료");
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("저장 완료");
  } catch {
    toast("저장 실패");
  }
}

interface SlotCardProps {
  slot: DisplaySlot;
  index: number;
  onOpen: () => void;
}

const LOCKED_WHISPERS = [
  "흐흐... 아직이야",
  "비밀이지롱 킥킥",
  "좀 더 모아봐",
  "엿보지 마",
  "곧 만날 수 있어",
];

function SlotCard({ slot, index, onOpen }: SlotCardProps) {
  const isLegendary = slot.rarity === "legendary";
  const [whisper, setWhisper] = useState<string | null>(null);
  const whisperText = useMemo(
    () =>
      slot.character
        ? LOCKED_WHISPERS[
            Math.abs(slot.id.charCodeAt(slot.id.length - 1)) %
              LOCKED_WHISPERS.length
          ]
        : "곧 새 친구",
    [slot.id, slot.character],
  );

  const showWhisper = () => {
    if (slot.obtained) return;
    setWhisper(whisperText);
    window.setTimeout(() => setWhisper(null), 1600);
  };

  const labelName = slot.obtained && slot.character ? slot.character.name : "???";

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      onMouseEnter={showWhisper}
      onFocus={showWhisper}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.018, 0.3), duration: 0.32 }}
      style={{
        position: "relative",
        aspectRatio: "1 / 1.18",
        padding: 8,
        background: slot.obtained
          ? "var(--bg-elevated)"
          : "var(--bg-sunken)",
        border: slot.obtained
          ? `1px solid ${
              isLegendary
                ? RARITY_COLOR.legendary + "66"
                : "var(--border-subtle)"
            }`
          : "1px dashed var(--border-medium)",
        borderRadius: slot.obtained ? 18 : 14,
        boxShadow: slot.obtained
          ? isLegendary
            ? `var(--shadow-md), 0 0 18px ${RARITY_COLOR.legendary}33`
            : "var(--shadow-sm)"
          : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 4,
        overflow: "visible",
        cursor: "pointer",
      }}
      aria-label={
        slot.obtained
          ? labelName
          : `미획득 ${RARITY_LABEL[slot.rarity]}`
      }
      data-testid={`slot-${slot.id}`}
    >
      {isLegendary && slot.obtained && (
        <span
          aria-hidden
          className="holo"
          style={{ position: "absolute", inset: 0, borderRadius: 18 }}
        />
      )}
      <AnimatePresence>
        {whisper && (
          <motion.span
            key="whisper"
            initial={{ opacity: 0, scale: 0.7, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 520, damping: 24 }}
            role="status"
            style={{
              position: "absolute",
              top: -28,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--text-primary)",
              color: "var(--bg-primary)",
              padding: "5px 10px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              boxShadow: "var(--shadow-md)",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {whisper}
          </motion.span>
        )}
      </AnimatePresence>
      <div
        style={{
          flex: 1,
          width: "100%",
          display: "grid",
          placeItems: "center",
          background: slot.obtained ? "transparent" : "var(--bg-sunken)",
          borderRadius: 12,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {slot.obtained && slot.character ? (
          <Bunny
            variant={slot.character.bunnyKey}
            size={86}
            breathe={false}
            frame="rounded"
            // 첫 viewport (대략 9칸) 안의 unlocked 카드는 eager 로 로드해
            // 그리드가 비어 보이는 시간을 최소화한다.
            eager={index < 9}
            alt={slot.character.name}
          />
        ) : (
          <LockedSilhouette rarity={slot.rarity} />
        )}
      </div>
      <div style={{ width: "100%", textAlign: "center" }}>
        <p
          className="t-micro"
          style={{
            margin: 0,
            color: RARITY_COLOR[slot.rarity],
            opacity: slot.obtained ? 1 : 0.5,
          }}
        >
          {RARITY_LABEL[slot.rarity]}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            color: slot.obtained
              ? "var(--text-primary)"
              : "var(--text-tertiary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {labelName}
        </p>
      </div>
      {!slot.obtained && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: "var(--bg-sunken)",
            display: "grid",
            placeItems: "center",
            fontSize: 10,
            color: "var(--text-tertiary)",
          }}
        >
          🔒
        </span>
      )}
    </motion.button>
  );
}

/* ----------------------- LockedSilhouette ----------------------- */
/**
 * Phase 7.9 polish — locked card silhouette.
 *
 * 이전 버전은 토끼 webp 를 blur+darken 한 사각 `<img>` 로 깔았는데, 이게
 * "회색 사각 블록" 으로 읽혀서 AI-broken UI 처럼 보였다. 사각 가장자리 자체를
 * 제거하기 위해 이미지/blur 없이 순수 CSS 로 — 부드러운 cream tan radial vignette
 * 위에 ? 글리프 — 그린다. 어떤 사각 boundary 도 존재할 수 없다.
 * rarity glow 는 유지해 legendary/ssr 슬롯의 hint 만 살짝 남긴다.
 */
function rarityGlow(rarity: Rarity): string | null {
  switch (rarity) {
    case "legendary":
      return "0 0 16px rgba(255, 107, 53, 0.45), inset 0 0 16px rgba(255, 153, 64, 0.18)";
    case "ssr":
      return "0 0 14px rgba(167, 139, 250, 0.45), inset 0 0 14px rgba(167, 139, 250, 0.16)";
    default:
      return null;
  }
}

function LockedSilhouette({ rarity }: { rarity: Rarity }) {
  const glow = rarityGlow(rarity);
  return (
    <>
      {/* 부드러운 vignette — slot 의 bg-sunken 위에 한 톤 어두운 circle. 사각형 X */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "78%",
          height: "78%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 45%, rgba(31, 26, 21, 0.18) 0%, rgba(31, 26, 21, 0.10) 55%, rgba(31, 26, 21, 0) 100%)",
          pointerEvents: "none",
        }}
      />
      {glow && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            boxShadow: glow,
            pointerEvents: "none",
          }}
        />
      )}
      <span
        aria-hidden
        style={{
          position: "relative",
          fontSize: 32,
          fontWeight: 900,
          color: "var(--text-tertiary)",
          letterSpacing: "-0.04em",
          zIndex: 1,
        }}
      >
        ?
      </span>
    </>
  );
}

/**
 * FarmView — compact farm landing.
 *
 * Layout requirements:
 *   - 8px top padding under the Toss header.
 *   - One compact header row: left chips (carrots / planted / ripe),
 *     right dogam button. No eyebrow ("나의 농장") or h1 ("농장").
 *   - FarmHub fills the remaining vertical space above BottomNav so the
 *     plots are visible without scrolling on ≈568px tall devices.
 *   - Max width clamp 480px (the existing --app-max-width shell already
 *     enforces this, but we belt-and-braces it).
 */
function FarmView({
  onOpenDogam,
  obtainedCount,
}: {
  onOpenDogam: () => void;
  obtainedCount: number;
}) {
  const stages = useFarmStore((s) => s.stages);
  const carrots = useFarmStore((s) => s.carrots);
  const candyCarrots = useFarmStore((s) => s.candyCarrots);
  const goldenCarrots = useFarmStore((s) => s.goldenCarrots);
  // PR-109 — seeds 자원 폐기.
  const plantedCount = stages.filter((s) => s >= 1 && s <= 3).length;
  const readyCount = stages.filter((s) => s === 4).length;
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  // PR-136 — missions sheet (replaces inline cards).
  const [missionsOpen, setMissionsOpen] = useState(false);
  const unlockMedal = useRewardsStore((s) => s.unlockMedal);
  // PR-152 (Round 25) — useDogamRewardGrant 호출 제거 (v1 archive).
  // BGM context needs to know if a focus session is running.
  const timerStatus = useTimerStore((s) => s.status);
  const isFocusing = timerStatus === "FOCUSING";
  // 🎯 header badge — show red dot when any daily OR weekly mission
  // is still unclaimed. Daily resets at KST midnight; weekly at Mon 04:00.
  const dailyMissions = useMissionsStore((s) => s.missions);
  const dailyClaimed = useMissionsStore((s) => s.claimed);
  const weeklyMissions = useWeeklyMissionsStore((s) => s.missions);
  const weeklyClaimed = useWeeklyMissionsStore((s) => s.claimed);
  const missionsIncomplete =
    dailyMissions.filter((m) => !dailyClaimed.has(m.type)).length +
    weeklyMissions.filter((m) => !weeklyClaimed.has(m.type)).length;

  // R34 PR-201 — 🎁 보상함 빨간 점 badge. 수령 가능 보상 있으면 표시:
  //   1) 오늘의 선물상자 미수령 (giftClaimedDay !== KST today)
  //   2) 주간 보물상자 ready (treasureProgress >= WEEKLY_TREASURE_GOAL)
  const giftClaimedDay = useRewardsStore((s) => s.giftClaimedDay);
  const treasureProgress = useRewardsStore((s) => s.treasureProgress);
  const rewardsAvailable = (() => {
    const today = new Date();
    const kst = new Date(today.getTime() + 9 * 3600 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(kst.getUTCDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;
    const giftReady = giftClaimedDay !== todayKey;
    const treasureReady = treasureProgress >= WEEKLY_TREASURE_GOAL;
    return giftReady || treasureReady;
  })();

  // The bag button now lives in ToolDock (PR-6 moved it off the header).
  // Listen for its cc:bag:open dispatch so we can open the modal.
  useEffect(() => {
    const open = () => setBagOpen(true);
    window.addEventListener("cc:bag:open", open);
    return () => window.removeEventListener("cc:bag:open", open);
  }, []);

  // PR-13 — medal-unlocked SFX dispatcher. The rewardsStore fires
  // `cc:medal:unlocked` with `{ id }`; we play sfx_combo for the
  // perfect-combo medal (special) and sfx_levelup for everything else.
  useEffect(() => {
    const onUnlock = (ev: Event) => {
      const detail = (ev as CustomEvent<{ id?: string }>).detail;
      const id = detail?.id ?? "";
      const s = useSoundStore.getState();
      const kind = id === "perfect_combo" ? "combo" : "levelup";
      playSfx(kind, { muted: s.sfxMuted, masterVolume: s.sfxVolume });
    };
    window.addEventListener("cc:medal:unlocked", onUnlock);
    return () => window.removeEventListener("cc:medal:unlocked", onUnlock);
  }, []);

  // PR-133 — Farm BGM bootstrap with 6-track context routing. The
  // browser blocks `audio.play()` until a user gesture, so we hook a
  // one-shot pointerdown listener. bgmEngine.start is idempotent.
  const farmBgmEnabled = useSoundStore((s) => s.farmBgmEnabled);
  const farmBgmVolume = useSoundStore((s) => s.farmBgmVolume);
  // Sky open state mirrored from FarmHub via window event so we can
  // include it in the BGM context without lifting FarmHub state.
  const [skyOpenForBgm, setSkyOpenForBgm] = useState(false);
  useEffect(() => {
    const onSky = (ev: Event) => {
      const detail = (ev as CustomEvent<{ open?: boolean }>).detail;
      setSkyOpenForBgm(Boolean(detail?.open));
    };
    window.addEventListener("cc:sky:state", onSky);
    return () => window.removeEventListener("cc:sky:state", onSky);
  }, []);
  // First-visit detection — consumed exactly once per device.
  const [firstVisit] = useState(() => consumeFirstVisit());
  const ctx = useMemo(
    () => ({
      firstVisit,
      skyOpen: skyOpenForBgm,
      focusActive: isFocusing,
      readyCrops: readyCount,
      growingCrops: plantedCount,
    }),
    [firstVisit, skyOpenForBgm, isFocusing, readyCount, plantedCount],
  );
  useEffect(() => {
    const kick = () => {
      bgmEngine.start(
        { enabled: farmBgmEnabled, volume: farmBgmVolume },
        ctx,
      );
    };
    document.addEventListener("pointerdown", kick, { passive: true });
    return () => document.removeEventListener("pointerdown", kick);
  }, [farmBgmEnabled, farmBgmVolume, ctx]);
  useEffect(() => {
    bgmEngine.setEnabled(farmBgmEnabled);
  }, [farmBgmEnabled]);
  useEffect(() => {
    bgmEngine.setVolume(farmBgmVolume);
  }, [farmBgmVolume]);
  // Push every context change.
  useEffect(() => {
    bgmEngine.setContext(ctx);
  }, [ctx]);
  // Unmount: pause BGM when leaving the farm tab (HomePage START also
  // pauses; this catches navigation to Settings/Reports/etc.).
  useEffect(() => {
    return () => {
      bgmEngine.pause();
    };
  }, []);

  // PR-71 — Dogam threshold medals 비율 기반 (DOGAM_TOTAL = CHARACTERS.length).
  // 12-char universe 기준 임계 3 / 6 / 9 / 12. 캐릭터 추가 시 자동 재계산.
  // unlockMedal() is idempotent — 경계 cross 시 한 번만.
  useEffect(() => {
    const t25 = Math.ceil(DOGAM_TOTAL * 0.25);
    const t50 = Math.ceil(DOGAM_TOTAL * 0.5);
    const t75 = Math.ceil(DOGAM_TOTAL * 0.75);
    const t100 = DOGAM_TOTAL;
    if (obtainedCount >= t25) unlockMedal("dogam_25");
    if (obtainedCount >= t50) unlockMedal("dogam_50");
    if (obtainedCount >= t75) unlockMedal("dogam_75");
    if (obtainedCount >= t100) unlockMedal("dogam_100");
  }, [obtainedCount, unlockMedal]);

  // Lock body overflow only while the farm view is mounted. Other tabs
  // (Settings, Report) still scroll normally. CSS rule in base.css.
  useEffect(() => {
    document.body.setAttribute("data-farm-view", "1");
    return () => {
      document.body.removeAttribute("data-farm-view");
    };
  }, []);

  return (
    <main
      className="app-screen"
      data-testid="page-collection"
      style={{
        // R31 PR-178 — fullbleed. 좌우 padding 12 → 0, maxWidth 480 →
        // 720 (mobile 100% 채우고 태블릿/landscape 만 안전선). 헤더는
        // 위 padding 8 + 좌우 12 로 살짝 유지 (당근/도감 아이콘이
        // 가장자리에 붙지 않게).
        padding: 0,
        display: "flex",
        flexDirection: "column",
        // Take the full viewport minus the safe-area top + bottom and the
        // tab bar reservation, so the farm card has a known cap to size
        // against. dvh handles iOS dynamic toolbar.
        // R28 PHASE 1 — safe-area-inset-bottom 도 빼서 farm card bottom 이
        // TabBar top 과 정확히 일치하게 함 (이전: safe-bottom 만큼 farm
        // card 가 TabBar zone 안으로 침범했음 → ToolDock 겹침).
        // R30.5 PR-177 — env() → var(--safe-*). Apps in Toss SDK 측정값
        // 이 :root 에 노출되어 정확한 inset 으로 farm card 가 TabBar
        // top 에 딱 맞음.
        height:
          "calc(100dvh - var(--safe-top, 0px) - var(--safe-bottom, 0px) - var(--tabbar-reserved, 84px))",
        width: "100%",
        maxWidth: 720,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <header
        data-testid="farm-compact-header"
        style={{
          // R35 — bg 위에 떠있는 overlay 헤더. position:absolute 로 flex
          // 흐름에서 빠지면서 FarmHub 가 main 전체 세로를 차지 → bg 자연
          // 비율로 거의 풀화면 노출. 칩은 pill 배경 제거 + text-shadow 로
          // 가독성 확보. pointer-events:none 컨테이너 + 자식들에만 auto
          // 부여해서 칩 사이 빈 공간 클릭은 농장으로 통과.
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 5,
          padding: "8px 12px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          minHeight: 36,
          fontSize: 14,
          fontWeight: 600,
          color: "#fff",
          textShadow: "0 1px 2px rgba(0,0,0,0.55), 0 0 6px rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      >
        <div
          data-testid="farm-inventory"
          aria-label={`당근 ${carrots}개, 캔디당근 ${candyCarrots}개, 황금당근 ${goldenCarrots}개. (정보: 새싹 ${plantedCount}개, 익은 밭 ${readyCount}개)`}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <CurrencyChip
            icon={`${import.meta.env.BASE_URL}assets/farm/currency/carrot.png`}
            emoji="🥕"
            label="당근"
            count={carrots}
            testId="chip-carrot"
          />
          <CurrencyChip
            icon={`${import.meta.env.BASE_URL}assets/farm/currency/candy_carrot.png`}
            emoji="🍬"
            label="캔디"
            count={candyCarrots}
            testId="chip-candy"
            muted
          />
          <CurrencyChip
            icon={`${import.meta.env.BASE_URL}assets/farm/currency/golden_carrot.png`}
            emoji="✨"
            label="황금"
            count={goldenCarrots}
            testId="chip-golden"
            muted
          />
          {/* PR-109 — seed chip 제거 (씨앗 자원 폐기). 헤더 = 당근/캔디/황금 3 chip. */}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            data-testid="farm-header-dogam"
            aria-label="도감 열기"
            onClick={onOpenDogam}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 8px",
              borderRadius: 999,
              background: "transparent",
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              pointerEvents: "auto",
              textShadow: "0 1px 2px rgba(0,0,0,0.55), 0 0 6px rgba(0,0,0,0.35)",
            }}
          >
            📖 도감 {obtainedCount}/{DOGAM_TOTAL}
          </button>
          {/* PR-136 — 🎯 missions trigger. Sibling of 🎁 보상함.
              Red dot badge when ≥ 1 daily/weekly mission is unclaimed. */}
          <button
            type="button"
            data-testid="farm-header-missions"
            aria-label={
              missionsIncomplete > 0
                ? `오늘 / 이번 주 목표 — ${missionsIncomplete}개 남음`
                : "오늘 / 이번 주 목표 — 모두 완료"
            }
            onClick={() => {
              haptic("light");
              setMissionsOpen(true);
            }}
            style={{
              position: "relative",
              width: 32,
              height: 32,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "transparent",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              pointerEvents: "auto",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
            }}
          >
            🎯
            {missionsIncomplete > 0 && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ff4d4f",
                  boxShadow: "0 0 0 2px var(--bg-elevated, #fff)",
                }}
              />
            )}
          </button>
          {/* R34 PR-201 — 🎁 보상함 빨간 점 badge. 오늘의 선물 미수령
              OR 주간 보물상자 ready 시 표시. 🎯 missions badge 와 동일
              시각 패턴. */}
          <button
            type="button"
            data-testid="farm-header-rewards"
            aria-label={
              rewardsAvailable
                ? "보상함 열기 — 수령 가능한 보상이 있어요"
                : "보상함 열기"
            }
            onClick={() => {
              haptic("light");
              setRewardsOpen(true);
            }}
            style={{
              position: "relative",
              width: 32,
              height: 32,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "transparent",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              pointerEvents: "auto",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
            }}
          >
            🎁
            {rewardsAvailable && (
              <span
                aria-hidden
                data-testid="rewards-available-badge"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ff4d4f",
                  boxShadow: "0 0 0 2px var(--bg-elevated, #fff)",
                }}
              />
            )}
          </button>
          {/* PR-21 — settings 톱니바퀴 제거. 하단 네비 → 내 정보 → 설정
              경로가 이미 있으므로 헤더 진입점 중복 제거. 헤더 우측은
              📖 도감 + 🎁 보상함 둘만 남김 (선물박스는 daily reward
              진입점이라 농장 첫화면에 두는 게 의미 있음). 라우트
              자체는 그대로 유지. */}
        </div>
      </header>

      {/* PR-136 (Round 19) — mission cards moved into <MissionsSheet>
          triggered by the 🎯 button in the farm header. The 9-plot
          field reclaims the vertical space the inline cards used. */}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
        }}
      >
        <FarmHub
          onOpenDogam={onOpenDogam}
          obtainedCount={obtainedCount}
          totalCount={DOGAM_TOTAL}
        />
      </div>

      <FarmOnboarding />
      <RewardsPanel open={rewardsOpen} onClose={() => setRewardsOpen(false)} />
      <InventoryModal open={bagOpen} onClose={() => setBagOpen(false)} />
      <MissionsSheet
        open={missionsOpen}
        onClose={() => setMissionsOpen(false)}
      />
    </main>
  );
}

/**
 * Single header currency chip.
 *
 * Uses an asset image when `icon` resolves; if the PNG fails to load
 * (e.g. nested-proxy host strips a deep path), the chip falls back to
 * the supplied emoji glyph so the header never collapses.
 */
function CurrencyChip({
  icon,
  emoji,
  label,
  count,
  testId,
  muted = false,
}: {
  icon: string;
  emoji: string;
  label: string;
  count: number;
  testId: string;
  muted?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <span
      data-testid={testId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        // R35 — overlay header 에서 색상은 부모 (흰색) 상속. muted 는
        // opacity 만 살짝 낮춰서 primary(당근) 와 시각 구분.
        opacity: muted ? 0.78 : 1,
      }}
    >
      {imgOk ? (
        <img
          src={icon}
          alt=""
          width={18}
          height={18}
          onError={() => setImgOk(false)}
          style={{ display: "inline-block", objectFit: "contain", flexShrink: 0 }}
        />
      ) : (
        <span aria-hidden style={{ fontSize: 14 }}>{emoji}</span>
      )}
      <span>{label} {count}</span>
    </span>
  );
}
