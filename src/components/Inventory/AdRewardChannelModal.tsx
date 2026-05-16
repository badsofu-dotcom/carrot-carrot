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
import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToolStore } from "../../features/collection/toolStore";
import { useRewardsStore } from "../../features/collection/rewardsStore";
import { useItemsStore } from "../../features/collection/itemsStore";
import { useFarmStore } from "../../features/collection/farmStore";
import { useCollectionStore } from "../../features/collection/collectionStore";
import { useBuffsStore } from "../../features/collection/buffsStore";
import { passivesFromOwned } from "../../lib/dogamPassives";
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

// PR-32 — daily ad-claim counter (any channel). safeStorage 의 키는
// KST 일자별로 분리 → 자정 이후 자동 0 으로 리셋. Numeric coercion
// 으로 corrupted JSON 도 안전.
function adDailyKey(day: string): string {
  return `cc.ad.dailyCount.${day}`;
}
function readAdDailyCount(day: string): number {
  const raw = safeStorage.get(adDailyKey(day));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function writeAdDailyCount(day: string, n: number): void {
  try {
    safeStorage.set(adDailyKey(day), String(n));
  } catch {
    /* ignore */
  }
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
    // PR-24 — heart gate (no-consume yet). 잔여 0 이면 채널별 사이드
    // 이펙트 시작 전에 abort. 성공 path 의 마지막에서 consume.
    const items = useItemsStore.getState();
    if ((items.counts.heart ?? 0) <= 0) {
      toast("하트가 부족해요 — 내일 자정에 다시 채워져요");
      return;
    }
    haptic("medium");
    switch (c) {
      case "watering": {
        // Soup buff (PR-9) — pre-consume so a no-op refill doesn't
        // burn the buff. If we can't actually refill, restore it by
        // re-activating; otherwise grant +1 on top of the standard +3.
        const soupActive = useBuffsStore.getState().consume("soup");
        if (!refill(soupActive ? 1 : 0)) {
          if (soupActive) useBuffsStore.getState().activate("soup");
          toast("오늘 충전 한도가 가득 찼어요");
          return;
        }
        toast(soupActive ? "⚡ 물뿌리개 +4 충전 (수프 효과)" : "⚡ 물뿌리개 +3 충전");
        break;
      }
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
      case "treasure": {
        // PR-48 — 보물 진행 +1 + 랜덤 보상 풀 1개.
        useRewardsStore.getState().addTreasureProgress(1);
        const rewards = [
          { p: 0.35, label: "⭐ 별 +1", apply: () => addItem("star", 1) },
          { p: 0.25, label: "💎 보석 +1", apply: () => addItem("gem", 1) },
          {
            p: 0.15,
            label: "🌱 씨앗 +3",
            apply: () => useFarmStore.getState().growAllPlanted(0, null, 3),
          },
          {
            p: 0.1,
            label: "🍬 캔디당근 +1 (+5 P)",
            apply: () => useFarmStore.getState().incCandyCarrots(1),
          },
          { p: 0.1, label: "⚡ 번개 +1", apply: () => addItem("bolt", 1) },
          {
            p: 0.05,
            label: "✨ 황금당근 +1 (+10 P)",
            apply: () => useFarmStore.getState().incGoldenCarrots(1),
          },
        ];
        const r = Math.random();
        let acc = 0;
        let pickedLabel = rewards[0].label;
        for (const reward of rewards) {
          acc += reward.p;
          if (r < acc) {
            reward.apply();
            pickedLabel = reward.label;
            break;
          }
        }
        toast(`🎁 보물 진행 +1 · ${pickedLabel}`);
        break;
      }
    }
    // PR-24 — heart consume + carrot_coin grant on success path.
    items.consume("heart", 1);
    items.add("carrot_coin", 5);

    // PR-32 — N-th daily ad-claim bonus (carrot/token). KST 일자 별
    // 카운터로 5회 까지 P 보장 (1/5/5/10/10/20 carrot), 6~10회 토큰만
    // (gem or bolt random), 11회 이상 보너스 없음 (영구 cooldown).
    {
      const today = kstDayKey();
      const cur = readAdDailyCount(today);
      const n = cur + 1;
      writeAdDailyCount(today, n);
      const farm = useFarmStore.getState();
      // PR-38 — 도감 패시브 (15마리 이상) 적용 → carrot tier 에 추가
      // bonus.
      const dogamOwned = useCollectionStore.getState().ownedCharacters.length;
      const adBonus = passivesFromOwned(dogamOwned).adRewardBonusCarrot;
      if (n === 1 || n === 2) {
        farm.incCarrots(5 + adBonus);
        toast(`🎬 광고 ${n}회 → 당근 +${5 + adBonus}`);
      } else if (n === 3 || n === 4) {
        farm.incCarrots(10 + adBonus);
        toast(`🎬 광고 ${n}회 → 당근 +${10 + adBonus}`);
      } else if (n === 5) {
        farm.incCarrots(20 + adBonus);
        toast(
          `🎬 광고 5회 달성 → 당근 +${20 + adBonus} (오늘 50 P 보장 완료)`,
        );
      } else if (n <= 10) {
        // 6~10: 토큰 (gem or bolt 50/50)
        const pickGem = Math.random() < 0.5;
        if (pickGem) {
          items.add("gem", 1);
          toast(`🎬 광고 ${n}회 → 💎 보석 +1`);
        } else {
          items.add("bolt", 1);
          toast(`🎬 광고 ${n}회 → ⚡ 번개 +1`);
        }
      } else {
        toast(`🎬 광고 ${n}회 — 오늘 한도 도달 (자정 리셋)`);
      }
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            // PR-42 — 단일 fixed 컨테이너 + flex centering. 이전 코드는
            // 내부 modal 카드에 `left:50%; top:50%; transform:
            // translate(-50%,-50%)` 를 직접 걸었는데 framer-motion 의
            // y/opacity 애니메이션이 같은 transform 속성을 덮어써서
            // 모바일에서 모달이 우측으로 밀려 잘림.
            // BunnyGachaModal 패턴 차용: outer fixed inset:0 + display
            // flex 중앙 정렬 → inner motion 카드는 transform 자유 사용.
            position: "fixed",
            inset: 0,
            zIndex: 1080,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding:
              "16px calc(16px + env(safe-area-inset-right)) 16px calc(16px + env(safe-area-inset-left))",
            boxSizing: "border-box",
          }}
          data-testid="ad-channel-backdrop"
        >
          <motion.div
            data-testid="ad-channel-modal"
            role="dialog"
            aria-modal="true"
            aria-label="광고 보상 선택"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              // No fixed positioning — flex parent centers. width clamps
              // at min(360, parent inner width) so 한 padding 16 좌우
              // 빼고도 자연스럽게 viewport 안에 머무름.
              width: "100%",
              maxWidth: 360,
              background: "#FFF8EE",
              borderRadius: 20,
              padding: "20px 22px",
              boxShadow: "0 12px 36px rgba(0,0,0,0.32)",
              boxSizing: "border-box",
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
                label="보물 진행 +1 (랜덤 보상)"
                hint="별/보석/씨앗/캔디/번개/황금 중 1종"
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
        </motion.div>
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
