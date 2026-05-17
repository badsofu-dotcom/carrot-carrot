/**
 * Phase 6 — Report.
 *
 * - week7 막대: collectionStore 기반.
 * - 30일 누적 line chart: useCumulativeFocus30d 셀렉터.
 * - 주간 카드 미리보기: ShareCard 컴포넌트를 직접 축소해서 즉시 표시.
 *   탭하면 큰 모달로 카드를 보여준다 (저장/공유 없음).
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BottomSheet } from "../design-system/ui";
import { haptic } from "../design-system/haptic";
import {
  useCollectionStore,
  useCumulativeFocus30d,
  useStreakDays,
  useTodayCarrots,
  useWeek7History,
} from "../features/collection/collectionStore";
import { ShareCard, type ShareCardData } from "../features/share/ShareCard";
import { useUserStore } from "../store/userStore";

export function ReportPage() {
  const week7 = useWeek7History();
  const streakDays = useStreakDays();
  const longestFocusMinutes = useCollectionStore((s) => s.longestFocusMinutes);
  const totalCarrots = useCollectionStore((s) => s.totalCarrots);
  const todayCarrots = useTodayCarrots();
  const cumulative30 = useCumulativeFocus30d();
  const user = useUserStore((s) => s.user);

  const totalCarrotsWeek = week7.reduce((s, d) => s + d.carrots, 0);
  const totalMinutesWeek = week7.reduce((s, d) => s + d.focusMinutes, 0);
  const weekMax = Math.max(...week7.map((d) => d.carrots), 4);
  const trendLabel = totalCarrotsWeek > 0 ? `+${totalCarrotsWeek}` : `${totalCarrots}`;

  const reduce = useReducedMotion();

  const cardData = useMemo<ShareCardData>(() => {
    const today = new Date();
    const dateLabel = `${today.getMonth() + 1}.${today.getDate()}`;
    return {
      totalCarrotsWeek,
      totalMinutesWeek,
      streakDays,
      longestFocusMinutes,
      week7: week7.map((d) => ({ weekday: d.weekday, carrots: d.carrots })),
      dateLabel,
      nickname: user?.nickname,
    };
  }, [
    totalCarrotsWeek,
    totalMinutesWeek,
    streakDays,
    longestFocusMinutes,
    week7,
    user?.nickname,
  ]);

  const [popupOpen, setPopupOpen] = useState(false);

  const onPreviewTap = () => {
    haptic("light");
    setPopupOpen(true);
  };

  return (
    <main className="app-screen" data-testid="page-report" style={{ paddingTop: 24 }}>
      {/* 상단 — 헤더 */}
      <header
        style={{
          marginBottom: 24,
          position: "relative",
          padding: "8px 4px 12px",
        }}
      >
        <p className="t-micro" style={{ marginBottom: 6 }}>
          이번주 약탈 현황
        </p>
        <h1
          className="t-display"
          style={{
            margin: 0,
            letterSpacing: "-0.04em",
          }}
        >
          리포트
        </h1>
      </header>

      {/* KPI — 비대칭 스택 */}
      <section
        aria-label="이번주 KPI"
        style={{
          display: "grid",
          gridTemplateColumns: "1.45fr 1fr",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            position: "relative",
            background: "var(--gradient-mesh)",
            borderRadius: 26,
            padding: "20px 18px 18px",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
            minHeight: 168,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
          data-testid="kpi-carrots"
        >
          <div>
            <p
              className="t-micro"
              style={{
                margin: 0,
                marginBottom: 6,
                color: "var(--text-secondary)",
              }}
            >
              이번주 당근
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
              <span
                className="t-display-num"
                style={{
                  fontSize: 64,
                  color: "var(--accent-carrot)",
                }}
              >
                {totalCarrotsWeek}
              </span>
              <span
                className="t-h2"
                style={{
                  marginBottom: 8,
                  color: "var(--text-secondary)",
                }}
              >
                개
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 10px",
                borderRadius: 999,
                background: "color-mix(in oklab, var(--accent-carrot) 14%, transparent)",
                color: "var(--accent-carrot)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
              className="tabular-nums"
            >
              ↑ {trendLabel}
            </span>
            <span className="t-caption" style={{ color: "var(--text-secondary)" }}>
              오늘 {todayCarrots}개
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              flex: 1,
              background: "var(--bg-sunken)",
              borderRadius: 18,
              padding: "12px 14px",
              border: "1px dashed var(--border-medium)",
              position: "relative",
            }}
            data-testid="kpi-streak"
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                className="t-display-num"
                style={{
                  fontSize: 30,
                  color: "var(--accent-devil)",
                }}
              >
                {streakDays}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                일 연속
              </span>
            </div>
            <p
              className="t-caption"
              style={{ margin: 0, marginTop: 2, color: "var(--text-tertiary)", fontSize: 11 }}
            >
              🔥 안 끊겼어
            </p>
          </div>
          <div
            style={{
              flex: 1,
              background: "var(--bg-elevated)",
              borderRadius: 18,
              padding: "12px 14px",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-sm)",
              position: "relative",
            }}
            data-testid="kpi-longest"
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                className="t-display-num"
                style={{
                  fontSize: 30,
                  color: "var(--accent-gold)",
                }}
              >
                {longestFocusMinutes}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                분 최장
              </span>
            </div>
            <p
              className="t-caption"
              style={{ margin: 0, marginTop: 2, color: "var(--text-tertiary)", fontSize: 11 }}
            >
              한 판 끝까지
            </p>
          </div>
        </div>
      </section>

      {/* Week bar chart */}
      <section
        style={{
          marginInline: -20,
          paddingInline: 20,
          paddingBlock: 20,
          background: "var(--bg-elevated)",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: 24,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
          }}
        >
          <div>
            <p className="t-micro" style={{ margin: 0, marginBottom: 2 }}>
              이번주 집중 막대
            </p>
            <h2 className="t-h2" style={{ margin: 0 }}>
              <span className="tabular-nums">{totalMinutesWeek}</span>분 집중
            </h2>
          </div>
          <span className="t-caption" style={{ color: "var(--text-tertiary)" }}>
            7일
          </span>
        </header>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 8,
            alignItems: "end",
            height: 130,
          }}
          aria-label="요일별 당근 막대 차트"
        >
          {week7.map((d, i) => {
            const ratio = Math.max(d.carrots / weekMax, 0.06);
            const isToday = i === week7.length - 1;
            return (
              <div
                key={d.date}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                    position: "relative",
                  }}
                >
                  <motion.div
                    initial={reduce ? { scaleY: ratio } : { scaleY: 0 }}
                    animate={{ scaleY: ratio }}
                    transition={{
                      delay: reduce ? 0 : 0.04 * i,
                      duration: reduce ? 0 : 0.6,
                      ease: [0.32, 0.72, 0, 1],
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 10,
                      background: isToday
                        ? "var(--accent-carrot)"
                        : "var(--accent-carrot-soft)",
                      transformOrigin: "bottom",
                    }}
                  />
                  {/* PR-108 — 0 수확 day 는 숫자 label 미표시.
                      시각 노이즈 감소 + 의미 있는 값만 강조. 합계는
                      header 의 totalMinutesWeek 가 유지. */}
                  {d.carrots > 0 && (
                    <span
                      className="tabular-nums"
                      style={{
                        position: "absolute",
                        top: -2,
                        left: "50%",
                        transform: "translate(-50%, -100%)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: isToday ? "var(--accent-carrot)" : "var(--text-tertiary)",
                      }}
                    >
                      {d.carrots}
                    </span>
                  )}
                </div>
                <span
                  className="t-micro"
                  style={{
                    color: isToday ? "var(--accent-carrot)" : "var(--text-tertiary)",
                  }}
                >
                  {d.weekday}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cumulative line — collectionStore 기반 */}
      <section style={{ marginBottom: 28 }}>
        <header style={{ marginBottom: 12 }}>
          <p className="t-micro" style={{ margin: 0, marginBottom: 2 }}>
            지난 30일 누적 집중
          </p>
          <h2 className="t-h2" style={{ margin: 0 }}>
            꾸준히 늘고 있어 흐흐
          </h2>
        </header>
        <CumulativeLineChart
          data={cumulative30}
          reduceMotion={!!reduce}
        />
      </section>

      {/* Share preview — 즉시 보이는 카드. 탭하면 큰 팝업. */}
      <section
        style={{
          marginBottom: 16,
          padding: "20px 4px 8px",
        }}
      >
        <p className="t-micro" style={{ margin: 0, marginBottom: 12, paddingLeft: 4 }}>
          주간 카드 미리보기
        </p>
        <SharePreview
          cardData={cardData}
          onTap={onPreviewTap}
          reduceMotion={!!reduce}
        />
        <p
          className="t-caption"
          style={{
            textAlign: "center",
            color: "var(--text-tertiary)",
            marginTop: 10,
            marginBottom: 0,
            fontSize: 11,
          }}
        >
          톡 건드리면 크게 볼 수 있어
        </p>
      </section>

      <BottomSheet open={popupOpen} onClose={() => setPopupOpen(false)}>
        <div
          data-testid="share-card-popup"
          style={{
            width: "100%",
            aspectRatio: "1080 / 1920",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: "var(--shadow-lg)",
            margin: "0 auto",
          }}
        >
          <ShareCardScaled data={cardData} />
        </div>
      </BottomSheet>
    </main>
  );
}

/* ----------------------- Sub-components ----------------------- */

interface SharePreviewProps {
  cardData: ShareCardData;
  onTap: () => void;
  reduceMotion: boolean;
}

/**
 * 미리보기 — 실제 ShareCard 를 ResizeObserver 기반 transform scale 로 축소.
 * - container query 단위(100cqw)는 WebView 환경에 따라 호환성 이슈가 있어
 *   ResizeObserver 로 측정한 px 값을 그대로 사용한다.
 * - 카드 자체는 회전 없이 평평하게 — 가독성 유지.
 */
function SharePreview({
  cardData,
  onTap,
  reduceMotion,
}: SharePreviewProps) {
  return (
    <motion.button
      type="button"
      tabIndex={0}
      aria-label="주간 카드 미리보기 — 탭하면 크게 보기"
      data-testid="share-card-preview"
      onClick={onTap}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      whileFocus={reduceMotion ? undefined : { scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      style={{
        position: "relative",
        display: "block",
        margin: "0 auto",
        width: "78%",
        aspectRatio: "1080 / 1920",
        maxHeight: 420,
        borderRadius: 22,
        overflow: "hidden",
        padding: 0,
        border: "none",
        cursor: "pointer",
        boxShadow: "var(--shadow-lg)",
        textAlign: "left",
        background: "#5A1A0E",
      }}
    >
      <ShareCardScaled data={cardData} />
    </motion.button>
  );
}

/**
 * ShareCard 를 1080×1920 원본에서 컨테이너 폭에 맞게 균일 축소.
 * - 컨테이너는 aspectRatio: 1080/1920 을 갖는다고 가정.
 * - ResizeObserver 로 외부 폭을 측정해 scale = width / 1080 을 적용한다.
 * - 100cqw / containerType: inline-size 는 일부 WebView 에서 잘못 잘리므로 사용하지 않는다.
 */
function ShareCardScaled({ data }: { data: ShareCardData }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(0);

  useLayoutEffect(() => {
    const node = outerRef.current;
    if (!node) return;
    const measure = () => {
      const w = node.clientWidth;
      if (w > 0) setScale(w / 1080);
    };
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(node);
    }
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={outerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1080,
          height: 1920,
          transformOrigin: "top left",
          transform: scale > 0 ? `scale(${scale})` : "scale(0)",
          // While we haven't measured yet, keep the card off-screen
          // so we never flash an un-scaled 1080×1920 box.
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        <ShareCard data={data} />
      </div>
    </div>
  );
}

/* ----------------------- Cumulative Line Chart ----------------------- */

interface CumulativeLineChartProps {
  data: { date: string; daily: number; cumulative: number }[];
  reduceMotion: boolean;
}

function CumulativeLineChart({ data, reduceMotion }: CumulativeLineChartProps) {
  const w = 320;
  const h = 130;
  const padX = 8;
  const padY = 12;
  const minH = 6;

  const cumulative = data.map((d) => d.cumulative);
  const max = Math.max(...cumulative, 1);
  const min = 0;
  const range = Math.max(max - min, 1);
  const step = (w - padX * 2) / Math.max(data.length - 1, 1);

  const points = cumulative.map((v, i) => {
    const x = padX + i * step;
    const y = padY + (1 - (v - min) / range) * (h - padY * 2 - minH);
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : `L${x.toFixed(1)} ${y.toFixed(1)}`))
    .join(" ");
  const area =
    `M${points[0][0].toFixed(1)} ${h - padY} ` +
    points.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") +
    ` L${points[points.length - 1][0].toFixed(1)} ${h - padY} Z`;

  const dailyMax = Math.max(...data.map((d) => d.daily), 1);
  const last = points[points.length - 1];

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        role="img"
        aria-label={`지난 30일 누적 집중 시간 — 총 ${cumulative[cumulative.length - 1]}분`}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="line-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-carrot)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent-carrot)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {data.map((d, i) => {
          const x = padX + i * step - step * 0.32;
          const bw = step * 0.64;
          const dh = (d.daily / dailyMax) * 22;
          return (
            <motion.rect
              key={i}
              x={x}
              y={h - padY - dh}
              width={Math.max(bw, 1.5)}
              height={Math.max(dh, 1)}
              rx={1.2}
              fill="var(--accent-carrot-soft)"
              initial={reduceMotion ? { opacity: 0.7 } : { opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: reduceMotion ? 0 : 0.18 + i * 0.012, duration: 0.3 }}
            />
          );
        })}

        <motion.path
          d={area}
          fill="url(#line-fade)"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.25, duration: 0.5 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke="var(--accent-carrot)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.32, 0.72, 0, 1] }}
        />

        <motion.circle
          cx={last[0]}
          cy={last[1]}
          r={4}
          fill="var(--accent-carrot)"
          initial={reduceMotion ? { scale: 1 } : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: reduceMotion ? 0 : 1.0, type: "spring", stiffness: 380, damping: 18 }}
        />
        <motion.circle
          cx={last[0]}
          cy={last[1]}
          r={9}
          fill="var(--accent-carrot)"
          fillOpacity={0.18}
          initial={reduceMotion ? { scale: 1 } : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: reduceMotion ? 0 : 1.05, type: "spring", stiffness: 240, damping: 18 }}
        />
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 11,
          color: "var(--text-tertiary)",
          fontWeight: 600,
        }}
      >
        <span>30일 전</span>
        <span className="tabular-nums" style={{ color: "var(--accent-carrot)" }}>
          {cumulative[cumulative.length - 1]}분 누적
        </span>
        <span>오늘</span>
      </div>
    </div>
  );
}
