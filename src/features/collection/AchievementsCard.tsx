/**
 * AchievementsCard — 도전 과제 (메달) 그리드.
 *
 * PR-26: 훈장 섹션을 RewardsPanel 에서 도감 페이지로 이동.
 * PR-49: medalsConfig 기반 동적 렌더링. 11종 메달 + tier-별 정렬 +
 *   lock state overlay + per-cell tap → 상세 패널.
 *
 * 자산 fallback (PR-49):
 *   - 사용자가 추가하는 PNG (medal-first-breath.png 등) 우선
 *   - 미존재 시 onError 로 tier 별 default (medal_bronze/silver/gold)
 *     로 자동 폴백 — UI 가 망가지지 않음.
 */
import { useState } from "react";
import { useRewardsStore } from "./rewardsStore";
import type { MedalId } from "./rewardsStore";
import {
  SORTED_MEDALS,
  tierFallbackAsset,
  type MedalDef,
  type MedalTier,
} from "./medalsConfig";

const BASE: string =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

const TIER_COLOR: Record<MedalTier, string> = {
  bronze: "#C5854B",
  silver: "#9CA3AF",
  gold: "#E5A53A",
};

export function AchievementsCard() {
  const medals = useRewardsStore((s) => s.medals);
  const [selected, setSelected] = useState<MedalId | null>(null);
  const unlockedCount = medals.size;
  const total = SORTED_MEDALS.length;

  const selectedDef = selected
    ? SORTED_MEDALS.find((m) => m.id === selected) ?? null
    : null;
  const selectedUnlocked = selected ? medals.has(selected) : false;

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
        {SORTED_MEDALS.map((m) => {
          const unlocked = medals.has(m.id);
          const isSelected = selected === m.id;
          return (
            <button
              key={m.id}
              type="button"
              data-testid={`medal-${m.id}`}
              aria-pressed={isSelected}
              aria-label={
                unlocked
                  ? `${m.displayName} 달성`
                  : `${m.displayName} — ${m.unlockHint}`
              }
              onClick={() =>
                setSelected((cur) => (cur === m.id ? null : m.id))
              }
              style={{
                position: "relative",
                background: "var(--surface-1, #fff8ee)",
                borderRadius: 12,
                padding: "10px 6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                border: isSelected
                  ? `2px solid ${TIER_COLOR[m.tier]}`
                  : "1px solid var(--border-subtle, rgba(0,0,0,0.05))",
                opacity: unlocked ? 1 : 0.45,
                cursor: "pointer",
                overflow: "hidden",
                boxSizing: "border-box",
                transition: "border-color 0.15s, box-shadow 0.15s",
                boxShadow: isSelected
                  ? `0 3px 10px ${TIER_COLOR[m.tier]}44`
                  : "none",
              }}
            >
              <MedalIcon def={m} unlocked={unlocked} />
              {!unlocked && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 6,
                    fontSize: 10,
                    opacity: 0.65,
                  }}
                >
                  🔒
                </span>
              )}
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
                {m.displayName}
              </span>
            </button>
          );
        })}
      </div>

      {selectedDef && (
        <div
          data-testid="medal-detail"
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "var(--surface-1, #fff8ee)",
            border: `1px solid ${TIER_COLOR[selectedDef.tier]}33`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 13, color: TIER_COLOR[selectedDef.tier] }}>
              {selectedDef.tier === "bronze"
                ? "🥉 브론즈"
                : selectedDef.tier === "silver"
                  ? "🥈 실버"
                  : "🥇 골드"}
              {" · "}
              {selectedDef.displayName}
            </strong>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: selectedUnlocked ? "#22a06b" : "var(--text-tertiary, #888)",
              }}
            >
              {selectedUnlocked ? "달성 완료" : "미달성"}
            </span>
          </div>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--text-secondary, #555)",
              lineHeight: 1.4,
            }}
          >
            {selectedDef.description}
          </p>
          {!selectedUnlocked && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 11,
                color: "var(--text-tertiary, #888)",
                lineHeight: 1.35,
              }}
            >
              획득 방법: {selectedDef.unlockHint}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * 메달 아이콘 — 사용자 자산 PR-49 우선, 실패 시 tier 별 default 폴백.
 */
function MedalIcon({
  def,
  unlocked,
}: {
  def: MedalDef;
  unlocked: boolean;
}) {
  const [src, setSrc] = useState(`${BASE}${def.iconRel}`);
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => {
        const fb = `${BASE}${tierFallbackAsset(def.tier)}`;
        if (src !== fb) setSrc(fb);
      }}
      style={{
        width: 32,
        height: 32,
        maxWidth: 32,
        maxHeight: 32,
        objectFit: "contain",
        filter: unlocked ? "none" : "grayscale(0.85)",
        flexShrink: 0,
      }}
    />
  );
}
