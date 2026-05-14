/**
 * AdRewardChannelModal — one ad watch grants exactly one of three
 * channels. The user picks which.
 *
 * Channels:
 *   1. watering   →  toolStore.refillFromAd() (+3 charges)
 *   2. gift       →  RewardsStore.claimDailyGift() (if unopened today)
 *   3. treasure   →  itemsStore "treasure_progress" +1 (placeholder
 *                    until the worker box-state route lands)
 *
 * The modal generates a per-open `nonce` (crypto.randomUUID()) and
 * keeps it in component state. The future Worker route /tools/refill
 * (and /boxes/...) should accept this nonce + check it against the
 * server-side ad-watched audit; in preview/local we don't verify.
 *
 * Daily cap: at most one ad reward per channel per KST day. Tracked
 * locally in safeStorage with the day key as suffix.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToolStore } from "../../features/collection/toolStore";
import { useRewardsStore } from "../../features/collection/rewardsStore";
import { useItemsStore } from "../../features/collection/itemsStore";
import { safeStorage } from "../../lib/safeStorage";
import { toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";

type Channel = "watering" | "gift" | "treasure";

const BASE = import.meta.env.BASE_URL;

function kstDayKey(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function dayClaimedKey(c: Channel): string {
  return `cc.ad.${c}.${kstDayKey()}`;
}

function alreadyClaimed(c: Channel): boolean {
  return safeStorage.get(dayClaimedKey(c)) === "1";
}

function markClaimed(c: Channel) {
  safeStorage.set(dayClaimedKey(c), "1");
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdRewardChannelModal({ open, onClose }: Props) {
  const refill = useToolStore((s) => s.refillFromAd);
  const claimGift = useRewardsStore((s) => s.claimDailyGift);
  const giftDay = useRewardsStore((s) => s.giftClaimedDay);
  const addItem = useItemsStore((s) => s.add);

  /** Per-open ad-watched nonce. Real ad SDK should sign this before
   *  the redeem POST hits /economy/ad-view. */
  const nonce = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    [open],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const giftAlreadyClaimed = giftDay === kstDayKey();

  const claim = (c: Channel) => {
    if (alreadyClaimed(c)) {
      toast("이 보상은 오늘 이미 받았어요");
      return;
    }
    haptic("medium");
    switch (c) {
      case "watering":
        if (!refill()) {
          toast("오늘 충전 한도가 가득 찼어요");
          return;
        }
        toast("⚡ 물뿌리개 +3 충전");
        break;
      case "gift":
        if (giftAlreadyClaimed) {
          toast("오늘 선물상자는 이미 열었어요");
          return;
        }
        if (!claimGift()) {
          toast("선물상자를 열 수 없어요");
          return;
        }
        toast("🎁 오늘의 선물 받았어요");
        break;
      case "treasure":
        addItem("star", 1);
        toast("🌟 보물 진행 +1 (별 +1)");
        break;
    }
    markClaimed(c);
    // TODO: post nonce + channel to worker `/economy/ad-view` once
    // the ad-token verification path is wired. The nonce stub here
    // is the idempotency hook the server should check.
    void nonce;
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1080,
              background: "rgba(0,0,0,0.5)",
            }}
            data-testid="ad-channel-backdrop"
          />
          <motion.div
            data-testid="ad-channel-modal"
            role="dialog"
            aria-modal="true"
            aria-label="광고 보상 선택"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1081,
              width: "min(360px, calc(100% - 32px))",
              background: "#FFF8EE",
              borderRadius: 20,
              padding: "20px 22px",
              boxShadow: "0 12px 36px rgba(0,0,0,0.32)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, textAlign: "center" }}>
              어떤 보상을 받을까요?
            </h3>
            <p
              style={{
                margin: "6px 0 14px",
                fontSize: 12,
                color: "#888",
                textAlign: "center",
              }}
            >
              하나만 골라요 · 채널별 하루 1회
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ChannelRow
                icon={`${BASE}assets/farm/icons/icon_energy.png`}
                label="물뿌리개 +3"
                hint="오늘 물뿌리개를 다 썼을 때"
                disabled={alreadyClaimed("watering")}
                onClick={() => claim("watering")}
                testId="ad-channel-watering"
              />
              <ChannelRow
                icon={`${BASE}assets/farm/rewards/gift_box.png`}
                label="오늘의 선물상자"
                hint={giftAlreadyClaimed ? "오늘은 이미 받음" : "한 번 더 굴리기"}
                disabled={alreadyClaimed("gift") || giftAlreadyClaimed}
                onClick={() => claim("gift")}
                testId="ad-channel-gift"
              />
              <ChannelRow
                icon={`${BASE}assets/farm/rewards/treasure_chest.png`}
                label="보물 진행 +1 (별 +1)"
                hint="주간 보물상자에 한 발 더"
                disabled={alreadyClaimed("treasure")}
                onClick={() => claim("treasure")}
                testId="ad-channel-treasure"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: 12,
                width: "100%",
                height: 36,
                fontSize: 12,
                fontWeight: 700,
                background: "transparent",
                border: "none",
                color: "#888",
                cursor: "pointer",
              }}
            >
              나중에
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ChannelRow({
  icon,
  label,
  hint,
  disabled,
  onClick,
  testId,
}: {
  icon: string;
  label: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 10,
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.06)",
        background: disabled ? "rgba(0,0,0,0.04)" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        textAlign: "left",
      }}
    >
      <img src={icon} alt="" width={40} height={40} style={{ objectFit: "contain", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, color: "#666" }}>{hint}</span>
      </span>
      <span style={{ fontSize: 18, color: "#FF7B61" }}>›</span>
    </button>
  );
}
