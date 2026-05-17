/**
 * WeeklyMissionsCard (PR-76) — 홈 탭의 "이번 주 목표" 카드.
 *
 * DailyMissionsCard 와 동일 패턴. 차이:
 *   - 매주 월요일 04:00 KST 리셋
 *   - weeklyAttendDays5 claim 시 rewardsStore.addTreasureProgress(7) 로
 *     주간 보물상자 보장 (user spec)
 */
import { useWeeklyMissionsStore } from "./weeklyMissionsStore";
import { useFarmStore } from "../collection/farmStore";
import { useRewardsStore } from "../collection/rewardsStore";
import { toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";
import { WEEKLY_ALL_COMPLETE_BONUS_P } from "./weeklyMissions";

export function WeeklyMissionsCard() {
  const missions = useWeeklyMissionsStore((s) => s.missions);
  const progress = useWeeklyMissionsStore((s) => s.progress);
  const claimed = useWeeklyMissionsStore((s) => s.claimed);
  const bonusClaimed = useWeeklyMissionsStore((s) => s.bonusClaimed);
  const claim = useWeeklyMissionsStore((s) => s.claim);
  const claimAllBonus = useWeeklyMissionsStore((s) => s.claimAllBonus);
  const incCarrots = useFarmStore((s) => s.incCarrots);
  const addTreasureProgress = useRewardsStore((s) => s.addTreasureProgress);

  const allDone = missions.every((m) => claimed.has(m.type));

  const onClaim = (type: (typeof missions)[number]["type"]) => {
    const reward = claim(type);
    if (reward > 0) {
      incCarrots(reward);
      haptic("success");
      // attendance claim 시 weekly treasure 도 보장 — user spec.
      if (type === "weeklyAttendDays5") {
        addTreasureProgress(7);
        toast(
          `🎯 주간 미션 완료 — 당근 +${reward} (+${reward} P) · 주간 보물상자 보장`,
        );
      } else {
        toast(`🎯 주간 미션 완료 — 당근 +${reward} (+${reward} P)`);
      }
    }
  };

  const onBonus = () => {
    const bonus = claimAllBonus();
    if (bonus > 0) {
      incCarrots(bonus);
      haptic("success");
      toast(`🏆 주간 모든 미션 클리어 — 보너스 +${bonus} P`);
    }
  };

  return (
    <section
      data-testid="weekly-missions-card"
      style={{
        marginTop: 14,
        marginBottom: 14,
        padding: 14,
        background: "var(--bg-elevated, #fff)",
        borderRadius: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>
          이번 주 목표
        </h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-tertiary, #888)",
          }}
        >
          {claimed.size} / {missions.length}
        </span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {missions.map((m) => {
          const prog = progress[m.type] ?? 0;
          const pct = Math.min(100, (prog / m.threshold) * 100);
          const isDone = prog >= m.threshold;
          const isClaimed = claimed.has(m.type);
          return (
            <div
              key={m.type}
              data-testid={`weekly-mission-${m.type}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: isClaimed
                  ? "rgba(0,0,0,0.04)"
                  : "var(--surface-1, #fff8ee)",
                borderRadius: 12,
                border: "1px solid var(--border-subtle, rgba(0,0,0,0.05))",
                opacity: isClaimed ? 0.7 : 1,
              }}
            >
              <span aria-hidden style={{ fontSize: 20, flexShrink: 0 }}>
                {m.emoji}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: "#2b2b2b" }}
                  >
                    {m.title}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      // PR-83 — fixed bg → fixed dark text for AA.
                      color: isDone ? "#22a06b" : "#6a6055",
                      flexShrink: 0,
                    }}
                  >
                    {prog}/{m.threshold} · +{m.rewardP}P
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 4,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    data-testid={`weekly-bar-${m.type}`}
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: isDone ? "#22a06b" : "#FF7B61",
                      transition: "width 0.25s ease",
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onClaim(m.type)}
                disabled={!isDone || isClaimed}
                data-testid={`weekly-claim-${m.type}`}
                style={{
                  flexShrink: 0,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "none",
                  background: isClaimed
                    ? "rgba(0,0,0,0.08)"
                    : isDone
                      ? "#FF7B61"
                      : "rgba(0,0,0,0.08)",
                  color: isClaimed ? "#888" : isDone ? "#fff" : "#888",
                  fontWeight: 800,
                  fontSize: 11,
                  cursor: isDone && !isClaimed ? "pointer" : "not-allowed",
                }}
              >
                {isClaimed ? "완료" : "수령"}
              </button>
            </div>
          );
        })}
      </div>

      {allDone && !bonusClaimed && (
        <button
          type="button"
          onClick={onBonus}
          data-testid="weekly-bonus-claim"
          style={{
            marginTop: 10,
            width: "100%",
            padding: "10px 0",
            borderRadius: 12,
            border: "none",
            background: "#22a06b",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          🏆 이번 주 모두 클리어 — 보너스 +{WEEKLY_ALL_COMPLETE_BONUS_P} P 받기
        </button>
      )}
    </section>
  );
}
