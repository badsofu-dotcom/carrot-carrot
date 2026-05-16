/**
 * AchievementsCard — 도전 과제 (메달) 그리드.
 *
 * PR-26: 훈장 섹션을 RewardsPanel 에서 도감 페이지로 이동. 선물박스는
 * 광고/포인트 허브로 재정의되어 보상 채널만 남기고, 도감은 컬렉션
 * 진행 + 도전 과제를 한 곳에 묶음.
 *
 * 데이터:
 *   - 11 medal IDs (rewardsStore.MEDAL_LABELS 의 모든 키)
 *   - 등급 매핑: gold (가장 어려운 도전), silver (중급), bronze (입문)
 *   - 자산: public/assets/farm/rewards/medal_{gold,silver,bronze}.png
 */
import {
  MEDAL_LABELS,
  useRewardsStore,
  type MedalId,
} from "./rewardsStore";

const BASE: string =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

const ALL_ACHIEVEMENT_MEDALS: readonly MedalId[] = [
  "first_session",
  "first_harvest",
  "five_carrots",
  "perfect_combo",
  "first_candy",
  "first_golden",
  "dogam_25",
  "dogam_50",
  "dogam_75",
  "dogam_100",
  "quiet_sky",
];

/** Mirrored from the old RewardsPanel medalAsset map (PR-22). */
export function medalAsset(id: MedalId): string {
  switch (id) {
    case "perfect_combo":
    case "first_golden":
    case "dogam_100":
      return "medal_gold";
    case "five_carrots":
    case "first_candy":
    case "dogam_50":
    case "dogam_75":
    case "quiet_sky":
      return "medal_silver";
    case "first_harvest":
    case "first_session":
    case "dogam_25":
    default:
      return "medal_bronze";
  }
}

export function AchievementsCard() {
  const medals = useRewardsStore((s) => s.medals);
  const unlockedCount = medals.size;
  const total = ALL_ACHIEVEMENT_MEDALS.length;

  return (
    <section
      data-testid="achievements-card"
      style={{
        marginBottom: 18,
        background: "var(--bg-elevated, #fff)",
        borderRadius: 20,
        padding: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>
          도전 과제
        </h3>
        <span
          data-testid="achievements-progress"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-tertiary, #888)",
          }}
        >
          {unlockedCount} / {total} 달성
        </span>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(86px, 1fr))",
          gap: 8,
        }}
      >
        {ALL_ACHIEVEMENT_MEDALS.map((id) => {
          const unlocked = medals.has(id);
          return (
            <div
              key={id}
              data-testid={`medal-${id}`}
              style={{
                background: "var(--surface-1, #fff8ee)",
                borderRadius: 12,
                padding: "10px 6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                border: "1px solid var(--border-subtle, rgba(0,0,0,0.05))",
                opacity: unlocked ? 1 : 0.45,
              }}
            >
              <img
                src={`${BASE}assets/farm/rewards/${medalAsset(id)}.png`}
                alt=""
                width={32}
                height={32}
                style={{
                  objectFit: "contain",
                  filter: unlocked ? "none" : "grayscale(0.85)",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textAlign: "center",
                  color: unlocked
                    ? "var(--text-primary, #2b2b2b)"
                    : "var(--text-tertiary, #888)",
                  lineHeight: 1.15,
                }}
              >
                {MEDAL_LABELS[id]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
