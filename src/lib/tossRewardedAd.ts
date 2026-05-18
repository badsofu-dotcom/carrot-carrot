/**
 * Apps in Toss 보상형(rewarded) 광고 어댑터.
 *
 * R30.6 PR-176 — 재작성. 이전 문제:
 *   - SDK 를 dynamic import → 빌드 청크 분기 + 동적 캐스팅이 IDE/번들러
 *     단계에서 noise 만 추가. 어차피 statically imported 되고 있어
 *     INEFFECTIVE_DYNAMIC_IMPORT 경고가 떴음.
 *   - `isSupported() === false` 시 production 에서도 silent simulation
 *     으로 떨어져 사용자에게 "광고 안 떴는데 보상은 들어옴" 회귀 발생.
 *   - load → loaded event → show 를 nested 로 호출하는 race-prone 패턴.
 *
 * R30.6 정책:
 *   - SDK 는 static import. `GoogleAdMob` 자체가 없으면 즉시 unsupported.
 *   - `isMockForced()` 가 true 일 때만 simulation (preview/외부 브라우저).
 *     그 외 환경에서 isSupported === false 면 unsupported 반환 (silent
 *     simulation 금지) — UI 가 "광고를 재생할 수 없어요" toast 로 응답.
 *   - load → loaded → show 흐름은 유지하지만, settle 시 즉시 cleanup
 *     (이전 폴링 패턴 제거).
 *   - 모든 결과는 RewardedAdResult.kind 로 표현. throw 없음.
 */

import { GoogleAdMob } from "@apps-in-toss/web-framework";

const DEFAULT_AD_GROUP_ID = "ait.v2.live.146b65d064c2402e";

export type RewardedAdResult =
  | { kind: "granted"; via: "apps-in-toss"; unitType?: string; unitAmount?: number }
  | { kind: "simulated"; via: "mock" }
  | { kind: "cancelled" }
  | { kind: "failed"; reason: string }
  | { kind: "unsupported"; reason: string };

const SIMULATION_DELAY_MS = 14_500;
const SHOW_TIMEOUT_MS = 60_000;

function envBool(key: string): boolean {
  const v = (import.meta.env as Record<string, unknown>)[key];
  return typeof v === "string" && v === "true";
}

function adGroupId(): string {
  const v = (import.meta.env as Record<string, unknown>).VITE_TOSS_AD_GROUP_ID;
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  const legacy = (import.meta.env as Record<string, unknown>).VITE_TOSS_AD_UNIT_ID;
  if (typeof legacy === "string" && legacy.trim().length > 0) return legacy.trim();
  return DEFAULT_AD_GROUP_ID;
}

function isMockForced(): boolean {
  if (envBool("VITE_TOSS_AD_MOCK")) return true;
  if (envBool("VITE_TOSS_AUTH_MOCK")) return true;
  if (envBool("VITE_MOCK_AUTH")) return true;
  return false;
}

function humanError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message?: unknown }).message ?? "unknown");
  }
  return String(e ?? "unknown");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function watchRewardedAd(): Promise<RewardedAdResult> {
  const adGroup = adGroupId();
  const mocked = isMockForced();
  console.log("[ad/diag] watchRewardedAd called", {
    mocked,
    adGroup,
    hasSdk: !!GoogleAdMob,
    hasLoad: !!GoogleAdMob?.loadAppsInTossAdMob,
    hasShow: !!GoogleAdMob?.showAppsInTossAdMob,
  });

  // 1) Preview / 외부 브라우저 — simulation 으로 통과.
  if (mocked) {
    console.log("[ad/diag] mock forced → simulated");
    await delay(SIMULATION_DELAY_MS);
    return { kind: "simulated", via: "mock" };
  }

  // 2) SDK 자체가 없거나 핸들러가 빠지면 unsupported (silent simulation X).
  const loadFn = GoogleAdMob?.loadAppsInTossAdMob;
  const showFn = GoogleAdMob?.showAppsInTossAdMob;
  if (!loadFn || !showFn) {
    console.warn("[ad/diag] SDK handler missing → unsupported");
    return { kind: "unsupported", reason: "sdk-handler-missing" };
  }

  // 3) isSupported() 체크 — false 면 production 에서 unsupported 반환.
  //    silent simulation 금지: UI 가 명확한 실패를 표시할 수 있어야 함.
  let loadSupported = false;
  let showSupported = false;
  try {
    loadSupported = loadFn.isSupported?.() === true;
    showSupported = showFn.isSupported?.() === true;
  } catch (err) {
    console.warn("[ad/diag] isSupported throw:", err);
  }
  if (!loadSupported || !showSupported) {
    console.warn("[ad/diag] isSupported false → unsupported", {
      loadSupported,
      showSupported,
    });
    return { kind: "unsupported", reason: "sdk-not-supported" };
  }

  console.log("[ad/diag] SDK ready — calling load with adGroup:", adGroup);

  // 4) 실 광고 흐름 — load → loaded event 안에서 show.
  return await new Promise<RewardedAdResult>((resolve) => {
    let settled = false;
    let cleanupLoad: (() => void) | undefined;
    let cleanupShow: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (r: RewardedAdResult) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      try {
        cleanupShow?.();
      } catch {
        /* ignore */
      }
      try {
        cleanupLoad?.();
      } catch {
        /* ignore */
      }
      resolve(r);
    };

    try {
      cleanupLoad = loadFn({
        options: { adGroupId: adGroup },
        onEvent: (event) => {
          console.log("[ad/diag] load event:", event.type);
          if (event.type !== "loaded") return;
          try {
            cleanupShow = showFn({
              options: { adGroupId: adGroup },
              onEvent: (e) => {
                console.log("[ad/diag] show event:", e.type);
                if (e.type === "userEarnedReward") {
                  settle({
                    kind: "granted",
                    via: "apps-in-toss",
                    unitType: e.data?.unitType,
                    unitAmount: e.data?.unitAmount,
                  });
                } else if (e.type === "dismissed") {
                  // 보상 없이 닫히면 cancelled — userEarnedReward 가 먼저
                  // settle 됐을 가능성이 있으므로 settle 자체가 idempotent.
                  settle({ kind: "cancelled" });
                } else if (e.type === "failedToShow") {
                  settle({ kind: "failed", reason: "failed-to-show" });
                }
              },
              onError: (err) => {
                console.error("[ad/diag] show error:", err);
                settle({ kind: "failed", reason: humanError(err) });
              },
            });
          } catch (err) {
            console.error("[ad/diag] show throw:", err);
            settle({ kind: "failed", reason: humanError(err) });
          }
        },
        onError: (err) => {
          console.error("[ad/diag] load error:", err);
          settle({ kind: "failed", reason: humanError(err) });
        },
      });
    } catch (err) {
      console.error("[ad/diag] load throw:", err);
      settle({ kind: "failed", reason: humanError(err) });
    }

    // SHOW_TIMEOUT_MS 안에 SDK 응답이 전혀 없으면 unsupported 로 종결.
    timer = setTimeout(() => {
      console.warn("[ad/diag] timeout — no SDK response");
      settle({ kind: "unsupported", reason: "timeout" });
    }, SHOW_TIMEOUT_MS);
  });
}

export const tossRewardedAd = {
  watch: watchRewardedAd,
  hasAdGroup: () => true,
};
