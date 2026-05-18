import { useLocation } from "wouter";
import { useState, useRef } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { haptic } from "../design-system/haptic";
import { useTimerStore } from "../store/timerStore";

interface TabDef {
  to: string;
  label: string;
  testId: string;
  icon: (active: boolean) => React.ReactNode;
}

// PR-140 (Round 21 베타7): 22 → 20. tabbar-height 68 → 56 와 비례.
const ICON_SIZE = 20;

const stroke = (active: boolean) =>
  ({
    fill: "none",
    stroke: active ? "var(--accent-carrot)" : "var(--text-tertiary)",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    transition: "stroke 0.2s var(--ease-smooth)",
  }) as const;

const tabs: TabDef[] = [
  {
    to: "/",
    label: "홈",
    testId: "tab-home",
    icon: (a) => (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden>
        <path d="M3.5 11.5L12 4l8.5 7.5" {...stroke(a)} />
        <path d="M5.5 10v9h13v-9" {...stroke(a)} />
        <path d="M10 19v-5h4v5" {...stroke(a)} />
      </svg>
    ),
  },
  {
    to: "/collection",
    label: "농장",
    testId: "tab-collection",
    // Sprout glyph (lucide-style): central vertical stem rising from
    // soil, two leaf curves to left and right. Clearly distinct from
    // the house silhouette next to it. Matches the surrounding nav
    // stroke (currentColor at 1.8 px via the `stroke()` helper).
    icon: (a) => (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden>
        {/* Center stem */}
        <path d="M12 20V8" {...stroke(a)} />
        {/* Right leaf — a quick comma shape attached at mid-stem */}
        <path
          d="M12 12 C 14 12, 17 11, 19 8 C 17 8, 14 9, 12 12 Z"
          {...stroke(a)}
        />
        {/* Left leaf — mirror of the right, attached higher */}
        <path
          d="M12 10 C 10 10, 7 9, 5 6 C 7 6, 10 7, 12 10 Z"
          {...stroke(a)}
        />
        {/* Soil line beneath the stem */}
        <path d="M7 20h10" {...stroke(a)} />
      </svg>
    ),
  },
  {
    to: "/report",
    label: "리포트",
    testId: "tab-report",
    icon: (a) => (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden>
        <path d="M4 19h16" {...stroke(a)} />
        <path d="M7 16v-5" {...stroke(a)} />
        <path d="M12 16V7" {...stroke(a)} />
        <path d="M17 16v-7" {...stroke(a)} />
      </svg>
    ),
  },
  {
    to: "/me",
    label: "내 정보",
    testId: "tab-me",
    icon: (a) => (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="8.5" r="3.5" {...stroke(a)} />
        <path d="M4.5 19.5c1.6-3.4 4.4-5 7.5-5s5.9 1.6 7.5 5" {...stroke(a)} />
      </svg>
    ),
  },
];

export function TabBar() {
  const [location, navigate] = useLocation();
  const [bouncing, setBouncing] = useState<string | null>(null);
  const bounceTimer = useRef<number | null>(null);
  // Phase 8.0-c — timer 가 진행중이고 Home 이 아니면 home tab 에 작은 carrot dot.
  const timerStatus = useTimerStore((s) => s.status);
  const timerActive = timerStatus === "FOCUSING" || timerStatus === "PAUSED";
  const showHomeDot = timerActive && location !== "/";
  const triggerBounce = (to: string) => {
    setBouncing(to);
    if (bounceTimer.current) window.clearTimeout(bounceTimer.current);
    bounceTimer.current = window.setTimeout(() => setBouncing(null), 180);
  };

  return (
    <nav
      aria-label="주요 메뉴"
      style={{
        // R30.5 PR-175 — 캡슐 복원. R28 PHASE 3 의 full-width frosted
        // 바를 폐기하고, PR-170 이전의 floating capsule (radius-pill +
        // 좌우 16px margin + shadow) 로 회귀. iOS 홈 인디케이터 영역
        // (env(safe-area-inset-bottom)) 위에 정확히 얹혀 더 이상 내려갈
        // 수 없을 만큼 바닥에 근접 — --tabbar-offset (0px) 가 capsule
        // 과 safe-area top 사이 추가 gap. 0 이라 가장 낮은 위치.
        position: "fixed",
        bottom: "calc(var(--tabbar-offset) + env(safe-area-inset-bottom, 0px))",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 100,
      }}
    >
      <div
        style={{
          // 좌우 16px gap (32px = 16 + 16). pointerEvents auto 로 capsule
          // 안에서만 탭 이벤트 받음. 바깥 nav 는 pointerEvents none 이라
          // 빈 좌우 영역 클릭은 page 로 패스스루.
          width: "calc(100% - 32px)",
          maxWidth: "calc(var(--app-max-width) - 32px)",
          pointerEvents: "auto",
        }}
      >
      <LayoutGroup id="tabbar">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
            gap: 4,
            padding: 6,
            borderRadius: "var(--radius-pill)",
            background: "color-mix(in oklab, var(--bg-elevated) 78%, transparent)",
            backdropFilter: "var(--backdrop-blur)",
            WebkitBackdropFilter: "var(--backdrop-blur)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-lg)",
            height: "var(--tabbar-height)",
          }}
        >
          {tabs.map((t) => {
            const active = location === t.to;
            return (
              <button
                key={t.to}
                type="button"
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                data-testid={t.testId}
                onClick={() => {
                  haptic("light");
                  triggerBounce(t.to);
                  if (location !== t.to) navigate(t.to);
                }}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  borderRadius: "var(--radius-pill)",
                  // PR-140 — padding 6px 4px → 4px 4px, label 11 → 10.
                  padding: "4px 4px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: active ? "var(--accent-carrot)" : "var(--text-tertiary)",
                  cursor: "pointer",
                  transition: "color 0.2s var(--ease-smooth)",
                }}
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "var(--accent-carrot-soft)",
                      borderRadius: "var(--radius-pill)",
                      zIndex: 0,
                    }}
                    aria-hidden
                  />
                )}
                <span
                  style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center" }}
                  className={bouncing === t.to ? "tab-bounce" : undefined}
                >
                  {t.icon(active)}
                  {/* Phase 8.0-c — home tab dot when timer running off-home */}
                  {t.to === "/" && showHomeDot && (
                    <motion.span
                      aria-hidden
                      data-testid="home-tab-active-dot"
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -4,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--accent-carrot)",
                        boxShadow: "0 0 0 2px var(--bg-elevated)",
                      }}
                    />
                  )}
                </span>
                <span style={{ position: "relative", zIndex: 1 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
      </div>
    </nav>
  );
}
