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
 *       모든 자원 +999 / 당근 +100 / 캔디 +10 / 황금 +10 /
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
import { useFarmhubStore } from "../decor/farmhubStore";
import {
  useDevHitRegionStore,
  DEFAULT_FARMHUB_HIT_REGION,
  DEFAULT_FARMHUB_LABEL_POS,
} from "./devHitRegionStore";

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
  // R26 PR-154 — 버섯집 hit-region 시각 보정.
  // R26.1 PR-156 — 라벨 좌표 (labelPos) 도 동일 패널에서 보정.
  const hitShow = useDevHitRegionStore((s) => s.show);
  const hitRegion = useDevHitRegionStore((s) => s.region);
  const hitToggle = useDevHitRegionStore((s) => s.toggleShow);
  const hitSetRegion = useDevHitRegionStore((s) => s.setRegion);
  const hitReset = useDevHitRegionStore((s) => s.resetRegion);
  const labelPos = useDevHitRegionStore((s) => s.labelPos);
  const setLabelPos = useDevHitRegionStore((s) => s.setLabelPos);
  const resetLabelPos = useDevHitRegionStore((s) => s.resetLabelPos);

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
    // PR-109 — seeds 자원 폐기.
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
  // PR-109 — handleSeed50 제거 (씨앗 자원 폐기).
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
        <DevRow label="모든 자원 +999" sub="당근/캔디/황금/별/보석" onClick={handleAllResources999} />
        <DevRow label="당근 +100" onClick={handleCarrot100} />
        <DevRow label="캔디 +10" onClick={handleCandy10} />
        <DevRow label="황금 +10" onClick={handleGolden10} />
        {/* PR-109 — 씨앗 row 제거 */}
        <DevRow label="별·보석 +20" onClick={handleStarGem20} />
        <DevRow label="도구 아이템 충전" sub="hourglass/bolt/juice/soup/cake 각 +9, 물뿌리개 max" onClick={handleRefillTools} />
        <DevRow label="BGM·SFX 일괄 토글" sub={`현재 BGM ${farmBgmEnabled ? "ON" : "OFF"} · SFX ${sfxMuted ? "OFF" : "ON"}`} onClick={handleToggleAudio} />
        <DevRow label="광고 보상 즉시 트리거" sub="물뿌리개 +3 + 선물 + 보물 진행 +1" onClick={handleAllAdRewards} />
        <DevRow label="주간 보물 진행 +7" sub="다음 탭에서 열기 활성" onClick={handleTreasureMax} />
        <DevRow label="버프 일괄 활성" sub="juice + soup + cake 동시 ON" onClick={handleActivateBuffs} />
        <DevRow label="메달 전부 unlock" sub={`정의된 ${ALL_MEDALS.length}개`} onClick={handleUnlockAllMedals} />
        <DevRow label="오늘의 선물 다시 받기" sub="giftClaimedDay 리셋" onClick={handleResetDailyGift} />
        <DevRow label="시간대 강제 사이클" sub="auto → day → evening → night → rainy → snowy → auto" onClick={handleForceSlotCycle} />
        {/* PR-152 (Round 25) — 버섯집 v2 trigger. R26 에서 도감 자동
            지급 추가됐지만 dev 수동 trigger 는 디버그용 유지. */}
        <DevRow
          label="🐰 다음 가구 받기"
          sub="(R26: 도감 자동 지급 추가. 이 버튼은 DEV 만)"
          onClick={() => {
            const r = useFarmhubStore.getState().grantNext();
            haptic(r.ok ? "success" : "warning");
            if (r.ok) {
              toast(`🐰 다음 가구 도착 (${r.furnitureId})`);
            } else if (r.reason === "all_placed") {
              toast("✨ 모든 가구 배치 완료");
            } else if (r.reason === "already_pending") {
              toast("이미 보관함에 가구가 있어요");
            }
          }}
        />
        <DevRow
          label="🐰 버섯집 진행 reset"
          sub="step 0, pending null, onboarding wipe"
          onClick={() => {
            useFarmhubStore.getState().reset();
            haptic("warning");
            toast("버섯집 리셋");
          }}
        />
        {/* PR-154 (Round 26) — 농장 버섯집 hit-region 시각 보정. */}
        <DevRow
          label="🍄 버섯집 영역 표시"
          sub={
            hitShow
              ? `ON · L${hitRegion.left} T${hitRegion.top} W${hitRegion.width} H${hitRegion.height}`
              : "OFF — 켜고 농장 진입해서 빨간 박스가 버섯집 덮는지 확인"
          }
          onClick={() => {
            hitToggle();
            haptic("light");
          }}
        />
        {hitShow && (
          <>
            <DevRow
              label="◀ ▶  left"
              sub={`현재 ${hitRegion.left}%`}
              onClick={() => {
                // Toggle row tap = +1; long-press 대신 별도 -1 row.
                hitSetRegion({ left: hitRegion.left + 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="−  left -1%"
              sub={`현재 ${hitRegion.left}%`}
              onClick={() => {
                hitSetRegion({ left: hitRegion.left - 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="▲ ▼  top"
              sub={`현재 ${hitRegion.top}% (탭: +1%)`}
              onClick={() => {
                hitSetRegion({ top: hitRegion.top + 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="−  top -1%"
              sub={`현재 ${hitRegion.top}%`}
              onClick={() => {
                hitSetRegion({ top: hitRegion.top - 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="⟷  width"
              sub={`현재 ${hitRegion.width}% (탭: +1%)`}
              onClick={() => {
                hitSetRegion({ width: hitRegion.width + 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="−  width -1%"
              sub={`현재 ${hitRegion.width}%`}
              onClick={() => {
                hitSetRegion({ width: hitRegion.width - 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="↕  height"
              sub={`현재 ${hitRegion.height}% (탭: +1%)`}
              onClick={() => {
                hitSetRegion({ height: hitRegion.height + 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="−  height -1%"
              sub={`현재 ${hitRegion.height}%`}
              onClick={() => {
                hitSetRegion({ height: hitRegion.height - 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="↩  기본값 복원"
              sub={`L${DEFAULT_FARMHUB_HIT_REGION.left} T${DEFAULT_FARMHUB_HIT_REGION.top} W${DEFAULT_FARMHUB_HIT_REGION.width} H${DEFAULT_FARMHUB_HIT_REGION.height}`}
              onClick={() => {
                hitReset();
                haptic("warning");
                toast("기본값으로 복원했어요");
              }}
            />
            {/* R26.1 — 라벨 좌표 ± */}
            <DevRow
              label="+  label left +1%"
              sub={`현재 ${labelPos.left}%`}
              onClick={() => {
                setLabelPos({ left: labelPos.left + 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="−  label left -1%"
              sub={`현재 ${labelPos.left}%`}
              onClick={() => {
                setLabelPos({ left: labelPos.left - 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="+  label top +1%"
              sub={`현재 ${labelPos.top}%`}
              onClick={() => {
                setLabelPos({ top: labelPos.top + 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="−  label top -1%"
              sub={`현재 ${labelPos.top}%`}
              onClick={() => {
                setLabelPos({ top: labelPos.top - 1 });
                haptic("light");
              }}
            />
            <DevRow
              label="↩  라벨 기본값 복원"
              sub={`L${DEFAULT_FARMHUB_LABEL_POS.left} T${DEFAULT_FARMHUB_LABEL_POS.top}`}
              onClick={() => {
                resetLabelPos();
                haptic("warning");
                toast("라벨 좌표 기본값으로 복원");
              }}
            />
            <DevRow
              label="📋 region + label 현재값 복사"
              sub="값 확정 시 채팅에 복사된 값 붙여넣어 주세요"
              onClick={() => {
                haptic("light");
                const msg =
                  `region L:${hitRegion.left} T:${hitRegion.top} W:${hitRegion.width} H:${hitRegion.height}\n` +
                  `label  L:${labelPos.left} T:${labelPos.top}`;
                toast(`복사됨 (region + label)`);
                try {
                  void navigator?.clipboard?.writeText(msg);
                } catch {
                  /* clipboard unavailable */
                }
              }}
            />
            {/* R26.2 PR-157 — 라벨 위치 프리셋. 베타에서 두 후보 빠르게
                토글하며 비교. */}
            <DevRow
              label="🍄 라벨: 모자 아래 (R26.3)"
              sub="L15 T40 — 현재 default"
              onClick={() => {
                setLabelPos({ left: 15, top: 40 });
                haptic("light");
                toast("라벨 → 모자 아래 (L15 T40)");
              }}
            />
            <DevRow
              label="🍄 라벨: 문 옆 (R26.2 폐기)"
              sub="L22 T47 — 비교용"
              onClick={() => {
                setLabelPos({ left: 22, top: 47 });
                haptic("light");
                toast("라벨 → 문 옆 (L22 T47)");
              }}
            />
            <DevRow
              label="🍄 라벨: 모자 위 (R26.1 폐기)"
              sub="L4 T19 — 비교용"
              onClick={() => {
                setLabelPos({ left: 4, top: 19 });
                haptic("light");
                toast("라벨 → 모자 위 (L4 T19)");
              }}
            />
          </>
        )}
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
