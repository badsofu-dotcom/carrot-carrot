import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  bunnyImages,
  BUNNY_TRANSPARENT,
  type BunnyKey,
} from "../assets/characters";
import { SpeechBubble } from "../design-system/ui";
import { haptic } from "../design-system/haptic";

const TAP_QUOTES = [
  "흐흐... 또 누르냐?",
  "한 번만 더, 한 번만 더",
  "당근... 어디 있어?",
  "킥킥, 간지러워",
  "내 시간 다 내꺼야",
  "...왜 자꾸 만져?",
  "야금야금 먹어줄게",
];

interface BunnyProps {
  variant: BunnyKey;
  size?: number;
  alt?: string;
  className?: string;
  breathe?: boolean;
  /** LCP 후보에 한해 true. 나머지는 lazy. */
  eager?: boolean;
  /** 누르면 바운스 + 말풍선 + haptic */
  interactive?: boolean;
  /** circular 프레임에 글로우 후광 */
  glow?: boolean;
  /** 프레임 모양 — circle | rounded(default 32px) | none */
  frame?: "circle" | "rounded" | "none";
  /** 말풍선 항상 노출용 (interactive 와 별개) */
  speech?: string | null;
  onTap?: () => void;
  /**
   * Round 17.5 — render the transparent (RGBA) variant from
   * BUNNY_TRANSPARENT instead of the cream-bg dogam asset. When true,
   * the soft-edge radial mask is also skipped (the alpha channel already
   * cuts the silhouette), so the bunny sits cleanly on any background.
   *
   * Currently used only by VisitorBunny on the farm card. If the dogam
   * id is missing from BUNNY_TRANSPARENT, the component falls back to
   * the cream-bg asset so nothing breaks.
   */
  transparent?: boolean;
}

export function Bunny({
  variant,
  size = 220,
  alt,
  className = "",
  breathe = true,
  eager = false,
  interactive = false,
  glow = false,
  frame = "rounded",
  speech: externalSpeech,
  onTap,
  transparent = false,
}: BunnyProps) {
  // Round 17.5 — when transparent=true and a cutout exists for this
  // variant, use it. Otherwise fall back to the standard cream-bg asset
  // so consumers never crash on an unmapped variant.
  const asset =
    (transparent ? BUNNY_TRANSPARENT[variant] : undefined) ??
    bunnyImages[variant];
  const [tapping, setTapping] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const tapTimeout = useRef<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  /**
   * Phase 7.9 polish — bunny 이미지가 paint-stable 상태가 되기 전 어떤 frame 에서도
   * 사용자에게 노출되지 않도록 한다. Phase 7.9.2 — App.tsx 에서 idle/eat25 등을
   * 미리 decode 해두므로 cache hit 인 경우 mount 첫 frame 에 이미 loaded=true 로 시작.
   */
  const [loaded, setLoaded] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const probe = new Image();
      probe.src = asset.src;
      return probe.complete && probe.naturalWidth > 0;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    // Cache hit 이면 effect 진입 시 이미 loaded 일 수 있다 — 이 때는 추가 작업 불필요.
    const cachedProbe = new Image();
    cachedProbe.src = asset.src;
    if (cachedProbe.complete && cachedProbe.naturalWidth > 0) {
      setLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    setLoaded(false);

    // 1) detached Image 를 만들어 decode() 까지 대기 → paint-stable 시점에 flag.
    const probe = new Image();
    probe.decoding = "async";
    if (asset.srcSet) probe.srcset = asset.srcSet;
    probe.src = asset.src;

    const markReady = () => {
      if (cancelled) return;
      // 2) 실제 보여지는 <img> 의 complete 도 함께 확인. 일반적으로 같은 src 라
      //    캐시되어 즉시 complete = true.
      const el = imgRef.current;
      if (el && (el.complete || el.naturalWidth === 0)) {
        // browser 가 raster 까지 끝낸 다음 frame 에 flag — paint flicker 차단.
        requestAnimationFrame(() => {
          if (!cancelled) setLoaded(true);
        });
      } else if (el) {
        el.addEventListener(
          "load",
          () => {
            requestAnimationFrame(() => {
              if (!cancelled) setLoaded(true);
            });
          },
          { once: true },
        );
      } else {
        if (!cancelled) setLoaded(true);
      }
    };

    if (typeof probe.decode === "function") {
      probe
        .decode()
        .then(markReady)
        .catch(markReady); // decode 실패해도 hide 상태 영구 고착 방지.
    } else {
      // 매우 구형 환경 fallback.
      probe.onload = markReady;
      probe.onerror = markReady;
    }

    return () => {
      cancelled = true;
    };
  }, [variant, asset.src, asset.srcSet]);

  const handleTap = () => {
    if (!interactive) return;
    haptic("medium");
    onTap?.();
    setTapping(true);
    if (tapTimeout.current) window.clearTimeout(tapTimeout.current);
    tapTimeout.current = window.setTimeout(() => setTapping(false), 520);

    const q = TAP_QUOTES[Math.floor(Math.random() * TAP_QUOTES.length)];
    setBubble(q);
    window.setTimeout(() => setBubble(null), 2400);
  };

  const radius =
    frame === "circle"
      ? "50%"
      : frame === "rounded"
        ? `var(--radius-bunny)`
        : "0";

  const showSpeech = (externalSpeech ?? bubble) !== null && (externalSpeech ?? bubble) !== "";
  const speechText = externalSpeech ?? bubble;

  // 토끼 webp 원본은 cream 단색 배경을 깔고 있다. rounded 프레임 안에서 cream
  // 영역이 그대로 보이면 흰 모달 같은 surface 위에서 "베이지 사각 블록" artifact
  // 로 읽힌다. 가장자리를 부드럽게 fade-out 시키는 radial mask 를 깔아 bunny
  // 캐릭터 부분만 surface 위에 떠 있는 느낌을 만든다. cream surface 위에서는
  // mask 가 cream-on-cream 으로 보이지 않으므로 home/timer 등에는 영향 없음.
  //
  // Round 17.5 — transparent 모드는 알파 채널이 이미 외곽을 잘라낸 상태이므로
  // mask 를 적용하면 캐릭터 가장자리(귀/꼬리)가 추가로 페이드되어 부자연스럽다.
  // → transparent=true 면 mask + cover crop 끄고 contain 으로 fit.
  const softEdgeMask =
    "radial-gradient(circle at 50% 52%, #000 55%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0) 96%)";

  const innerImg = (
    <img
      ref={imgRef}
      src={asset.src}
      srcSet={asset.srcSet}
      sizes={`${size}px`}
      alt={alt ?? `토끼 ${variant}`}
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      // 항상 async 디코드 — main thread paint blocking 방지.
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
      draggable={false}
      className={breathe && !tapping && loaded ? "bunny-breathe" : ""}
      style={{
        width: size,
        height: size,
        objectFit: transparent ? "contain" : "cover",
        borderRadius: transparent ? 0 : radius,
        display: "block",
        // 로드 전: 완전 투명 → 사각 placeholder/box flash 차단.
        // 로드 후: 짧은 페이드인 (160ms) 으로 자연스럽게 등장.
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.16s ease-out",
        WebkitMaskImage: transparent ? undefined : softEdgeMask,
        maskImage: transparent ? undefined : softEdgeMask,
      }}
    />
  );

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-block",
      }}
    >
      {glow && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -size * 0.15,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, var(--accent-carrot-soft), transparent 70%)",
            filter: "blur(18px)",
            opacity: 0.85,
            zIndex: 0,
          }}
        />
      )}
      {interactive ? (
        <motion.button
          type="button"
          onClick={handleTap}
          aria-label={alt ?? `토끼 ${variant}`}
          whileTap={{ scale: 0.95 }}
          animate={tapping ? { scale: [0.95, 1.08, 1] } : undefined}
          transition={{ duration: 0.5, ease: [0.34, 1.74, 0.5, 1] }}
          style={{
            position: "relative",
            width: size,
            height: size,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            zIndex: 1,
          }}
          data-testid={`bunny-${variant}`}
        >
          {innerImg}
        </motion.button>
      ) : (
        <div
          aria-label={alt ?? `토끼 ${variant}`}
          role="img"
          style={{ position: "relative", width: size, height: size, zIndex: 1 }}
          data-testid={`bunny-${variant}`}
        >
          {innerImg}
        </div>
      )}
      {speechText && <SpeechBubble visible={showSpeech}>{speechText}</SpeechBubble>}
    </div>
  );
}
