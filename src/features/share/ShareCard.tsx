/**
 * Phase 6 — 1080×1920 세로 공유 카드.
 *
 * 핵심:
 *  - 본 컴포넌트는 항상 1080×1920 의 실제 DOM 으로 렌더된다 (html2canvas 캡처용).
 *  - 화면에는 보이지 않게 wrapper 가 visibility/포지션을 처리한다 (ReportPage 가).
 *  - 모든 텍스트/그래픽은 CSS 변수에 의존하지 않고 인라인 색을 박아둔다 —
 *    캡처 시 다크모드 토큰이나 외부 스타일 영향이 없도록.
 *  - Bunny 이미지는 props 로 받은 src/srcSet 을 사용 (이미 빌드된 webp URL).
 *  - 폰트는 Pretendard 가 이미 전역 로드되어 있어 캡처에 반영됨.
 */

import { forwardRef } from "react";
import { bunnyImages } from "../../assets/characters";
import appIcon180 from "../../assets/app-icon-180.png";

export interface ShareCardData {
  totalCarrotsWeek: number;
  totalMinutesWeek: number;
  streakDays: number;
  longestFocusMinutes: number;
  /** 7일 막대 데이터 — weekday + carrots. */
  week7: { weekday: string; carrots: number }[];
  /** 표시 날짜 (오른쪽 상단). */
  dateLabel: string;
  /** 닉네임 — 없으면 fallback. */
  nickname?: string;
}

interface ShareCardProps {
  data: ShareCardData;
}

const W = 1080;
const H = 1920;

/**
 * 화면에 보이는 prop-styled 컴포넌트. ref 로 캡처 노드를 노출.
 */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { data },
  ref,
) {
  const max = Math.max(...data.week7.map((d) => d.carrots), 4);
  const bunny = bunnyImages.success;

  return (
    <div
      ref={ref}
      data-testid="share-card-canvas"
      style={{
        width: W,
        height: H,
        // 그라데이션은 토큰이 아니라 고정값 — 캡처 안정성.
        background:
          "linear-gradient(165deg, #FF8455 0%, #FF6B35 32%, #C73E1D 70%, #5A1A0E 100%)",
        color: "#fff8e7",
        position: "relative",
        overflow: "hidden",
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        boxSizing: "border-box",
        padding: "120px 96px 96px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 배경 mesh 글로우 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 40% at 78% 8%, rgba(255, 220, 150, 0.30) 0%, transparent 70%), radial-gradient(50% 38% at 12% 92%, rgba(255, 150, 95, 0.22) 0%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      {/* 상단 — 로고 + 날짜 */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* 로고 — 당근 이모지 */}
          <span
            aria-hidden
            style={{
              fontSize: 64,
              lineHeight: 1,
              display: "block",
            }}
          >
            🥕
          </span>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              버니타임
            </p>
            <p
              style={{
                margin: 0,
                marginTop: 6,
                fontSize: 18,
                letterSpacing: "0.18em",
                opacity: 0.7,
                fontWeight: 600,
              }}
            >
              Bunny Time
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: 22,
            fontWeight: 600,
            opacity: 0.78,
            letterSpacing: "-0.01em",
          }}
        >
          {data.dateLabel}
        </span>
      </header>

      {/* 큰 헤드라인 */}
      <section style={{ position: "relative", marginTop: 90 }}>
        <p
          style={{
            margin: 0,
            fontSize: 28,
            letterSpacing: "0.18em",
            opacity: 0.78,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          이번주 약탈 보고서
        </p>
        <h1
          style={{
            margin: 0,
            marginTop: 14,
            fontSize: 168,
            lineHeight: 0.92,
            letterSpacing: "-0.06em",
            fontWeight: 900,
            // 숫자는 살짝 크고, "개" 는 작게 — 자식 inline-block 으로 처리
          }}
        >
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontFeatureSettings: "'tnum' 1",
              color: "#FFE4D6",
              textShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            {data.totalCarrotsWeek}
          </span>
          <span
            style={{
              fontSize: 56,
              marginLeft: 18,
              fontWeight: 700,
              opacity: 0.85,
              letterSpacing: "-0.02em",
            }}
          >
            개
          </span>
        </h1>
        <p
          style={{
            margin: 0,
            marginTop: 56,
            fontSize: 32,
            fontWeight: 600,
            opacity: 0.92,
            letterSpacing: "-0.02em",
          }}
        >
          악동 토끼가 다 먹어줬다 흐흐
        </p>
      </section>

      {/* 토끼 + 통계 박스 영역 */}
      <section
        style={{
          position: "relative",
          marginTop: 80,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 48,
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          <StatRow label="이번주 집중" value={`${data.totalMinutesWeek}분`} />
          <StatRow label="연속 출석" value={`${data.streakDays}일`} />
          <StatRow label="최장 집중" value={`${data.longestFocusMinutes}분`} />
        </div>
        <div
          style={{
            position: "relative",
            width: 360,
            height: 360,
            flexShrink: 0,
          }}
        >
          {/* 후광 */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -40,
              borderRadius: "50%",
              background:
                "radial-gradient(closest-side, rgba(255,228,214,0.55), transparent 70%)",
              filter: "blur(20px)",
            }}
          />
          <img
            src={bunny.src}
            srcSet={bunny.srcSet}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "relative",
              width: 360,
              height: 360,
              borderRadius: "50%",
              objectFit: "cover",
              border: "8px solid rgba(255,248,231,0.18)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.32)",
            }}
          />
        </div>
      </section>

      {/* 막대 차트 */}
      <section style={{ position: "relative", marginTop: 64 }}>
        <p
          style={{
            margin: 0,
            fontSize: 22,
            letterSpacing: "0.18em",
            opacity: 0.7,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          요일별 약탈
        </p>
        <div
          style={{
            marginTop: 26,
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 18,
            alignItems: "end",
            height: 240,
          }}
        >
          {data.week7.map((d, i) => {
            const ratio = Math.max(d.carrots / max, 0.06);
            const isToday = i === data.week7.length - 1;
            const barH = Math.round(200 * ratio);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: isToday ? "#FFE4D6" : "rgba(255,248,231,0.62)",
                  }}
                >
                  {d.carrots}
                </span>
                <div
                  style={{
                    width: "100%",
                    height: barH,
                    borderRadius: 14,
                    background: isToday
                      ? "linear-gradient(180deg, #FFE4D6 0%, #FFB890 100%)"
                      : "rgba(255,248,231,0.32)",
                    boxShadow: isToday
                      ? "0 8px 24px rgba(255,228,214,0.32)"
                      : "none",
                  }}
                />
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: isToday ? "#fff" : "rgba(255,248,231,0.62)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {d.weekday}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 푸터 — 검색 안내 + 카피 */}
      <footer
        style={{
          position: "relative",
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 64,
          borderTop: "2px dashed rgba(255,248,231,0.24)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* 워터마크 — 앱 아이콘 + 워드마크 */}
          <img
            src={appIcon180}
            alt=""
            crossOrigin="anonymous"
            width={72}
            height={72}
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              flexShrink: 0,
              boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
            }}
          />
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 22,
                opacity: 0.74,
                letterSpacing: "-0.01em",
                fontWeight: 600,
              }}
            >
              Bunny Time
            </p>
            <p
              style={{
                margin: 0,
                marginTop: 6,
                fontSize: 38,
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              버니타임
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              margin: 0,
              fontSize: 22,
              opacity: 0.72,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {data.nickname ?? "토끼 친구"}의
          </p>
          <p
            style={{
              margin: 0,
              marginTop: 4,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            주간 약탈 일지
          </p>
        </div>
      </footer>
    </div>
  );
});

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        padding: "20px 28px",
        borderRadius: 24,
        background: "rgba(26, 20, 16, 0.22)",
        border: "1px solid rgba(255,248,231,0.18)",
        backdropFilter: "blur(2px)",
      }}
    >
      <span
        style={{
          fontSize: 24,
          fontWeight: 600,
          opacity: 0.78,
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: "'tnum' 1",
          color: "#FFE4D6",
        }}
      >
        {value}
      </span>
    </div>
  );
}

