/**
 * DailyMissionsCard (PR-52) — 홈 탭의 "오늘의 목표" 카드.
 *
 * 3 daily missions + per-mission claim 버튼 + all-complete bonus.
 * P 그랜트 = `farmStore.incCarrots(rewardP)` (1 carrot = 1 P 환산).
 */
import { useMissionsStore } from "./missionsStore";
import { useFarmStore } from "../collection/farmStore";
import { toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";

export function DailyMissionsCard() {
  const missions = useMissionsStore((s) => s.missions);
  const progress = useMissionsStore((s) => s.progress);
  const claimed = useMissionsStore((s) => s.claimed);
  const bonusClaimed = useMissionsStore((s) => s.bonusClaimed);
  const claim = useMissionsStore((s) => s.claim);
  const claimAllBonus = useMissionsStore((s) => s.claimAllBonus);
  const incCarrots = useFarmStore((s) => s.incCarrots);

  const allDone = missions.every((m) => claimed.has(m.type));

  const onClaim = (type: typeof missions[number]["type"]) => {
    const reward = claim(type);
    if (reward > 0) {
      incCarrots(reward);
      haptic("success");
      toast(`🎯 미션 완료 — 당근 +${reward} (+${reward} P)`);
    }
  };

  const onBonus = () => {
    const bonus = claimAllBonus();
    if (bonus > 0) {
      incCarrots(bonus);
      haptic("success");
      toast(`🏆 모든 미션 클리어 — 보너스 +${bonus} P`);
    }
  };

  return (
    <section
      data-testid="daily-missions-card"
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
          오늘의 목표
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
              data-testid={`mission-${m.type}`}
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
                      // PR-83 — mission item bg 가 fixed light (#fff8ee)
                      // 이므로 var(--text-tertiary) 사용 시 dark mode
                      // 에서 contrast 2.27:1 발생. fixed dark grey 로
                      // AA 5.8:1 보장.
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
                    data-testid={`mission-bar-${m.type}`}
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
                data-testid={`mission-claim-${m.type}`}
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
          data-testid="mission-bonus-claim"
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
          🏆 모두 클리어 — 보너스 +5 P 받기
        </button>
      )}
    </section>
  );
}
