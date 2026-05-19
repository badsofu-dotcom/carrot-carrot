/**
 * Apps-in-Toss back-button 인터셉트 — 모듈 레벨 핸들러 스택.
 *
 * 배경:
 *   - 토스 WebView 의 좌상단 back 버튼 + Android 하드웨어 back 키는 둘 다
 *     SDK 의 `graniteEvent.addEventListener("backEvent", ...)` 채널로 들어온다.
 *   - listener 가 없으면 토스 기본 동작 (= WebView 닫고 토스 홈으로 복귀).
 *   - 풀스크린 모달이 여러 개 stack 으로 떠있을 때 (예: 보관함 위에
 *     젬 교환, 농장집 위에 가구 구매), 가장 위 모달 하나만 닫고 멈춰야 한다.
 *
 * 구현:
 *   - 모듈 레벨 핸들러 스택 유지. mount 순서 = stack 순서.
 *   - SDK listener 는 스택이 비어있지 않을 때만 1개 유지. 다중 listener
 *     의 호출 순서가 SDK 문서에 명시되지 않아 race 회피.
 *   - backEvent 발생 시 스택의 top 핸들러 1개만 호출. 나머지는 그대로.
 *   - 마지막 핸들러가 unmount 되면 SDK listener 도 자동 해제 → 농장 화면
 *     에서 back 누르면 토스 홈으로 정상 복귀.
 *
 * 일반 브라우저 / Vite dev / Perplexity iframe 에서는 SDK 부재로
 * listener 등록 자체가 일어나지 않는다 (no-op).
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

type Handler = () => void;

const handlerStack: Handler[] = [];

let sdkRemove: (() => void) | null = null;
let sdkLoading = false;

function dispatchTop(): void {
  const top = handlerStack[handlerStack.length - 1];
  if (!top) return;
  try {
    top();
  } catch {
    /* never let UI handler crash the bridge */
  }
}

function ensureSdkListener(): void {
  if (sdkRemove || sdkLoading) return;
  if (typeof window === "undefined") return;
  if (!isInTossApp()) return;
  sdkLoading = true;
  import("@apps-in-toss/web-framework")
    .then((mod) => {
      sdkLoading = false;
      // 스택이 비었으면 등록 불필요 (mount/unmount 가 빠르게 일어난 케이스).
      if (handlerStack.length === 0) return;
      const ge = (mod as unknown as GraniteEventModule).graniteEvent;
      if (!ge?.addEventListener) return;
      try {
        sdkRemove = ge.addEventListener("backEvent", {
          onEvent: dispatchTop,
          onError: () => {
            /* ignore */
          },
        });
      } catch {
        /* SDK shape mismatch — fail silent */
      }
    })
    .catch(() => {
      sdkLoading = false;
    });
}

function teardownSdkListener(): void {
  if (!sdkRemove) return;
  try {
    sdkRemove();
  } catch {
    /* ignore */
  }
  sdkRemove = null;
}

/**
 * active=true 동안 토스 back / 하드웨어 back 을 onBack 으로 가로챈다.
 * 여러 모달이 동시에 등록해도 가장 마지막 (top) 만 호출됨.
 * onBack 은 매 렌더 새 함수를 줘도 ref 로 따라가므로 useCallback 불필요.
 */
export function useTossBackButton(onBack: () => void, active: boolean): void {
  const cbRef = useRef(onBack);
  useEffect(() => {
    cbRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!active) return;
    const handler: Handler = () => cbRef.current();
    handlerStack.push(handler);
    ensureSdkListener();
    return () => {
      const idx = handlerStack.lastIndexOf(handler);
      if (idx >= 0) handlerStack.splice(idx, 1);
      if (handlerStack.length === 0) teardownSdkListener();
    };
  }, [active]);
}
