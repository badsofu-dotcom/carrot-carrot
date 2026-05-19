/**
 * Apps-in-Toss back-button 인터셉트.
 *
 * 토스 WebView 의 좌상단 back 버튼 + Android 하드웨어 back 키는 둘 다
 * SDK 의 `graniteEvent.addEventListener("backEvent", ...)` 채널로 들어온다.
 * listener 가 없으면 토스 기본 동작 (= WebView 닫고 토스 홈으로 복귀) 이
 * 실행됨. 풀스크린 모달이 열려있을 때는 그 모달을 먼저 닫아야 하므로
 * mount 동안 onBack 으로 가로챈다.
 *
 * 일반 브라우저 / Vite dev / Perplexity iframe 에서는 SDK 가 없으므로
 * no-op (UI 깨지지 않음).
 */
import { useEffect, useRef } from "react";

function isInTossApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ua = navigator.userAgent || "";
    if (/toss/i.test(ua)) return true;
    if ((window as unknown as { TossApps?: unknown }).TossApps) return true;
  } catch {
    /* ignore */
  }
  return false;
}

type GraniteEventModule = {
  graniteEvent?: {
    addEventListener: (
      event: "backEvent",
      opts: { onEvent: () => void; onError?: (e: Error) => void },
    ) => () => void;
  };
};

/**
 * active=true 동안 토스 back / 하드웨어 back 을 onBack 으로 가로챈다.
 * onBack 은 매 렌더 새 함수를 줘도 ref 로 따라가므로 useCallback 불필요.
 * 일반 브라우저에서는 listener 등록 자체가 일어나지 않는다.
 */
export function useTossBackButton(onBack: () => void, active: boolean): void {
  const cbRef = useRef(onBack);
  useEffect(() => {
    cbRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;
    if (!isInTossApp()) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    import("@apps-in-toss/web-framework")
      .then((mod) => {
        if (cancelled) return;
        const ge = (mod as unknown as GraniteEventModule).graniteEvent;
        if (!ge?.addEventListener) return;
        try {
          const remove = ge.addEventListener("backEvent", {
            onEvent: () => {
              try {
                cbRef.current();
              } catch {
                /* swallow — never let UI back-handler crash the bridge */
              }
            },
            onError: () => {
              /* ignore */
            },
          });
          if (cancelled) {
            try {
              remove();
            } catch {
              /* ignore */
            }
            return;
          }
          cleanup = remove;
        } catch {
          /* SDK shape mismatch — fail silent, default back behavior resumes */
        }
      })
      .catch(() => {
        /* SDK not available — preview / browser path */
      });

    return () => {
      cancelled = true;
      if (cleanup) {
        try {
          cleanup();
        } catch {
          /* ignore */
        }
        cleanup = null;
      }
    };
  }, [active]);
}
