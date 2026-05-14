import { Hono } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";
import { deleteUserCascade } from "../lib/db.js";

const app = new Hono<{ Bindings: Env }>();

// 토스 콘솔에서 등록한 unlink callback URL.
// 호출 형태:
//   1) Apps in Toss 가 callback 으로 호출: 헤더에 토스 서명 포함, body 에 userKey.
//      (현재는 Bearer JWT 도 허용 — 운영 모니터링용 / 자체 테스트용)
//   2) 클라이언트가 본인 계정 탈퇴: Authorization Bearer <jwt>.
app.post("/", async (c) => {
  let userKey: string | null = null;

  const tok = bearerToken(c.req.raw);
  if (tok) {
    const claims = await verifyAppJwt(tok, c.env.JWT_SECRET);
    if (claims) userKey = claims.sub;
  }

  if (!userKey) {
    try {
      const body = (await c.req.json<{ userKey?: string }>()) ?? {};
      if (typeof body.userKey === "string" && body.userKey.length > 0) {
        userKey = body.userKey;
      }
    } catch {
      // ignore
    }
  }

  if (!userKey) {
    return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "userKey 누락" } }, 400);
  }

  const okDel = await deleteUserCascade(c.env.DB, userKey);
  if (!okDel) {
    return c.json({ ok: false, error: { code: "DB_WRITE_FAILED", message: "탈퇴 처리 실패" } }, 500);
  }
  return c.json({ ok: true });
});

export default app;
