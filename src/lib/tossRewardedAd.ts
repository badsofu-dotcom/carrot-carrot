/**
 * Apps in Toss 보상형(rewarded) 광고 어댑터.
 *
 * 책임:
 *   - 프리미엄 백색소음 잠금해제 흐름에서 한 군데로 모인 진입점.
 *   - 1) 토스 앱 / Apps in Toss 환경에서 SDK 가 지원되면 실제 보상형 광고를 띄운다.
 *     2) `userEarnedReward` 이벤트가 들어오면 `granted` 상태로 resolve.
 *     3) SDK 미지원 / 외부 브라우저 / mock env 인 경우엔 `simulated` 로 안전하게 fallback.
 *   - 어떤 실패도 throw 하지 않는다. 결과는 `RewardedAdResult.kind` 로 표현.
 *
 * 보안 / 정책:
 *   - 광고 그룹 ID 는 Apps in Toss 콘솔에서 발급받은 값.
 *     기본값은 콘솔에 등록된 공식 보상형 그룹(`백색소음 사운드 잠금해제 보상`,
 *     `ait.v2.live.146b65d064c2402e`). `VITE_TOSS_AD_GROUP_ID` 로 덮어쓸 수 있어
 *     향후 그룹 교체에도 코드 변경 없이 대응 가능.
 *   - 어떤 비밀값(client_secret, mTLS key, decrypt key) 도 이 모듈에서 다루지 않는다.
 *     광고 그룹 ID 는 콘솔에 노출되는 식별자이며 시크릿이 아니다.
 */

/**
 * Apps in Toss 콘솔에 등록된 공식 보상형 광고 그룹 ID.
 * 그룹명: '백색소음 사운드 잠금해제 보상' (보상: 백색소음 사운드 1).
 * Networks: Pangle, AppLovin, Meta Audience Network, WF_15.08, WF_3.23, WF_6.46,
 * WF_4.31, WF_21.54, WF_10.77, AdMob Network, Mintegral.
 */
const DEFAULT_AD_GROUP_ID = "ait.v2.live.146b65d064c2402e";

export type RewardedAdResult =
  | { kind: "granted"; via: "apps-in-toss"; unitType?: string; unitAmount?: number }
  | { kind: "simulated"; via: "mock" }
  | { kind: "cancelled" }
  | { kind: "failed"; reason: string }
  | { kind: "unsupported"; reason: string };

const SIMULATION_DELAY_MS = 14_500;

function envBool(key: string): boolean {
  const v = (import.meta.env as Record<string, unknown>)[key];
  return typeof v === "string" && v === "true";
}

function adGroupId(): string | null {
  const v = (import.meta.env as Record<string, unknown>).VITE_TOSS_AD_GROUP_ID;
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  // 구버전 호환 — `VITE_TOSS_AD_UNIT_ID` 도 허용.
  const legacy = (import.meta.env as Record<string, unknown>).VITE_TOSS_AD_UNIT_ID;
  if (typeof legacy === "string" && legacy.trim().length > 0) return legacy.trim();
  // 콘솔 등록된 공식 그룹 ID 를 기본값으로 사용. env 로 덮어쓸 수 있다.
  return DEFAULT_AD_GROUP_ID;
}

function isMockForced(): boolean {
  if (envBool("VITE_TOSS_AD_MOCK")) return true;
  // VITE_TOSS_AUTH_MOCK 가 켜진 환경(=Perplexity preview / 로컬 일반 브라우저)
  // 에서는 광고도 자동으로 simulation 으로 동작.
  if (envBool("VITE_TOSS_AUTH_MOCK")) return true;
  if (envBool("VITE_MOCK_AUTH")) return true;
  return false;
}

interface AppsInTossWindowShim {
  TossApps?: unknown;
}

function isInTossLikeEnv(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ua = navigator.userAgent || "";
    if (/toss/i.test(ua)) return true;
    if ((window as unknown as AppsInTossWindowShim).TossApps) return true;
  } catch {
    /* noop */
  }
  return false;
}

/**
 * 보상형 광고 1회 시청 흐름.
 * `simulationFallbackMs` 만큼 simulated 진행을 보장하고 싶다면 호출자가 추가로 대기하면 된다.
 *
 * PR-139 (Round 20) — 진단 로그 추가. 베타6 피드백 "광고 재생 안 됨"
 * 원인 추적을 위해 흐름의 각 분기에 `[ad/diag]` prefix 로 console.log.
 * 토스 미니앱 WebView 콘솔 또는 `wrangler tail` 로 확인 가능.
 */
export async function watchRewardedAd(): Promise<RewardedAdResult> {
  console.log("[ad/diag] watchRewardedAd called", {
    mockForced: isMockForced(),
    tossLike: isInTossLikeEnv(),
    adGroup: adGroupId(),
  });

  // 1) 강제 mock(개발/preview) — SDK 시도 안 함.
  if (isMockForced() && !isInTossLikeEnv()) {
    console.log("[ad/diag] mock forced (non-toss env) → simulated");
    await delay(SIMULATION_DELAY_MS);
    return { kind: "simulated", via: "mock" };
  }

  // 2) 광고 그룹 ID — 기본은 공식 그룹, env 로 덮어쓰기 가능.
  //    안전망: 만약 어떤 이유로 빈 값이면 simulation fallback.
  const adGroup = adGroupId();
  if (!adGroup) {
    console.warn("[ad/diag] adGroupId empty → simulated");
    await delay(SIMULATION_DELAY_MS);
    return { kind: "simulated", via: "mock" };
  }

  // 3) Apps in Toss SDK 동적 import. dist-web 빌드는 web-bridge 의 GoogleAdMob 을
  //    프록시한다. 외부 브라우저에서는 isSupported() === false 가 정상.
  type AdMobLoadEvent =
    | { type: "loaded"; data?: unknown }
    | { type: string; data?: unknown };
  type AdMobShowEvent =
    | { type: "userEarnedReward"; data: { unitType?: string; unitAmount?: number } }
    | { type: "dismissed" }
    | { type: "failedToShow" }
    | { type: "clicked" }
    | { type: "impression" }
    | { type: "show" }
    | { type: "requested" };

  interface SdkShape {
    GoogleAdMob?: {
      loadAppsInTossAdMob: ((args: {
        onEvent: (e: AdMobLoadEvent) => void;
        onError: (e: Error) => void;
        options?: { adGroupId: string };
      }) => () => void) & { isSupported: () => boolean };
      showAppsInTossAdMob: ((args: {
        onEvent: (e: AdMobShowEvent) => void;
        onError: (e: Error) => void;
        options?: { adGroupId: string };
      }) => () => void) & { isSupported: () => boolean };
    };
  }
  let mod: SdkShape | null = null;
  try {
    mod = (await import("@apps-in-toss/web-framework")) as unknown as SdkShape;
  } catch {
    mod = null;
  }
  const adMob = mod?.GoogleAdMob;
  const loadFn = adMob?.loadAppsInTossAdMob;
  const showFn = adMob?.showAppsInTossAdMob;

  if (
    !loadFn ||
    !showFn ||
    typeof loadFn.isSupported !== "function" ||
    typeof showFn.isSupported !== "function" ||
    !loadFn.isSupported() ||
    !showFn.isSupported()
  ) {
    console.warn("[ad/diag] SDK isSupported() false → simulated", {
      hasLoad: !!loadFn,
      hasShow: !!showFn,
      loadSupported: loadFn ? !!loadFn.isSupported?.() : false,
      showSupported: showFn ? !!showFn.isSupported?.() : false,
    });
    // 이 환경에선 실제 광고 노출 불가 — simulation 으로 대체.
    await delay(SIMULATION_DELAY_MS);
    return { kind: "simulated", via: "mock" };
  }
  console.log("[ad/diag] SDK ready — load + show isSupported=true, calling load…");

  // 4) 실제 보상형 광고 — load 후 show.
  return await new Promise<RewardedAdResult>((resolve) => {
    let settled = false;
    const settle = (r: RewardedAdResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    let cleanupLoad: (() => void) | undefined;
    let cleanupShow: (() => void) | undefined;
    const cleanupAll = () => {
      try {
        cleanupLoad?.();
      } catch {
        /* noop */
      }
      try {
        cleanupShow?.();
      } catch {
        /* noop */
      }
    };

    try {
      cleanupLoad = loadFn({
        options: { adGroupId: adGroup },
        onEvent: (event) => {
          console.log("[ad/diag] load event:", event.type);
          if (event.type === "loaded") {
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
                    // 보상 이벤트 없이 닫히면 cancelled.
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

    // 보호망 — 60초 안에 SDK 응답이 없으면 unsupported 로 종결.
    setTimeout(() => {
      settle({ kind: "unsupported", reason: "timeout" });
    }, 60_000);

    // resolve 되면 자원 정리.
    Promise.resolve().then(async () => {
      // settled 가 true 가 될 때까지 polling 대신, 다음 microtask 에 cleanup 등록.
      const interval = setInterval(() => {
        if (settled) {
          cleanupAll();
          clearInterval(interval);
        }
      }, 250);
    });
  });
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

/** UI 가 noop 호출 가능하도록 export. */
export const tossRewardedAd = {
  watch: watchRewardedAd,
  /** 콘솔에 등록된 광고 그룹 ID 가 있는지(=실광고 시도 가능한지). 표시용. */
  hasAdGroup: () => Boolean(adGroupId()),
};
