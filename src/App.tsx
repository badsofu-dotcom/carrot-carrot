import { lazy, Suspense, useEffect, useState } from "react";
import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { safeStorage } from "./lib/safeStorage";

import { TabBar } from "./components/TabBar";
import { ThemeProvider } from "./design-system/ThemeProvider";
import { useFarmhubDogamGrant } from "./features/decor/useFarmhubDogamGrant";
import { ToastViewport } from "./design-system/ui";
import { SplashScreen } from "./components/SplashScreen";
import { AppsInTossLoginGate } from "./components/AppsInTossLoginGate";
import { initAuth, fetchMe } from "./services/authService";
import { useUserStore } from "./store/userStore";
import { bunnyImages } from "./assets/characters";
import { useTimerEngine } from "./features/timer/useTimerEngine";
import { useSoundPlayer } from "./hooks/useSoundPlayer";
import { InAppBanner } from "./features/notifications/InAppBanner";
import { FeedbackSheet } from "./features/feedback/FeedbackSheet";

// Phase 7.9.2 — module top-level 에서 LCP 후보 bunny 두 장을 즉시 fetch+decode.
// React 가 mount 하기 이전에 시작되므로 splash 1.5s hold 안에 home avatar 가 cache hit.
if (typeof window !== "undefined") {
  const PRIORITY: Array<keyof typeof bunnyImages> = ["idle", "eat25"];
  for (const k of PRIORITY) {
    try {
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = "high";
      // srcset 도 지정 → 2x DPR 디바이스가 큰 자산을 미리 받음.
      const a = bunnyImages[k];
      if (a.srcSet) img.srcset = a.srcSet;
      img.src = a.src;
      if (typeof img.decode === "function") void img.decode().catch(() => {});
    } catch {
      /* noop */
    }
  }
}

// Route-based code splitting — 각 페이지 별도 청크.
const HomePage = lazy(() =>
  import("./pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const CollectionPage = lazy(() =>
  import("./pages/CollectionPage").then((m) => ({ default: m.CollectionPage })),
);
const ReportPage = lazy(() =>
  import("./pages/ReportPage").then((m) => ({ default: m.ReportPage })),
);
const MyInfoPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.MyInfoPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);
// PR-121 — 법적 문서 라우트.
const PrivacyPage = lazy(() =>
  import("./pages/LegalPage").then((m) => ({ default: m.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import("./pages/LegalPage").then((m) => ({ default: m.TermsPage })),
);
const RewardsLegalPage = lazy(() =>
  import("./pages/LegalPage").then((m) => ({ default: m.RewardsPage })),
);

function ScreenFallback() {
  return (
    <div
      aria-hidden
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        color: "var(--text-tertiary)",
        fontSize: "var(--text-caption)",
      }}
    />
  );
}

const FIRST_LANDING_KEY = "first_landing:v2";

function FirstLandingRedirect() {
  const [location, navigate] = useLocation();
  useEffect(() => {
    // BunnyTime v2 — first screen after splash/login is the Farm tab.
    // We only redirect on the very first navigation event of a fresh
    // session, and only if the user landed on `/`. After that, the home
    // tab is fully usable as the user expects.
    if (safeStorage.get(FIRST_LANDING_KEY) === "done") return;
    if (location === "/") {
      navigate("/collection", { replace: true });
    }
    safeStorage.set(FIRST_LANDING_KEY, "done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function AnimatedRoutes() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      >
        <Suspense fallback={<ScreenFallback />}>
          <Switch location={location}>
            <Route path="/" component={HomePage} />
            <Route path="/collection" component={CollectionPage} />
            <Route path="/report" component={ReportPage} />
            {/* 8.0-a — Settings 가 "내 정보" 로 통합. /settings 도 호환 유지. */}
            <Route path="/me" component={MyInfoPage} />
            <Route path="/settings" component={MyInfoPage} />
            {/* PR-121 — 법적 문서. /privacy, /terms, /rewards. */}
            <Route path="/privacy" component={PrivacyPage} />
            <Route path="/terms" component={TermsPage} />
            <Route path="/rewards" component={RewardsLegalPage} />
            <Route component={NotFoundPage} />
          </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const setAuth = useUserStore((s) => s.setAuth);
  const setStats = useUserStore((s) => s.setStats);
  const setLoading = useUserStore((s) => s.setLoading);

  // Phase 8.0-c — timer / sound 이 라우트와 무관하게 background 에서 계속 동작.
  useTimerEngine();
  useSoundPlayer();

  const [splashDone, setSplashDone] = useState(false);

  // Phase 7.9 polish — splash 동안 모든 자주 노출되는 bunny webp 를 decode 까지
  // 끝내 캐시에 올린다. Home 타이머 / 컬렉션 / Settings 진입 시 stutter 가 사라진다.
  useEffect(() => {
    // 1) 1차 — Home 타이머에서 즉시 노출되는 두 장은 high priority decode().
    const eager: Array<keyof typeof bunnyImages> = ["idle", "eat25"];
    eager.forEach((k) => {
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = "high";
      img.src = bunnyImages[k].src;
      if (typeof img.decode === "function") void img.decode().catch(() => {});
    });

    // 2) 2차 — 진행률/일시정지/완료/실패/Settings/Collection 대표.
    //    splash idle 동안 background 로 fetch+decode, requestIdleCallback 으로 우선순위 양보.
    const rest: Array<keyof typeof bunnyImages> = [
      "eat50",
      "eat75",
      "focus",
      "success",
      "cry",
      "sleep",
      "rare_king",
      "rare_ninja",
      "rare_wizard",
      "legendary_demon",
    ];
    const schedule =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    schedule(() => {
      rest.forEach((k) => {
        const img = new Image();
        img.decoding = "async";
        img.src = bunnyImages[k].src;
        if (typeof img.decode === "function") void img.decode().catch(() => {});
      });
    });

    // 3) 코드 청크 warm-up — splash 1.5s 동안 비동기 로드.
    void import("./pages/HomePage");
    void import("./pages/CollectionPage");
    void import("./pages/SettingsPage");
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const snap = await initAuth();
      if (!alive) return;
      setAuth({ user: snap.user, mode: snap.mode, hint: snap.hint });
      setLoading(false);
      if (snap.mode === "toss") {
        const me = await fetchMe();
        if (alive && me.ok && me.data?.user) {
          const u = me.data.user;
          setStats(
            {
              totalCarrots: u.total_carrots ?? 0,
              totalFocusMinutes: u.total_focus_minutes ?? 0,
              streakDays: u.streak_days ?? 0,
              longestFocusMinutes: u.longest_focus_minutes ?? 0,
            },
            true,
          );
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [setAuth, setStats, setLoading]);

  // R26 PR-155 — 도감 owned 변화 → 버섯집 가구 자동 지급 hook. App
  // root 에서 1회 mount. 사용자가 농장 외 화면 (홈 / 리포트) 에 있어도
  // 도감 새 unlock 시점에 toast 로 도착 안내.
  useFarmhubDogamGrant();

  return (
    <ThemeProvider>
      <AppsInTossLoginGate>
        <Router hook={useHashLocation}>
          <div className="app-shell">
            <FirstLandingRedirect />
            <AnimatedRoutes />
            <TabBar />
            <ToastViewport />
            {/* PR-61 — in-app banner. webNotify fallback path 의 surface. */}
            <InAppBanner />
            {/* PR-122 — 피드백 시트 (cc:feedback:open 이벤트 listener). */}
            <FeedbackSheet />
          </div>
        </Router>
        {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      </AppsInTossLoginGate>
    </ThemeProvider>
  );
}
