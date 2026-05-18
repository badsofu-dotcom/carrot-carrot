/**
 * RewardsPanel — bottom-sheet style modal.
 *
 * R32 PR-185 — 토스포인트 환산 dormant 후 4 섹션 구성:
 *   1. **🥕 오늘 진행** — DailyCapProgress (일일 자원 캡 진행도).
 *   2. **🎁 오늘의 선물상자** — KST 자정 1회 claim. rewardsStore.rollGift.
 *   3. **🎁 주간 보물상자** — 진행도 7 충족 시 1회 open.
 *   4. **🐰 자원 사용 (R32 신규)** — candy/golden 보유 chip + "친구
 *      만나기 (pity)" CTA → BunnyPityModal (cc:bunny-pity:open dispatch).
 *      가구 상점은 농장의 "🍄 집 들어가기" 라벨로 진입 — 중복 제거.
 *
 * gift / treasure 라벨에서 "P 환산" 멘트 제거 (PR-180 docs 결정 반영,
 * candy/golden 은 in-app sink 로 직접 소비).
 *
 * Mounted from CollectionPage's farm header (🎁 button next to gear).
 * Closed by backdrop tap, X, or escape key.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFarmStore } from "../../features/collection/farmStore";
import {
  useRewardsStore,
  WEEKLY_TREASURE_GOAL,
  type GiftReward,
} from "../../features/collection/rewardsStore";
import { useItemsStore } from "../../features/collection/itemsStore";
import { useCollectionStore } from "../../features/collection/collectionStore";
import { passivesFromOwned } from "../../lib/dogamPassives";
// PR-145 (Round 22) — 토스포인트 / 출금 흐름 제거. canWithdraw /
// MIN_PAYOUT / totalPoints + apiCall 출금 호출 모두 미사용. helper 들은
// lib/points.ts 에 그대로 남아있어 정식 출시 시 재활성 가능.
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { playSfx } from "../../lib/soundFx";
import { useSoundStore } from "../../store/soundStore";
import {
  currentDailyCap,
  todayEarned,
} from "../../lib/economy/dailyCap";

const BASE = import.meta.env.BASE_URL;

// PR-26 — MEDAL_ORDER 가 AchievementsCard (도감 페이지) 로 이동.

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RewardsPanel({ open, onClose }: Props) {
  // PR-145 (Round 22) — candy / golden subscription 제거 (토스포인트
  // 카드 헤더 표시 없어짐). gift / treasure 보상 grant 시 incCandy /
  // incGolden 은 여전히 사용.
  const incCandy = useFarmStore((s) => s.incCandyCarrots);
  const incGolden = useFarmStore((s) => s.incGoldenCarrots);
  const incCarrots = useFarmStore((s) => s.incCarrots);
  // R32 PR-185 — 자원 사용 섹션의 candy/golden 보유 표시.
  const candyCarrots = useFarmStore((s) => s.candyCarrots);
  const goldenCarrots = useFarmStore((s) => s.goldenCarrots);

  const claimedDay = useRewardsStore((s) => s.giftClaimedDay);
  const claimDailyGift = useRewardsStore((s) => s.claimDailyGift);
  const treasureProgress = useRewardsStore((s) => s.treasureProgress);
  const openTreasureChest = useRewardsStore((s) => s.openTreasureChest);

  const [claimedThisOpen, setClaimedThisOpen] = useState<GiftReward | null>(null);
  const [lastTreasureText, setLastTreasureText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClaimedThisOpen(null);
      setLastTreasureText(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const todayClaimed = (() => {
    if (!claimedDay) return false;
    const today = new Date();
    const kst = new Date(today.getTime() + 9 * 3600 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(kst.getUTCDate()).padStart(2, "0");
    return claimedDay === `${y}-${m}-${d}`;
  })();

  const onClaim = () => {
    if (todayClaimed) return;
    haptic("medium");
    const reward = claimDailyGift();
    if (!reward) return;
    setClaimedThisOpen(reward);
    // PR-13 giftbox open SFX. Fired on the user-gesture path so autoplay
    // policy is satisfied.
    {
      const s = useSoundStore.getState();
      playSfx("giftbox", { muted: s.sfxMuted, masterVolume: s.sfxVolume });
    }
    // PR-63 — 도감 20마리 이상 시 giftBoostX (×1.5) reward 증폭.
    const dogamOwned = useCollectionStore.getState().ownedCharacters.length;
    const giftBoost = passivesFromOwned(dogamOwned).giftBoostX;
    const amt = Math.max(1, Math.round(reward.amount * giftBoost));
    // PR-109 — seed kind 제거 (giftRoll 도 더 이상 seed 반환 안 함).
    if (reward.kind === "candy") incCandy(amt);
    else if (reward.kind === "golden") incGolden(amt);
    else if (reward.kind === "gem") {
      useItemsStore.getState().add("gem", amt);
    }
  };

  // PR-17b — open the weekly treasure chest. The roll lives in
  // rewardsStore.openTreasureChest (uses WEEKLY_TREASURE_TABLE +
  // rollTable). The grant dispatches into the appropriate stores so
  // header chips / inventory reflect the bonus instantly.
  const onOpenTreasure = () => {
    haptic("medium");
    const reward = openTreasureChest();
    if (!reward) {
      toast("진행도 7 채우면 열 수 있어요");
      return;
    }
    const s = useSoundStore.getState();
    playSfx("giftbox", { muted: s.sfxMuted, masterVolume: s.sfxVolume });
    switch (reward.kind) {
      case "candy":
        incCandy(reward.amount);
        break;
      case "golden":
        incGolden(reward.amount);
        break;
      case "carrot":
        incCarrots(reward.amount);
        break;
      // PR-109 — seed kind 제거. WEEKLY_TREASURE_TABLE 도 더 이상 seed
      // entry 없음.
      case "star":
        useItemsStore.getState().add("star", reward.amount);
        break;
      default:
        // treasure_progress wouldn't roll from this table; future-proof.
        break;
    }
    setLastTreasureText(treasureToText(reward));
    toast(`🎁 보물상자 — ${treasureToText(reward)}`);
  };

  // PR-145 (Round 22) — onWithdraw 제거. /economy/withdraw 워커 라우트
  // 코드는 그대로 유지 (정식 출시 시 재활성 가능).

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1050,
              background: "rgba(0,0,0,0.45)",
            }}
            data-testid="rewards-backdrop"
          />
          {/* Sheet — PR-22: outer container is a non-scrolling flex
              column with maxHeight 90 vh. Header (drag bar + title +
              close) sticks at top; the section content lives in a
              dedicated overflow-y:auto inner div so framer-motion's
              transform doesn't compete with scroll on iOS Safari. */}
          <motion.div
            data-testid="rewards-panel"
            role="dialog"
            aria-modal="true"
            aria-label="보상함"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              marginLeft: "auto",
              marginRight: "auto",
              // PR-82 — bottom 을 TabBar 위로 띄움. 이전 bottom:0 +
              // maxHeight:90vh 는 floating TabBar (height 68 + offset
              // 16*2 = 100px) 아래로 컨텐츠가 깔려 잘림. PR-68 의
              // InventoryModal 과 동일 패턴.
              bottom:
                "calc(var(--tabbar-reserved, 100px) + env(safe-area-inset-bottom))",
              zIndex: 1051,
              width: "100%",
              maxWidth: "var(--app-max-width, 480px)",
              // PR-82 — maxHeight 도 가용 viewport 기반 동적 계산.
              maxHeight:
                "calc(100dvh - var(--tabbar-reserved, 100px) - env(safe-area-inset-bottom) - 12px)",
              display: "flex",
              flexDirection: "column",
              background: "#FFF8EE",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              boxShadow: "0 -8px 28px rgba(0,0,0,0.18)",
              boxSizing: "border-box",
              // Outer overflow stays hidden so the rounded corners
              // clip cleanly; inner scrolldiv carries the auto behavior.
              overflow: "hidden",
            }}
          >
            {/* Sticky header — drag handle + title + close */}
            <div
              style={{
                flexShrink: 0,
                padding:
                  "12px calc(20px + env(safe-area-inset-right)) 0 calc(20px + env(safe-area-inset-left))",
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.18)",
                  margin: "4px auto 14px",
                }}
              />
              <header
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#2b2b2b" }}>보상함</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="닫기"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    border: "none",
                    background: "rgba(0,0,0,0.06)",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </header>
            </div>

            {/* Scrollable content. flex:1 + minHeight:0 = the column's
                growable row that takes whatever vertical space is left
                after the header. WebkitOverflowScrolling: touch is for
                iOS momentum scrolling. Scrollbar hidden so the panel
                feels native on mobile. */}
            <div
              data-testid="rewards-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                // PR-82 — bottom safe-area 는 이미 outer bottom offset 에
                // 포함. 내부 padding 은 20px 만 (이전엔 중복 적용).
                padding:
                  "0 calc(20px + env(safe-area-inset-right)) 20px calc(20px + env(safe-area-inset-left))",
                scrollbarWidth: "none",
              }}
            >
              <style>{`[data-testid="rewards-scroll"]::-webkit-scrollbar{display:none;}`}</style>

            {/* R27.1 — 버섯집 진입 카드 제거. 농장 라벨 "🍄 집 들어가기"
                (MushroomHouseEntryLabel) 로 이미 진입 가능 → 중복 UI.
                DailyCapProgress 는 일일 cap 표시 (가구 통화로 재정의된
                후에도 의미 있음) 라 별도 section 으로 유지. */}
            <Section title="🥕 오늘 진행">
              <DailyCapProgress />
            </Section>

            {/* Daily gift */}
            <Section title="오늘의 선물상자">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#fff",
                  borderRadius: 16,
                  padding: 14,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                }}
              >
                <img
                  src={`${BASE}assets/farm/rewards/gift_box.png`}
                  alt=""
                  width={56}
                  height={56}
                  style={{
                    objectFit: "contain",
                    filter: todayClaimed
                      ? "grayscale(0.6) opacity(0.55)"
                      : "drop-shadow(0 4px 8px rgba(255,123,97,0.35))",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  {/* PR-84 — fixed #fff card → fixed dark heading. */}
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#2b2b2b" }}>
                    {todayClaimed ? "오늘은 이미 받았어요" : "오늘의 선물 받기"}
                  </div>
                  <div style={{ fontSize: 11, color: "#6a6055", marginTop: 2 }}>
                    KST 자정에 다시 열려요
                  </div>
                  {claimedThisOpen && (
                    <div
                      data-testid="gift-claimed"
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--accent-carrot, #FF7B61)",
                      }}
                    >
                      {giftToText(claimedThisOpen)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="rewards-claim"
                  disabled={todayClaimed}
                  onClick={onClaim}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "none",
                    fontWeight: 800,
                    fontSize: 13,
                    background: todayClaimed ? "rgba(0,0,0,0.08)" : "#FF7B61",
                    color: todayClaimed ? "#888" : "#fff",
                    cursor: todayClaimed ? "not-allowed" : "pointer",
                  }}
                >
                  {todayClaimed ? "받음" : "받기"}
                </button>
              </div>
            </Section>

            {/* Weekly treasure (PR-17b) */}
            <Section title="주간 보물상자">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#fff",
                  borderRadius: 16,
                  padding: 14,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                }}
              >
                <img
                  src={`${BASE}assets/farm/rewards/treasure_chest.png`}
                  alt=""
                  width={56}
                  height={56}
                  style={{
                    objectFit: "contain",
                    flexShrink: 0,
                    filter:
                      treasureProgress >= WEEKLY_TREASURE_GOAL
                        ? "drop-shadow(0 4px 8px rgba(255,123,97,0.45))"
                        : "grayscale(0.45) opacity(0.7)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* PR-84 — fixed #fff card → fixed dark heading. */}
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#2b2b2b" }}>
                    {treasureProgress >= WEEKLY_TREASURE_GOAL
                      ? "보물상자 열기 준비됨!"
                      : `진행도 ${treasureProgress}/${WEEKLY_TREASURE_GOAL}`}
                  </div>
                  <div
                    aria-label={`treasure progress ${treasureProgress} of ${WEEKLY_TREASURE_GOAL}`}
                    style={{
                      marginTop: 6,
                      height: 6,
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      data-testid="treasure-progress-bar"
                      style={{
                        width: `${(treasureProgress / WEEKLY_TREASURE_GOAL) * 100}%`,
                        height: "100%",
                        background:
                          treasureProgress >= WEEKLY_TREASURE_GOAL
                            ? "#FF7B61"
                            : "rgba(255,123,97,0.55)",
                        transition: "width 0.25s ease",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "#6a6055", marginTop: 4 }}>
                    광고 보상 → "보물 진행" 채널로 진행도 누적
                  </div>
                  {lastTreasureText && (
                    <div
                      data-testid="treasure-claimed"
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--accent-carrot, #FF7B61)",
                      }}
                    >
                      {lastTreasureText}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="treasure-open"
                  disabled={treasureProgress < WEEKLY_TREASURE_GOAL}
                  onClick={onOpenTreasure}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "none",
                    fontWeight: 800,
                    fontSize: 13,
                    background:
                      treasureProgress >= WEEKLY_TREASURE_GOAL
                        ? "#FF7B61"
                        : "rgba(0,0,0,0.08)",
                    color:
                      treasureProgress >= WEEKLY_TREASURE_GOAL
                        ? "#fff"
                        : "#888",
                    cursor:
                      treasureProgress >= WEEKLY_TREASURE_GOAL
                        ? "pointer"
                        : "not-allowed",
                  }}
                >
                  {treasureProgress >= WEEKLY_TREASURE_GOAL ? "열기" : "잠김"}
                </button>
              </div>
            </Section>

            {/* R32 PR-185 — 자원 사용 섹션. candy/golden 의 in-app sink
                (가챠 pity / 프리미엄 가구) 진입점. 가구 상점은 농장 화면
                "🍄 집 들어가기" 라벨로 진입하므로 여기선 친구 만나기
                pity 만 노출. */}
            <Section title="🐰 자원 사용">
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 14,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <BalanceChip emoji="🍬" label="캔디당근" value={candyCarrots} />
                  <BalanceChip emoji="✨" label="황금당근" value={goldenCarrots} />
                </div>
                <button
                  type="button"
                  data-testid="open-bunny-pity"
                  onClick={() => {
                    haptic("light");
                    try {
                      window.dispatchEvent(new CustomEvent("cc:bunny-pity:open"));
                    } catch {
                      /* SSR */
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,123,97,0.35)",
                    background: "#FFF8EE",
                    color: "#2b2b2b",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 22 }}>🐰</span>
                  <span style={{ flex: 1 }}>
                    친구 만나기 (보장 가챠)
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#6a6055",
                      }}
                    >
                      🍬 10개 → rare 보장 · ✨ 5개 → epic 보장
                    </div>
                  </span>
                  <span
                    aria-hidden
                    style={{
                      fontSize: 14,
                      color: "#FF7B61",
                      fontWeight: 800,
                    }}
                  >
                    →
                  </span>
                </button>
                <p
                  style={{
                    margin: "8px 4px 0",
                    fontSize: 10,
                    color: "#9a8870",
                    lineHeight: 1.4,
                  }}
                >
                  프리미엄 가구는 농장 → 🍄 집 들어가기 에서 구매할 수
                  있어요.
                </p>
              </div>
            </Section>

            {/* PR-26 — 훈장 섹션이 도감 페이지 (CollectionPage 의
                AchievementsCard) 로 이동. */}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// PR-26 — medalAsset 이 AchievementsCard 로 이동.

// PR-109 — seed kind 제거. R32 PR-185 — "+X P" 환산 라벨 제거 (토스
// 포인트 환산 dormant, candy/golden 은 in-app sink 로 직접 소비).
function giftToText(g: GiftReward): string {
  switch (g.kind) {
    case "candy":
      return `🍬 캔디 당근 +${g.amount}`;
    case "golden":
      return `✨ 황금 당근 +${g.amount}`;
    case "gem":
      return `💎 보석 +${g.amount}`;
  }
}

function treasureToText(t: { kind: string; amount: number; points: number }): string {
  switch (t.kind) {
    case "candy":
      return `🍬 캔디 당근 +${t.amount}`;
    case "golden":
      return `✨ 황금 당근 +${t.amount}`;
    case "carrot":
      return `🥕 당근 +${t.amount}`;
    case "star":
      return `⭐ 별 +${t.amount}`;
    default:
      return `+${t.amount} ${t.kind}`;
  }
}

// R32 PR-185 — candy/golden 보유 chip (자원 사용 섹션).
function BalanceChip({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "8px 10px",
        borderRadius: 10,
        background: "rgba(255,123,97,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span aria-hidden style={{ fontSize: 18 }}>{emoji}</span>
      <div style={{ minWidth: 0, lineHeight: 1.2 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#2b2b2b",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 10, color: "#6a6055" }}>{label}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#555",
          margin: "0 4px 8px",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * DailyCapProgress (PR-90) — 오늘 누적 earned P / cap 진행도 표시.
 *
 * Soft cap 정책: 실제 resource grant 는 차단 안 함. 진행도 + 캡 도달
 * 시 "🌙 오늘은 푹 쉬어요" 안내. KST 자정 자동 reset.
 */
function DailyCapProgress() {
  const cap = currentDailyCap();
  const earned = todayEarned();
  const pct = Math.min(100, (earned / cap) * 100);
  const reached = earned >= cap;
  return (
    <div
      data-testid="daily-cap-progress"
      style={{
        marginTop: 12,
        padding: "8px 10px",
        background: reached ? "rgba(34,160,107,0.08)" : "rgba(255,123,97,0.06)",
        border: reached
          ? "1px solid rgba(34,160,107,0.18)"
          : "1px solid rgba(255,123,97,0.14)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#2b2b2b" }}>
          {reached ? "🌙 오늘은 푹 쉬어요" : "오늘 모은 당근"}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: reached ? "#22a06b" : "#6a6055",
            fontVariantNumeric: "tabular-nums",
          }}
          data-testid="daily-cap-numbers"
        >
          {earned} / {cap} 🥕
        </span>
      </div>
      <div
        style={{
          marginTop: 6,
          height: 4,
          borderRadius: 999,
          background: "rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          data-testid="daily-cap-bar"
          style={{
            width: `${pct}%`,
            height: "100%",
            background: reached ? "#22a06b" : "#FF7B61",
            transition: "width 0.25s ease",
          }}
        />
      </div>
    </div>
  );
}
