import { Hono } from "hono";
import type { Env } from "../types.js";
import { exchangeAuthCode, fetchLoginMe, isTossError } from "../lib/toss.js";
import { decryptLoginMe } from "../lib/decrypt.js";
import { upsertUserOnLogin } from "../lib/db.js";
import { signAppJwt } from "../lib/jwt.js";

const app = new Hono<{ Bindings: Env }>();

interface Body {
  authorizationCode?: string;
  referrer?: string;
}

/**
 * GET /login 은 진단용. 브라우저 주소창에서 직접 열어보거나 health probe 가
 * 부딪혔을 때 의미 있는 JSON 을 돌려준다. 로그인 자체는 항상 POST 로만 받는다.
 */
app.get("/", (c) =>
  c.json(
    {
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "POST /login with { authorizationCode, referrer } from Apps in Toss appLogin().",
      },
    },
    405,
    { Allow: "POST, OPTIONS" },
  ),
);

app.post("/", async (c) => {
  let body: Body = {};
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "invalid json" } }, 400);
  }
  const code = body.authorizationCode;
  if (!code || typeof code !== "string") {
    return c.json(
      { ok: false, error: { code: "AUTHORIZE_FAILED", message: "authorizationCode 누락" } },
      400,
    );
  }

  const tokenRes = await exchangeAuthCode(c.env, code, body.referrer);
  if (isTossError(tokenRes)) {
    if (tokenRes.error === "MTLS_HANDSHAKE_FAILED") {
      console.error("toss generate-token mTLS failed:", tokenRes.message);
      return c.json(
        {
          ok: false,
          error: {
            code: "MTLS_HANDSHAKE_FAILED",
            message: "Apps in Toss mTLS handshake 실패 (Worker 인증서 binding 또는 만료 확인)",
          },
        },
        502,
      );
    }
    console.error(
      "toss generate-token upstream failure:",
      tokenRes.error,
      tokenRes.upstream.status,
      tokenRes.upstream.bodySnippet,
    );
    return c.json(
      {
        ok: false,
        error: {
          code: tokenRes.error,
          message:
            tokenRes.error === "TOKEN_RESPONSE_INVALID"
              ? "토스 토큰 응답 스키마 불일치"
              : "토스 토큰 교환 실패",
          upstreamStatus: tokenRes.upstream.status,
          upstreamBody: tokenRes.upstream.bodySnippet,
        },
      },
      502,
    );
  }

  const meRes = await fetchLoginMe(c.env, tokenRes.accessToken);
  if (isTossError(meRes)) {
    if (meRes.error === "MTLS_HANDSHAKE_FAILED") {
      console.error("toss login-me mTLS failed:", meRes.message);
      return c.json(
        {
          ok: false,
          error: {
            code: "MTLS_HANDSHAKE_FAILED",
            message: "Apps in Toss mTLS handshake 실패 (login-me)",
          },
        },
        502,
      );
    }
    console.error(
      "toss login-me upstream failure:",
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
    // 안전한 진단만 노출: 어떤 필드가 어떤 error class 로 실패했는지.
    // 키/암호문/평문은 절대 포함하지 않는다.
    console.error(
      "toss login-me decrypt failure:",
      decryptResult.code,
      decryptResult.reason,
      decryptResult.failedFields ?? [],
    );
    const status = decryptResult.code === "SERVER_ENV_MISSING" ? 500 : 500;
    const message =
      decryptResult.code === "SERVER_ENV_MISSING"
        ? `Worker env 미설정: ${decryptResult.reason}`
        : `복호화 실패 (${decryptResult.reason})`;
    return c.json(
      {
        ok: false,
        error: {
          code: decryptResult.code,
          message,
          failedFields: decryptResult.failedFields ?? undefined,
        },
      },
      status,
    );
  }
  const decrypted = decryptResult.payload;

  const row = await upsertUserOnLogin(
    c.env.DB,
    decrypted.userKey,
    decrypted.name ?? null,
    decrypted.email ?? null,
    decrypted.gender ?? null,
  );
  if (!row) {
    return c.json({ ok: false, error: { code: "DB_WRITE_FAILED", message: "users upsert 실패" } }, 500);
  }

  const jwt = await signAppJwt(row.user_key, decrypted.name ?? null, c.env.JWT_SECRET);
  return c.json({
    ok: true,
    token: jwt,
    user: {
      userKey: row.user_key,
      name: decrypted.name ?? null,
      gender: decrypted.gender ?? null,
    },
  });
});

export default app;
