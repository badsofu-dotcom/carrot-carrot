/**
 * feedbackChannel (PR-122) — 베타 피드백 채널.
 *
 * 사용자가 "피드백 보내기" 탭 시 환경 정보 + 메시지를 Telegram bot
 * (또는 다른 webhook) 에 POST. 베타 5~20명 대상 — 가벼운 채널.
 *
 * Endpoint:
 *   `VITE_FEEDBACK_WEBHOOK_URL` env (없으면 in-app 토스트 fallback).
 *
 * 자동 첨부:
 *   - 앱 버전 (APP_VERSION)
 *   - 사용자 모드 (toss / mock / guest)
 *   - User Agent
 *   - KST timestamp
 *   - 사용자 작성 메시지
 *
 * 개인정보 안 보냄: 닉네임 / user_key / 위치 등 X.
 */

interface FeedbackPayload {
  message: string;
  context: {
    appVersion: string;
    authMode: string;
    userAgent: string;
    timestamp: string;
    url: string;
  };
}

const FEEDBACK_WEBHOOK = (import.meta.env.VITE_FEEDBACK_WEBHOOK_URL as
  | string
  | undefined) ?? "";

/**
 * Send feedback. Returns ok = true on successful POST.
 * Fallback (no webhook configured): returns ok = false, caller shows
 * "복사됨" toast or similar.
 */
export async function sendFeedback(args: {
  message: string;
  authMode: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!args.message.trim()) {
    return { ok: false, reason: "empty" };
  }
  if (!FEEDBACK_WEBHOOK) {
    return { ok: false, reason: "no_webhook" };
  }
  const payload: FeedbackPayload = {
    message: args.message.trim(),
    context: {
      appVersion:
        (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev",
      authMode: args.authMode,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "ssr",
      timestamp: new Date().toISOString(),
      url:
        typeof window !== "undefined"
          ? window.location.hash || window.location.pathname
          : "ssr",
    },
  };
  try {
    const res = await fetch(FEEDBACK_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      // Don't include credentials/cookies (webhook is third-party 가능성).
      credentials: "omit",
      mode: "cors",
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Whether the feedback feature is configured (env present). */
export function isFeedbackConfigured(): boolean {
  return Boolean(FEEDBACK_WEBHOOK);
}
