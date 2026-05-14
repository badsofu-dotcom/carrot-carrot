import { Hono } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";
import {
  getCarrotCount,
  getFarmState,
  getFocusStats,
  getUnlockedSounds,
  getUser,
} from "../lib/db.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const token = bearerToken(c.req.raw);
  if (!token) {
    return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "missing bearer" } }, 401);
  }
  const claims = await verifyAppJwt(token, c.env.JWT_SECRET);
  if (!claims) {
    return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "invalid token" } }, 401);
  }

  const [user, focusStats, carrots, unlockedSounds, farm] = await Promise.all([
    getUser(c.env.DB, claims.sub),
    getFocusStats(c.env.DB, claims.sub),
    getCarrotCount(c.env.DB, claims.sub),
    getUnlockedSounds(c.env.DB, claims.sub),
    getFarmState(c.env.DB, claims.sub),
  ]);
  if (!user) {
    return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "user not found" } }, 401);
  }

  return c.json({
    ok: true,
    userKey: user.user_key,
    name: user.name_encrypted ?? claims.name ?? null,
    focusStats,
    carrots,
    unlockedSounds,
    farm: { plots: farm.plots, carrots: farm.carrots },
  });
});

export default app;
