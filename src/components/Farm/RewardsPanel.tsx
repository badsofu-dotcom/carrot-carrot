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
  MEDAL_LABELS,
  useRewardsStore,
  type GiftReward,
  type MedalId,
} from "../../features/collection/rewardsStore";
import { useItemsStore } from "../../features/collection/itemsStore";
import { canWithdraw, MIN_PAYOUT, totalPoints } from "../../lib/points";
import { apiCall, apiBaseUrl, tokenStore } from "../../lib/api";
import { haptic } from "../../design-system/haptic";

const BASE = import.meta.env.BASE_URL;

const MEDAL_ORDER: readonly MedalId[] = [
  "first_session",
  "first_harvest",
  "five_carrots",
  "perfect_combo",
  "first_candy",
  "first_golden",
];

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

  const claimedDay = useRewardsStore((s) => s.giftClaimedDay);
  const claimDailyGift = useRewardsStore((s) => s.claimDailyGift);
  const medals = useRewardsStore((s) => s.medals);

  const points = totalPoints({ carrots, candyCarrots: candy, goldenCarrots: golden });
  const withdrawable = canWithdraw(points);

  const [claimedThisOpen, setClaimedThisOpen] = useState<GiftReward | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClaimedThisOpen(null);
      setWithdrawStatus(null);
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
    if (reward.kind === "candy") incCandy(reward.amount);
    else if (reward.kind === "golden") incGolden(reward.amount);
    else if (reward.kind === "gem") {
      useItemsStore.getState().add("gem", reward.amount);
    }
    // "seed" rewards land via the same store path on the next focus
    // session tier — surfacing in inventory not yet wired for
    // direct-grant; documented as a known limitation.
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
          {/* Sheet */}
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
              // Center via margin auto. Don't use transform: translateX
              // here — framer-motion drives the y slide-in via the same
              // transform property and would clobber an inline X
              // translation, pushing the sheet off-screen-right on
              // mobile. Same fix as InventoryModal (PR-6.5).
              left: 0,
              right: 0,
              marginLeft: "auto",
              marginRight: "auto",
              bottom: 0,
              zIndex: 1051,
              width: "100%",
              maxWidth: "var(--app-max-width, 480px)",
              background: "#FFF8EE",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding:
                "12px calc(20px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))",
              maxHeight: "82vh",
              overflowY: "auto",
              boxShadow: "0 -8px 28px rgba(0,0,0,0.18)",
              boxSizing: "border-box",
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

            {/* Medals */}
            <Section title="훈장">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                }}
              >
                {MEDAL_ORDER.map((id) => {
                  const unlocked = medals.has(id);
                  return (
                    <div
                      key={id}
                      data-testid={`medal-${id}`}
                      style={{
                        background: "#fff",
                        borderRadius: 14,
                        padding: "10px 6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        opacity: unlocked ? 1 : 0.45,
                      }}
                    >
                      <img
                        src={`${BASE}assets/farm/rewards/${medalAsset(id)}.png`}
                        alt=""
                        width={36}
                        height={36}
                        style={{
                          objectFit: "contain",
                          filter: unlocked ? "none" : "grayscale(0.85)",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: "center",
                          color: unlocked ? "#2b2b2b" : "#888",
                        }}
                      >
                        {MEDAL_LABELS[id]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function medalAsset(id: MedalId): string {
  // Gold for the harder achievements, silver for mid, bronze for entry.
  switch (id) {
    case "perfect_combo":
    case "first_golden":
      return "medal_gold";
    case "five_carrots":
    case "first_candy":
      return "medal_silver";
    case "first_harvest":
    case "first_session":
    default:
      return "medal_bronze";
  }
}

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
