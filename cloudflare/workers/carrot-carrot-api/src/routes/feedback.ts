/**
 * Beta feedback channel (Round 18, PR-134).
 *
 *   POST /feedback   { message, context: {...} }
 *
 * No auth — kept as a lightweight beta channel. The client (FeedbackSheet)
 * already strips PII (no nickname / user_key / location) before sending;
 * the worker just forwards to Telegram for the maintainer to see.
 *
 * Fallback ladder:
 *   - TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID both set → forward to Telegram
 *   - Either missing                                 → `console.log` only
 *     (worker tail still surfaces it; safe to ship beta without TG setup)
 *   - Telegram upstream non-2xx                     → log + still return ok
 *     (client only sees a success toast — feedback is fire-and-forget)
 *
 * Body cap: 2 kB per message, oversized truncated with an ellipsis. The
 * worker rejects empty messages with 400 to avoid spam-button bots.
 */

import { Hono } from "hono";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

interface FeedbackBody {
  message?: string;
  context?: {
    appVersion?: string;
    authMode?: string;
    userAgent?: string;
    timestamp?: string;
    url?: string;
  };
}

const MAX_MSG_BYTES = 2_000;

app.post("/", async (c) => {
  let body: FeedbackBody = {};
  try {
    body = await c.req.json<FeedbackBody>();
  } catch {
    return c.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "invalid json" } },
      400,
    );
  }
  const raw = body.message?.trim() ?? "";
  if (!raw) {
    return c.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "empty message" } },
      400,
    );
  }
  const safe =
    raw.length > MAX_MSG_BYTES ? `${raw.slice(0, MAX_MSG_BYTES)}…` : raw;

  const ctx = body.context ?? {};
  const lines = [
    "📨 *베타 피드백*",
    "",
    safe,
    "",
    "—",
    `version: ${ctx.appVersion ?? "?"}`,
    `auth:    ${ctx.authMode ?? "?"}`,
    `url:     ${ctx.url ?? "?"}`,
    `at:      ${ctx.timestamp ?? "?"}`,
    `ua:      ${(ctx.userAgent ?? "?").slice(0, 100)}`,
  ];
  const text = lines.join("\n");

  // Always log to worker console — acts as the silent-fallback store.
  // `wrangler tail` surfaces this in real-time; no PII expected per the
  // FeedbackSheet contract.
  console.log("[feedback]", JSON.stringify({ msg: safe, ctx }));

  const token = c.env.TELEGRAM_BOT_TOKEN;
  const chatId = c.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return c.json({ ok: true, data: { delivered: "log_only" } });
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).slice(0, 200);
      console.warn(
        "[feedback] telegram non-2xx:",
        res.status,
        snippet,
      );
      return c.json({
        ok: true,
        data: { delivered: "log_only_telegram_failed", upstreamStatus: res.status },
      });
    }
    return c.json({ ok: true, data: { delivered: "telegram" } });
  } catch (e) {
    console.warn(
      "[feedback] telegram exception:",
      e instanceof Error ? e.message : String(e),
    );
    return c.json({ ok: true, data: { delivered: "log_only_telegram_threw" } });
  }
});

export default app;
