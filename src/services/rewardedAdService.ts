/**
 * Rewarded ad service (scaffold).
 *
 * This module is intentionally a stub. It exposes the API surface the
 * UI will eventually call, but never grants a reward client-side — that
 * is the server's job once the SDK callback is verified.
 *
 * SECURITY: do NOT add a "if status === dismissed → grant anyway"
 * branch. Every grant is a server decision. The frontend reports the
 * outcome and renders whatever the server returns.
 */

const ECONOMY_AD_VIEW_PATH = "/economy/ad-view";

export type AdPlacement =
  | "farm_card"
  | "report_bonus"
  | "withdraw_boost";

export type AdNetwork = "tossads" | "admob" | "mock";

export interface AdAttemptResult {
  /** Server-authoritative — null when offline / migration not applied. */
  rewarded: boolean;
  /** Status as reported to the server. */
  status: "started" | "completed" | "dismissed" | "error";
  /** Optional reason — eg "ad_reward_pending_sdk_integration". */
  reason?: string;
}

interface ShowAdOptions {
  placement: AdPlacement;
  /** API base URL — usually injected from env. */
  apiBase: string;
  /** Bearer JWT — required to attribute the view to a user. */
  bearerToken: string | null;
  /** Override network for testing. */
  network?: AdNetwork;
}

/**
 * Show a rewarded ad. Currently a stub that always reports
 * `dismissed` because no SDK is wired. Reports the outcome to the
 * worker for audit purposes — the worker logs but never grants a
 * reward based on `dismissed` (or based on any client claim).
 */
export async function showRewardedAd(opts: ShowAdOptions): Promise<AdAttemptResult> {
  const network: AdNetwork = opts.network ?? "mock";
  const status: AdAttemptResult["status"] = "dismissed";

  await postAdView({
    apiBase: opts.apiBase,
    bearerToken: opts.bearerToken,
    placement: opts.placement,
    network,
    status,
  });

  return {
    rewarded: false,
    status,
    reason: "ad_sdk_not_wired",
  };
}

interface AdViewPostBody {
  placement: AdPlacement;
  network: AdNetwork;
  status: AdAttemptResult["status"];
}

async function postAdView(
  args: AdViewPostBody & { apiBase: string; bearerToken: string | null },
): Promise<void> {
  if (!args.bearerToken) return;
  const url = `${args.apiBase.replace(/\/$/, "")}${ECONOMY_AD_VIEW_PATH}`;
  try {
    await fetch(url, {
      method: "POST",
      credentials: "omit",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${args.bearerToken}`,
      },
      body: JSON.stringify({
        placement: args.placement,
        network: args.network,
        status: args.status,
      }),
    });
  } catch {
    // Best effort. The audit log is server-side authoritative; a single
    // missed POST does not change reward state because the reward is
    // never granted on dismissed anyway.
  }
}
