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
import { useFarmStore } from "../../features/collection/farmStore";
import { useCollectionStore } from "../../features/collection/collectionStore";
import { passivesFromOwned } from "../../lib/dogamPassives";
import { safeStorage } from "../../lib/safeStorage";
import { kstDayKey } from "../../lib/kst";
import { toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";
import { watchRewardedAd } from "../../lib/tossRewardedAd";
import {
  safeAreaBackdropStyle,
  safeAreaModalStyle,
} from "../../lib/ui/safeAreaModal";

type Channel = "watering" | "gift" | "treasure";

const BASE = import.meta.env.BASE_URL;

// PR-102 — kstDayKey 단일 helper.
function dayClaimedKey(c: Channel): string {
  return `cc.ad.${c}.${kstDayKey()}`;
}

// PR-141 (Round 21 베타7 피드백) — 베타 기간 광고 일일 한도 완전 해제.
// 사용자: "오늘 볼 수 있는 광고가 다 소진됨" 로 베타 진행이 막힘.
// 두 layer 의 cap 을 BETA_UNLIMITED_ADS 플래그로 일괄 우회:
//   1) per-channel cap (`cc.ad.${c}.${ymd}`) — alreadyClaimed() 가 false 반환
//   2) N-th daily counter (`cc.ad.dailyCount.${ymd}`) — readAdDailyCount() 가 0 반환
//
// 정식 출시 전 BETA_UNLIMITED_ADS=false 로 되돌릴 것. localStorage 의
// 기존 값은 그대로 보존되어 플래그 OFF 시 복귀 정상.
//
// 주의: 선물상자(gift) 의 `claimDailyGift` 는 rewardsStore 의 자체 cap
// 이라 이 플래그 영향 X — 의도적 (실 보상 한도 보존).
const BETA_UNLIMITED_ADS = true;

// PR-32 — daily ad-claim counter (any channel). safeStorage 의 키는
// KST 일자별로 분리 → 자정 이후 자동 0 으로 리셋. Numeric coercion
// 으로 corrupted JSON 도 안전.
function adDailyKey(day: string): string {
  return `cc.ad.dailyCount.${day}`;
}
function readAdDailyCount(day: string): number {
  if (BETA_UNLIMITED_ADS) return 0;
  const raw = safeStorage.get(adDailyKey(day));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function writeAdDailyCount(day: string, n: number): void {
  if (BETA_UNLIMITED_ADS) return;
  try {
    safeStorage.set(adDailyKey(day), String(n));
  } catch {
    /* ignore */
  }
}

function alreadyClaimed(c: Channel): boolean {
  if (BETA_UNLIMITED_ADS) return false;
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

  // R30 PR-174 — 광고 재생 중 채널 버튼 비활성 (중복 호출 차단).
  const [watching, setWatching] = useState(false);

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

  const claim = async (c: Channel) => {
    if (watching) return;
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

    // R30 PR-174 — 광고 재생 누락 회귀 fix. 이전 코드는 SDK 호출 없이
    // 곧장 보상을 지급해 사용자 체감상 "광고가 재생되지 않음" 이었음.
    // 토스 보상형 SDK 호출 → granted/simulated 일 때만 보상 지급.
    setWatching(true);
    toast("📺 광고 재생 중…");
    const adResult = await watchRewardedAd();
    setWatching(false);
    if (adResult.kind === "cancelled") {
      toast("광고가 취소돼서 보상이 지급되지 않았어요");
      return;
    }
    if (adResult.kind === "failed" || adResult.kind === "unsupported") {
      toast("광고를 재생할 수 없어요 — 잠시 후 다시 시도해 주세요");
      return;
    }
    // granted (실 광고 시청 완료) 또는 simulated (mock env) → 보상 지급
    switch (c) {
      case "watering": {
        // PR-92 — soup 재설계로 +1 차지 combo 제거. 단순 +3 charge.
        if (!refill(0)) {
          toast("오늘 충전 한도가 가득 찼어요");
          return;
        }
        toast("⚡ 물뿌리개 +3 충전");
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
        // PR-152 (Round 25) — fragment entry 제거 (v1 archive). 비율 R21
        // 원형으로 복원: star 0.35 / gem 0.25 / candy 0.25 / bolt 0.10 /
        // golden 0.05. sum = 1.00.
        const rewards = [
          { p: 0.35, label: "⭐ 별 +1", apply: () => addItem("star", 1) },
          { p: 0.25, label: "💎 보석 +1", apply: () => addItem("gem", 1) },
          {
            p: 0.25,
            label: "🍬 캔디당근 +1",
            apply: () => useFarmStore.getState().incCandyCarrots(1),
          },
          { p: 0.1, label: "⚡ 번개 +1", apply: () => addItem("bolt", 1) },
          {
            p: 0.05,
            label: "✨ 황금당근 +1",
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
          onClick={watching ? undefined : onClose}
          style={{
            // PR-42 — outer fixed inset:0 + flex centering 패턴.
            // PR-79 — safeAreaBackdropStyle 로 공통화. zIndex 만 override.
            ...safeAreaBackdropStyle,
            zIndex: 1080,
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
              // PR-79 — safeAreaModalStyle 로 maxHeight + safe-area
              // bottom + overflow 일관성 보장.
              ...safeAreaModalStyle({ maxWidth: 360 }),
              background: "#FFF8EE",
              borderRadius: 20,
              boxShadow: "0 12px 36px rgba(0,0,0,0.32)",
            }}
          >
            {/* PR-84 — modal bg #FFF8EE fixed → fixed dark heading. */}
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, textAlign: "center", color: "#2b2b2b" }}>
              어떤 보상을 받을까요?
            </h3>
            <p
              style={{
                margin: "6px 0 14px",
                fontSize: 12,
                color: "#6a6055",
                textAlign: "center",
              }}
            >
              하나만 골라요 · 채널별 하루 1회
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ChannelRow
                icon={`${BASE}assets/farm/icons/icon_energy.png`}
                label="물뿌리개 +3"
                hint={watching ? "광고 재생 중…" : "오늘 물뿌리개를 다 썼을 때"}
                disabled={watching || alreadyClaimed("watering")}
                onClick={() => void claim("watering")}
                testId="ad-channel-watering"
              />
              <ChannelRow
                icon={`${BASE}assets/farm/rewards/gift_box.png`}
                label="오늘의 선물상자"
                hint={
                  watching
                    ? "광고 재생 중…"
                    : giftAlreadyClaimed
                      ? "오늘은 이미 받음"
                      : "한 번 더 굴리기"
                }
                disabled={watching || alreadyClaimed("gift") || giftAlreadyClaimed}
                onClick={() => void claim("gift")}
                testId="ad-channel-gift"
              />
              <ChannelRow
                icon={`${BASE}assets/farm/rewards/treasure_chest.png`}
                label="보물 진행 +1 (랜덤 보상)"
                hint={watching ? "광고 재생 중…" : "별/보석/캔디/번개/황금 중 1종"}
                disabled={watching || alreadyClaimed("treasure")}
                onClick={() => void claim("treasure")}
                testId="ad-channel-treasure"
              />
            </div>
            <button
              type="button"
              disabled={watching}
              onClick={watching ? undefined : onClose}
              style={{
                marginTop: 12,
                width: "100%",
                height: 36,
                fontSize: 12,
                fontWeight: 700,
                background: "transparent",
                border: "none",
                color: "#6a6055",
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
        {/* PR-83 — card bg 가 fixed #fff 이므로 label 도 fixed dark
            (이전엔 미지정 → dark mode 에서 body inherited light text →
            흰 카드 위 흰 글씨로 가독성 상실). hint #666 contrast 5.7:1 유지. */}
        <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#2b2b2b" }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, color: "#666" }}>{hint}</span>
      </span>
      <span style={{ fontSize: 18, color: "var(--accent-carrot, #FF7B61)" }}>›</span>
    </button>
  );
}
