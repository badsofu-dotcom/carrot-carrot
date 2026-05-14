import { Hono } from "hono";
import type { Env } from "../types.js";
import { refreshAccessToken, fetchLoginMe, isTossError } from "../lib/toss.js";
import { decryptLoginMe } from "../lib/decrypt.js";
import { getUser } from "../lib/db.js";
import { signAppJwt } from "../lib/jwt.js";

const app = new Hono<{ Bindings: Env }>();

interface Body {
  refreshToken?: string;
}

app.post("/", async (c) => {
  let body: Body = {};
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "invalid json" } }, 400);
  }
  if (!body.refreshToken || typeof body.refreshToken !== "string") {
    return c.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "refreshToken 누락" } },
      400,
    );
  }

  const refreshed = await refreshAccessToken(c.env, body.refreshToken);
  if (isTossError(refreshed)) {
    if (refreshed.error === "MTLS_HANDSHAKE_FAILED") {
      console.error("toss refresh-token mTLS failed:", refreshed.message);
      return c.json(
        {
          ok: false,
          error: {
            code: "MTLS_HANDSHAKE_FAILED",
            message: "Apps in Toss mTLS handshake 실패 (refresh)",
          },
        },
        502,
      );
    }
    console.error(
      "toss refresh-token upstream failure:",
      refreshed.error,
      refreshed.upstream.status,
      refreshed.upstream.bodySnippet,
    );
    return c.json(
      {
        ok: false,
        error: {
          code: refreshed.error,
          message:
            refreshed.error === "TOKEN_RESPONSE_INVALID"
              ? "토스 refresh 응답 스키마 불일치"
              : "토스 refresh 실패",
          upstreamStatus: refreshed.upstream.status,
          upstreamBody: refreshed.upstream.bodySnippet,
        },
      },
      502,
    );
  }

  // 신규 access 로 login-me 재호출 → userKey 추출 → 우리 JWT 재발급.
  const meRes = await fetchLoginMe(c.env, refreshed.accessToken);
  if (isTossError(meRes)) {
    if (meRes.error === "MTLS_HANDSHAKE_FAILED") {
      console.error("toss login-me mTLS failed (refresh):", meRes.message);
      return c.json(
        {
          ok: false,
          error: {
            code: "MTLS_HANDSHAKE_FAILED",
            message: "Apps in Toss mTLS handshake 실패 (login-me on refresh)",
          },
        },
        502,
      );
    }
    console.error(
      "toss login-me upstream failure (refresh):",
      meRes.error,
      meRes.upstream.status,
      meRes.upstream.bodySnippet,
    );
    return c.json(
      {
        ok: false,
        error: {
          code: meRes.error,
          message:
            meRes.error === "USERINFO_RESPONSE_INVALID"
              ? "토스 사용자 정보 응답 스키마 불일치"
              : "토스 사용자 정보 조회 실패",
          upstreamStatus: meRes.upstream.status,
          upstreamBody: meRes.upstream.bodySnippet,
        },
      },
      502,
    );
  }
  const decryptResult = await decryptLoginMe(
    meRes,
    c.env.APPS_IN_TOSS_DECRYPTION_KEY,
    c.env.APPS_IN_TOSS_DECRYPTION_AAD,
  );
  if (!decryptResult.ok) {
    console.error(
      "toss login-me decrypt failure (refresh):",
      decryptResult.code,
      decryptResult.reason,
      decryptResult.failedFields ?? [],
    );
    return c.json(
      {
        ok: false,
        error: {
          code: decryptResult.code,
          message:
            decryptResult.code === "SERVER_ENV_MISSING"
              ? `Worker env 미설정: ${decryptResult.reason}`
              : `복호화 실패 (${decryptResult.reason})`,
          failedFields: decryptResult.failedFields ?? undefined,
        },
      },
      500,
    );
  }
  const decrypted = decryptResult.payload;

  const user = await getUser(c.env.DB, decrypted.userKey);
  if (!user) {
    return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "user not found" } }, 401);
  }

  const jwt = await signAppJwt(user.user_key, decrypted.name ?? null, c.env.JWT_SECRET);
  return c.json({
    ok: true,
    token: jwt,
    user: {
      userKey: user.user_key,
      name: decrypted.name ?? null,
      gender: decrypted.gender ?? null,
    },
  });
});

export default app;
