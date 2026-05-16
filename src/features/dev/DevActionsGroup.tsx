/**
 * DEV-only cheat panel. Extracted from SettingsPage (PR-19) so the
 * production bundle can drop the whole module via the
 * `import.meta.env.DEV && <DevActionsGroup />` guard in
 * `SettingsPage.tsx`.
 *
 * Action catalog (16 rows total):
 *   - 4 legacy actions from the previous inline DevActionsGroup
 *     (test success / legendary preview / dogam fill / WIPE)
 *   - 14 PR-19 cheats:
 *       모든 자원 +999 / 당근 +100 / 캔디 +10 / 황금 +10 / 씨앗 +50 /
 *       별·보석 +20 / 도구 아이템 충전 / BGM·SFX 토글 /
 *       광고 보상 즉시 트리거 / 보물 진행 +7 / 버프 일괄 활성 /
 *       메달 전부 unlock / 오늘의 선물 리셋 / 시간대 강제 사이클
 *
 * Every cheat is a one-tap action with haptic + toast feedback. State
 * mutations call the same store actions runtime code uses, so the
 * resulting state is reachable through normal gameplay — no test-only
 * back doors.
 */
import { useState } from "react";
import { Card, toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";
import { useCollectionStore } from "../collection/collectionStore";
import { CHARACTERS } from "../collection/collectionData";
import { useFarmStore } from "../collection/farmStore";
import { useItemsStore, type ItemCode } from "../collection/itemsStore";
import { useBuffsStore } from "../collection/buffsStore";
import {
  useRewardsStore,
  type MedalId,
} from "../collection/rewardsStore";
import { useToolStore, TOOL_CONSTANTS } from "../collection/toolStore";
import { useSoundStore } from "../../store/soundStore";
import { safeStorage } from "../../lib/safeStorage";
import {
  FARM_FORCE_SLOT_KEY,
  type FarmBgSlot,
} from "../../lib/farmBackground";
import { UnlockOverlay } from "../collection/UnlockOverlay";

const ALL_MEDALS: readonly MedalId[] = [
  "first_harvest",
  "five_carrots",
  "first_session",
  "perfect_combo",
  "first_candy",
  "first_golden",
  "dogam_25",
  "dogam_50",
  "dogam_75",
  "dogam_100",
  "quiet_sky",
];

const FORCE_SLOT_CYCLE: readonly (FarmBgSlot | "")[] = [
  "", // none → revert to auto
  "bg_day",
  "bg_evening",
  "bg_night",
  "bg_rainy",
  "bg_snowy",
];

const REFILLABLE_ITEM_CODES: readonly ItemCode[] = [
  "hourglass",
  "bolt",
  "juice",
  "soup",
  "cake",
];

export function DevActionsGroup() {
  const applySession = useCollectionStore((s) => s.applySession);
  const forceUnlock = useCollectionStore((s) => s.forceUnlock);
  const resetAll = useCollectionStore((s) => s.resetAll);
  const totalCarrots = useCollectionStore((s) => s.totalCarrots);
  const ownedCount = useCollectionStore((s) => s.ownedCharacters.length);
  const [previewQueue, setPreviewQueue] = useState<string[]>([]);

  // Stores used by the new cheats. Reads are select-form (single value)
  // to minimize re-renders; actions are pulled as functions so the
  // closure stays stable.
  const incCarrots = useFarmStore((s) => s.incCarrots);
  const incCandy = useFarmStore((s) => s.incCandyCarrots);
  const incGolden = useFarmStore((s) => s.incGoldenCarrots);
  const growAllPlanted = useFarmStore((s) => s.growAllPlanted);
  const addItem = useItemsStore((s) => s.add);
  const activateBuff = useBuffsStore((s) => s.activate);
  const unlockMedal = useRewardsStore((s) => s.unlockMedal);
  const addTreasureProgress = useRewardsStore((s) => s.addTreasureProgress);
  const resetDailyGiftClaim = useRewardsStore((s) => s.resetDailyGiftClaim);
  const claimDailyGift = useRewardsStore((s) => s.claimDailyGift);
  const refillFromAd = useToolStore((s) => s.refillFromAd);
  const sfxMuted = useSoundStore((s) => s.sfxMuted);
  const setSfxMuted = useSoundStore((s) => s.setSfxMuted);
  const farmBgmEnabled = useSoundStore((s) => s.farmBgmEnabled);
  const setFarmBgmEnabled = useSoundStore((s) => s.setFarmBgmEnabled);

  // ── Legacy 4 ─────────────────────────────────────────────────────
  const handleTestSuccess = () => {
    haptic("success");
    const newIds = applySession({
      presetMin: 25,
      focusedMs: 25 * 60 * 1000,
      type: "complete",
    });
    if (newIds.length) {
      toast(`+당근 1, 신규 해제 ${newIds.length}개`);
      setPreviewQueue(newIds);
    } else {
      toast("+당근 1");
    }
  };

  const handlePreviewLegendary = () => {
    haptic("success");
    const id = forceUnlock("legendary-demon");
    if (id) setPreviewQueue([id]);
    else setPreviewQueue(["legendary-demon"]);
  };

  const handleSeedAll = () => {
    haptic("warning");
    const lastIds: string[] = [];
    for (const c of CHARACTERS) {
      const r = forceUnlock(c.id);
      if (r) lastIds.push(r);
    }
    if (lastIds.length) toast(`도감 ${lastIds.length}마리 추가`);
    else toast("이미 다 있어");
  };

  const handleReset = () => {
    if (!window.confirm("로컬 도감/통계를 모두 지울까?")) return;
    resetAll();
    haptic("warning");
    toast("로컬 데이터 초기화");
  };

  // ── PR-19 cheats (PR-25 expanded) ────────────────────────────────
  // Catch-all: every farm currency + every bag item + watering can max
  // + every medal. Idempotent — re-tap just tops things off.
  const handleAllResources999 = () => {
    haptic("success");
    // Farm currencies (header chips)
    incCarrots(999);
    incCandy(999);
    incGolden(999);
    growAllPlanted(0, null, 999); // seeds via side-door
    // Bag items — every defined code. carrot/candy/golden are mirrored
    // (their canonical SoT is farmStore, not itemsStore) so we skip
    // those three to avoid double-counting in the bag grid.
    addItem("carrot_coin", 999);
    addItem("hourglass", 99);
    addItem("bolt", 99);
    addItem("juice", 99);
    addItem("soup", 99);
    addItem("cake", 99);
    // PR-31 — medal item code 폐기. 명예 (medal achievement) 는
    // rewardsStore.medals Set 으로 unlockMedal × 11 IDs (아래) 가 채움.
    addItem("star", 999);
    addItem("gem", 999);
    addItem("heart", 99); // maxStack 5 로 clamp 됨
    // Tools — watering can to max
    refillFromAd(TOOL_CONSTANTS.MAX_DAILY);
    // Medals — every defined ID
    for (const m of ALL_MEDALS) unlockMedal(m);
    toast("모든 자원/도구/메달 +max");
  };
  const handleCarrot100 = () => {
    haptic("light");
    incCarrots(100);
    toast("당근 +100");
  };
  const handleCandy10 = () => {
    haptic("light");
    incCandy(10);
    toast("캔디 +10");
  };
  const handleGolden10 = () => {
    haptic("light");
    incGolden(10);
    toast("황금 +10");
  };
  const handleSeed50 = () => {
    haptic("light");
    growAllPlanted(0, null, 50);
    toast("씨앗 +50");
  };
  const handleStarGem20 = () => {
    haptic("light");
    addItem("star", 20);
    addItem("gem", 20);
    toast("별 +20 · 보석 +20");
  };
  const handleRefillTools = () => {
    haptic("success");
    for (const code of REFILLABLE_ITEM_CODES) addItem(code, 9);
    // Also top up the watering can.
    refillFromAd(TOOL_CONSTANTS.MAX_DAILY);
    toast("도구 아이템 충전 (각 +9, 물뿌리개 max)");
  };
  const handleToggleAudio = () => {
    const nextBgm = !farmBgmEnabled;
    const nextSfx = sfxMuted; // toggling: if SFX is muted, unmute (and v.v.)
    setFarmBgmEnabled(nextBgm);
    setSfxMuted(!nextSfx);
    haptic("light");
    toast(
      `BGM ${nextBgm ? "ON" : "OFF"} · SFX ${!nextSfx ? "ON" : "OFF"}`,
    );
  };
  const handleAllAdRewards = () => {
    haptic("success");
    // Watering refill +3 (+ pre-consume soup if active)
    refillFromAd(0);
    // Daily gift roll (if not already claimed today, otherwise no-op)
    claimDailyGift();
    // Treasure progress +1
    addTreasureProgress(1);
    toast("광고 보상 3채널 즉시 적용");
  };
  const handleTreasureMax = () => {
    haptic("success");
    addTreasureProgress(7);
    toast("주간 보물 진행 +7 (max)");
  };
  const handleActivateBuffs = () => {
    haptic("success");
    activateBuff("juice");
    activateBuff("soup");
    activateBuff("cake");
    toast("주스·수프·케이크 버프 모두 활성");
  };
  const handleUnlockAllMedals = () => {
    haptic("success");
    // PR-49 — rewardsStore.unlockAllMedals() store method 사용. 신규
    // unlock 개수 반환 + cc:medal:unlocked 이벤트 dispatch (SFX 트리거).
    const n = useRewardsStore.getState().unlockAllMedals();
    toast(n > 0 ? `메달 ${n}개 unlock` : "이미 다 unlock 됨");
  };
  const handleResetDailyGift = () => {
    resetDailyGiftClaim();
    haptic("warning");
    toast("오늘의 선물 다시 받기 가능");
  };
  const handleForceSlotCycle = () => {
    const cur = safeStorage.get(FARM_FORCE_SLOT_KEY) ?? "";
    const idx = FORCE_SLOT_CYCLE.indexOf(cur as FarmBgSlot);
    const nextIdx = (idx + 1) % FORCE_SLOT_CYCLE.length;
    const next = FORCE_SLOT_CYCLE[nextIdx];
    if (next === "") {
      safeStorage.remove(FARM_FORCE_SLOT_KEY);
    } else {
      safeStorage.set(FARM_FORCE_SLOT_KEY, next);
    }
    try {
      window.dispatchEvent(new CustomEvent("cc:dev:forceSlot"));
    } catch {
      /* ignore */
    }
    haptic("light");
    toast(next === "" ? "시간대 자동 복귀" : `시간대 강제: ${next}`);
  };

  return (
    <>
      <SettingsGroupHeader title="개발자 (DEV)" />
      <Card padded={false} style={{ overflow: "hidden", padding: 0, marginBottom: 16 }}>
        <DevRow
          label="테스트 성공 처리"
          sub={`+당근 1, 자동 해제 · 누적 ${totalCarrots} / 보유 ${ownedCount}마리`}
          onClick={handleTestSuccess}
        />
        <DevRow label="레전더리 미리보기" sub="해제 오버레이 프리뷰" onClick={handlePreviewLegendary} />
        <DevRow label="도감 전부 채우기" sub="12종 캐릭터 unlock" onClick={handleSeedAll} />
        <DevRow label="모든 자원 +999" sub="당근/캔디/황금/씨앗/별/보석" onClick={handleAllResources999} />
        <DevRow label="당근 +100" onClick={handleCarrot100} />
        <DevRow label="캔디 +10" onClick={handleCandy10} />
        <DevRow label="황금 +10" onClick={handleGolden10} />
        <DevRow label="씨앗 +50" onClick={handleSeed50} />
        <DevRow label="별·보석 +20" onClick={handleStarGem20} />
        <DevRow label="도구 아이템 충전" sub="hourglass/bolt/juice/soup/cake 각 +9, 물뿌리개 max" onClick={handleRefillTools} />
        <DevRow label="BGM·SFX 일괄 토글" sub={`현재 BGM ${farmBgmEnabled ? "ON" : "OFF"} · SFX ${sfxMuted ? "OFF" : "ON"}`} onClick={handleToggleAudio} />
        <DevRow label="광고 보상 즉시 트리거" sub="물뿌리개 +3 + 선물 + 보물 진행 +1" onClick={handleAllAdRewards} />
        <DevRow label="주간 보물 진행 +7" sub="다음 탭에서 열기 활성" onClick={handleTreasureMax} />
        <DevRow label="버프 일괄 활성" sub="juice + soup + cake 동시 ON" onClick={handleActivateBuffs} />
        <DevRow label="메달 전부 unlock" sub={`정의된 ${ALL_MEDALS.length}개`} onClick={handleUnlockAllMedals} />
        <DevRow label="오늘의 선물 다시 받기" sub="giftClaimedDay 리셋" onClick={handleResetDailyGift} />
        <DevRow label="시간대 강제 사이클" sub="auto → day → evening → night → rainy → snowy → auto" onClick={handleForceSlotCycle} />
        <DevRow
          label="로컬 데이터 초기화"
          sub="도감/누적/연속 전부 지움"
          rightLabel="WIPE"
          onClick={handleReset}
          last
        />
      </Card>
      <UnlockOverlay queue={previewQueue} onClose={() => setPreviewQueue([])} />
    </>
  );
}

function SettingsGroupHeader({ title }: { title: string }) {
  return (
    <p
      className="t-micro"
      style={{ margin: "0 0 6px 12px", color: "var(--text-tertiary)" }}
    >
      {title}
    </p>
  );
}

function DevRow({
  label,
  sub,
  rightLabel,
  onClick,
  last = false,
}: {
  label: string;
  sub?: string;
  rightLabel?: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={`row-dev-${label.replace(/\s+/g, "-")}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid var(--border-subtle)",
        cursor: "pointer",
        background: "var(--bg-elevated)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{label}</p>
        {sub && (
          <p
            className="t-caption"
            style={{ margin: 0, marginTop: 2, color: "var(--text-tertiary)" }}
          >
            {sub}
          </p>
        )}
      </div>
      {rightLabel ? (
        <span
          style={{
            color: "var(--accent-devil)",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {rightLabel}
        </span>
      ) : (
        <Chevron />
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
      />
    </svg>
  );
}
