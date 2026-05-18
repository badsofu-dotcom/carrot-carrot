/**
 * useSafeAreaInsets — Apps in Toss SDK 의 SafeAreaInsets.get/.subscribe
 * 를 React 훅으로 감쌈. R30.5 PR-177.
 *
 * 배경 — env(safe-area-inset-*) 는 Apps in Toss WebView 환경에서 종종
 * 0 또는 부정확한 값으로 보고됨. 토스 공식 SDK 의 SafeAreaInsets API
 * 가 정확한 픽셀값을 제공.
 *
 * 동작:
 *   - Apps in Toss 안: SDK 가 측정한 실제 inset (예: iPhone 14 Pro
 *     34px) — `available: true`.
 *   - 일반 브라우저 / preview: SDK 호출이 throw → fallback (모두 0) +
 *     `available: false`. 호출부는 이 경우 CSS env() 기본값을 그대로
 *     쓸 수 있게 var 를 setProperty 하지 않으면 됨.
 *
 * 무한 re-render 방지 — subscribe 는 useEffect 안에서 mount 시 1회만
 * 등록. onEvent 콜백이 동일 객체를 반환하더라도 React state setter 가
 * 얕은 비교로 무시함 (참조 비교).
 */

import { useEffect, useState } from "react";
import { SafeAreaInsets } from "@apps-in-toss/web-framework";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const FALLBACK: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export interface SafeAreaResult {
  insets: Insets;
  /** true: SDK 가 정상 응답 (Apps in Toss WebView). false: 일반 브라우저 fallback. */
  available: boolean;
}

function tryGet(): { insets: Insets; available: boolean } {
  try {
    const i = SafeAreaInsets.get();
    return {
      insets: {
        top: Number(i.top) || 0,
        right: Number(i.right) || 0,
        bottom: Number(i.bottom) || 0,
        left: Number(i.left) || 0,
      },
      available: true,
    };
  } catch {
    return { insets: FALLBACK, available: false };
  }
}

export function useSafeAreaInsets(): SafeAreaResult {
  const [state, setState] = useState<SafeAreaResult>(() => tryGet());

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      cleanup = SafeAreaInsets.subscribe({
        onEvent: (next) => {
          setState({
            insets: {
              top: Number(next.top) || 0,
              right: Number(next.right) || 0,
              bottom: Number(next.bottom) || 0,
              left: Number(next.left) || 0,
            },
            available: true,
          });
        },
      });
    } catch {
      /* 일반 브라우저 — subscribe 미지원. CSS env() 기본값 사용. */
    }
    return () => {
      try {
        cleanup?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return state;
}
