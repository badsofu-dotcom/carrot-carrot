/**
 * RewardsPanel — bottom-sheet style modal that surfaces three things:
 *   1. **Toss points** — totalled from carrot/candy/golden inventory.
 *      Withdraw button calls `/economy/withdraw` (worker route already
 *      exists). Disabled below MIN_PAYOUT or while the server reports
 *      `withdrawEnabled=false` (= `CONFIG_REQUIRED`).
 *   2. **Daily gift box** — one claim per KST day. Roll table in
 *      `rewardsStore.ts → rollGift`. Reward is granted locally + (when
 *      candy/golden) reflected in the farm inventory.
 *   3. **Medals** — stars/seal-shaped badges for milestones reached.
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
import { canWithdraw, MIN_PAYOUT, totalPoints } from "../../lib/points";
import { apiCall, apiBaseUrl, tokenStore } from "../../lib/api";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { playSfx } from "../../lib/soundFx";
import { useSoundStore } from "../../store/soundStore";

const BASE = import.meta.env.BASE_URL;

// PR-26 — MEDAL_ORDER 가 AchievementsCard (도감 페이지) 로 이동.

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RewardsPanel({ open, onClose }: Props) {
  const carrots = useFarmStore((s) => s.carrots);
  const candy = useFarmStore((s) => s.candyCarrots);
  const golden = useFarmStore((s) => s.goldenCarrots);
  const seeds = useFarmStore((s) => s.seeds);

  const incCandy = useFarmStore((s) => s.incCandyCarrots);
  const incGolden = useFarmStore((s) => s.incGoldenCarrots);
  const incCarrots = useFarmStore((s) => s.incCarrots);
  const growAllPlanted = useFarmStore((s) => s.growAllPlanted);

  const claimedDay = useRewardsStore((s) => s.giftClaimedDay);
  const claimDailyGift = useRewardsStore((s) => s.claimDailyGift);
  const treasureProgress = useRewardsStore((s) => s.treasureProgress);
  const openTreasureChest = useRewardsStore((s) => s.openTreasureChest);

  const points = totalPoints({ carrots, candyCarrots: candy, goldenCarrots: golden });
  const withdrawable = canWithdraw(points);

  const [claimedThisOpen, setClaimedThisOpen] = useState<GiftReward | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<string | null>(null);
  const [lastTreasureText, setLastTreasureText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClaimedThisOpen(null);
      setWithdrawStatus(null);
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
    if (reward.kind === "candy") incCandy(reward.amount);
    else if (reward.kind === "golden") incGolden(reward.amount);
    else if (reward.kind === "gem") {
      useItemsStore.getState().add("gem", reward.amount);
    }
    // "seed" rewards land via the same store path on the next focus
    // session tier — surfacing in inventory not yet wired for
    // direct-grant; documented as a known limitation.
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
      case "seed":
        // growAllPlanted's seed-delta side-door is the only existing
        // direct-grant path (same as PR-7 gem→seed swap).
        growAllPlanted(0, null, reward.amount);
        break;
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

  const onWithdraw = async () => {
    if (!withdrawable || withdrawBusy) return;
    setWithdrawBusy(true);
    setWithdrawStatus(null);
    try {
      const canHitServer =
        apiBaseUrl().length > 0 && !!tokenStore.getAccess();
      if (!canHitServer) {
        setWithdrawStatus("콘솔 설정 후 출금할 수 있어요");
        return;
      }
      const res = await apiCall<{ ok: boolean }>("/economy/withdraw", {
        method: "POST",
        body: {},
      });
      if (res.ok) {
        setWithdrawStatus("출금 요청 완료 — 잠시 후 토스에서 확인할 수 있어요");
      } else {
        setWithdrawStatus(
          res.error?.code === "CONFIG_REQUIRED"
            ? "콘솔 설정 후 출금할 수 있어요"
            : "출금 처리 중 문제가 있어요. 잠시 후 다시 시도해주세요",
        );
      }
    } catch {
      setWithdrawStatus("네트워크 오류 — 다시 시도해주세요");
    } finally {
      setWithdrawBusy(false);
    }
  };

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
              bottom: 0,
              zIndex: 1051,
              width: "100%",
              maxWidth: "var(--app-max-width, 480px)",
              maxHeight: "90vh",
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
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>보상함</h2>
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
                padding:
                  "0 calc(20px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))",
                scrollbarWidth: "none",
              }}
            >
              <style>{`[data-testid="rewards-scroll"]::-webkit-scrollbar{display:none;}`}</style>

            {/* Toss points section */}
            <Section title="토스포인트">
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
                  src={`${BASE}assets/farm/icons/icon_coin.png`}
                  alt=""
                  width={40}
                  height={40}
                  style={{ flexShrink: 0, objectFit: "contain" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>
                    {points.toLocaleString()} P
                  </div>
                  <div style={{ fontSize: 11, color: "#777" }}>
                    🥕 {carrots} · 🍬 {candy} · ✨ {golden} · 🌱 {seeds}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="rewards-withdraw"
                  disabled={!withdrawable || withdrawBusy}
                  onClick={onWithdraw}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "none",
                    fontWeight: 800,
                    fontSize: 13,
                    background: withdrawable ? "#FF7B61" : "rgba(0,0,0,0.08)",
                    color: withdrawable ? "#fff" : "#888",
                    cursor: withdrawable ? "pointer" : "not-allowed",
                  }}
                >
                  {withdrawBusy ? "처리 중…" : "출금하기"}
                </button>
              </div>
              {!withdrawable && (
                <p
                  style={{
                    margin: "8px 4px 0",
                    fontSize: 11,
                    color: "#888",
                  }}
                >
                  {MIN_PAYOUT}P 부터 출금할 수 있어요 · 1🥕=1P · 1🍬=5P · 1✨=10P
                </p>
              )}
              {withdrawStatus && (
                <p
                  data-testid="rewards-withdraw-status"
                  style={{
                    margin: "8px 4px 0",
                    fontSize: 12,
                    color: "#444",
                    fontWeight: 600,
                  }}
                >
                  {withdrawStatus}
                </p>
              )}
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
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {todayClaimed ? "오늘은 이미 받았어요" : "오늘의 선물 받기"}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                    KST 자정에 다시 열려요
                  </div>
                  {claimedThisOpen && (
                    <div
                      data-testid="gift-claimed"
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#FF7B61",
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
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
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
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                    광고 보상 → "보물 진행" 채널로 진행도 누적
                  </div>
                  {lastTreasureText && (
                    <div
                      data-testid="treasure-claimed"
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#FF7B61",
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

            {/* PR-26 — 훈장 섹션이 도감 페이지 (CollectionPage 의
                AchievementsCard) 로 이동. RewardsPanel 은 광고/포인트
                허브 (토스포인트 + 오늘의 선물 + 주간 보물) 만 남김. */}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// PR-26 — medalAsset 이 AchievementsCard 로 이동.

function giftToText(g: GiftReward): string {
  switch (g.kind) {
    case "seed":
      return `🌱 씨앗 +${g.amount}`;
    case "candy":
      return `🍬 캔디 당근 +${g.amount} (+${g.amount * 5} P)`;
    case "golden":
      return `✨ 황금 당근 +${g.amount} (+${g.amount * 10} P)`;
    case "gem":
      return `💎 보석 +${g.amount}`;
  }
}

function treasureToText(t: { kind: string; amount: number; points: number }): string {
  switch (t.kind) {
    case "candy":
      return `🍬 캔디 당근 +${t.amount} (+${t.points} P)`;
    case "golden":
      return `✨ 황금 당근 +${t.amount} (+${t.points} P)`;
    case "carrot":
      return `🥕 당근 +${t.amount} (+${t.points} P)`;
    case "seed":
      return `🌱 씨앗 +${t.amount}`;
    case "star":
      return `⭐ 별 +${t.amount}`;
    default:
      return `+${t.amount} ${t.kind}`;
  }
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
