/**
 * Phase 7.7 — 스플래시 스크린.
 *
 * 의도:
 *   - 앱 최초 mount 시 1500ms 노출 → 즉시 unmount → 홈.
 *   - 토스 톤. 정적이고 정돈된 한 화면, 앱 아이콘 + 로고.
 *   - reduced-motion 이면 entry 애니메이션 없이 정적 노출.
 *
 * Phase 7.9 polish — hold 가 끝나는 순간 어떤 ghost overlay 도 Home 위에 컴포지트되지
 * 않도록 hard cut. 즉, fade-out / AnimatePresence exit 애니메이션 없이 한 프레임에
 * unmount + onDone() 호출 → 다음 프레임은 순수 Home 만 paint.
 */

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

/**
 * Phase 7.9.3 — splash 아이콘은 public/icons/app-icon-splash-{240,480}.webp 를 사용한다.
 * - index.html 의 <link rel="preload"> 가 같은 URL 을 high priority 로 미리 가져옴.
 * - WebP 480 ≈ 16KB (이전 PNG 512 의 ~485KB 대비 ~30× 가벼움) → first paint 가 또렷.
 * - 240px @1x / 480px @2x srcset 으로 retina 도 정밀.
 * - WebP 디코드가 어떤 이유로든 실패하면 PNG 192 로 폴백 (picture > source/img).
 *
 * BASE_URL prefix 로 vite `base: "./"` 빌드가 iframe / 서브패스 호스팅 환경에서도
 * splash WebP 를 정확히 해소하도록 한다 — 절대 root path `/icons/...` 는 토스 미니앱
 * iframe 에서 호스트 root 로 빠져 깨진 아이콘이 노출됐었다.
 *
 * `app-icon-splash-*` 파일명은 기존 `app-icon-{240,480}.webp` 캐시 무효화도 겸한다.
 */
const BASE = import.meta.env.BASE_URL;
const SPLASH_ICON_1X = `${BASE}icons/app-icon-splash-240.webp`;
const SPLASH_ICON_2X = `${BASE}icons/app-icon-splash-480.webp`;
const SPLASH_ICON_PNG = `${BASE}icons/app-icon-192.png`;

interface SplashScreenProps {
  /** Hold 가 끝나면 즉시 호출되어 React 가 splash 를 unmount 한다. */
  onDone: () => void;
}

const HOLD_MS = 1500;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const reduced = useMemo(prefersReducedMotion, []);

  // Phase 7.9 polish — splash dismissal 은 두 조건 모두 충족해야 한다:
  //  (1) 앱 아이콘 이미지 decode 완료 (혹은 실패 → 영원히 막히지 않음)
  //  (2) 최소 1500ms 노출
  // 둘 다 만족된 그 프레임에 hard cut. (이전 fade-out / AnimatePresence 없음)
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    let iconReady = false;
    let holdReached = false;

    const tryDismiss = () => {
      if (cancelled || !iconReady || !holdReached) return;
      setVisible(false);
      onDone();
    };

    // 아이콘 decode — preloaded WebP (240+480) 를 새 Image 로 decode().
    const probe = new Image();
    probe.decoding = "async";
    probe.fetchPriority = "high";
    probe.srcset = `${SPLASH_ICON_1X} 1x, ${SPLASH_ICON_2X} 2x`;
    probe.src = SPLASH_ICON_2X;
    const markIcon = () => {
      iconReady = true;
      tryDismiss();
    };
    if (typeof probe.decode === "function") {
      probe.decode().then(markIcon).catch(markIcon);
    } else {
      probe.onload = markIcon;
      probe.onerror = markIcon;
    }
    // 이미 디코드된 캐시 히트 안전망.
    if (probe.complete && probe.naturalWidth > 0) iconReady = true;

    const elapsed = Date.now() - start;
    const remaining = Math.max(0, HOLD_MS - elapsed);
    const t = window.setTimeout(() => {
      holdReached = true;
      tryDismiss();
    }, remaining);

    // 안전 cap — decode 가 무한 hang 해도 5초 안에는 무조건 진행.
    const cap = window.setTimeout(() => {
      iconReady = true;
      holdReached = true;
      tryDismiss();
    }, 5000);

    // 동기 캐시 히트라면 즉시 한 번 시도.
    tryDismiss();

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.clearTimeout(cap);
    };
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="버니타임 로딩 중"
      data-testid="splash-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#FFF8E7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* 우상단 carrot glow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(255, 153, 64, 0.32), rgba(255,153,64,0) 70%)",
          filter: "blur(8px)",
          pointerEvents: "none",
        }}
      />

      {/* Phase 7.8 — 최종 앱 아이콘 240×240 rounded-3xl. */}
      <motion.div
        initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          position: "relative",
          width: 240,
          height: 240,
          marginBottom: 24,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -28,
            borderRadius: 48,
            background:
              "radial-gradient(closest-side, rgba(255, 153, 64, 0.28), rgba(255,153,64,0) 70%)",
            filter: "blur(16px)",
          }}
        />
        <picture>
          <source
            type="image/webp"
            srcSet={`${SPLASH_ICON_1X} 1x, ${SPLASH_ICON_2X} 2x`}
          />
          <img
            src={SPLASH_ICON_PNG}
            alt="버니타임"
            width={240}
            height={240}
            fetchPriority="high"
            decoding="async"
            draggable={false}
            style={{
              position: "relative",
              width: 240,
              height: 240,
              borderRadius: 48,
              display: "block",
              objectFit: "contain",
              background: "var(--accent-carrot)",
              boxShadow: "0 24px 48px rgba(199, 62, 29, 0.18)",
            }}
            data-testid="splash-app-icon"
          />
        </picture>
      </motion.div>

      {/* 로고 — fade-up 300ms (entry only). */}
      <motion.div
        initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.18, ease: "easeOut" }}
        style={{ textAlign: "center" }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#28251D",
            lineHeight: 1.1,
          }}
        >
          버니타임
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#FF6B35",
          }}
        >
          Pomodoro Focus
        </p>
      </motion.div>
    </div>
  );
}
