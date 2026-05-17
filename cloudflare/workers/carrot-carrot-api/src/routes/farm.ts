import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";
// PR-117 — addSeeds 제거 (씨앗 자원 폐기).
import {
  getFarmState,
  growAllPlots,
  harvestPlot,
  plantPlot,
} from "../lib/db.js";

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

async function requireUser(c: AppContext): Promise<string | Response> {
  const token = bearerToken(c.req.raw);
  if (!token) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "missing bearer" } },
      401,
    );
  }
  const claims = await verifyAppJwt(token, c.env.JWT_SECRET);
  if (!claims) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "invalid token" } },
      401,
    );
  }
  return claims.sub;
}

app.get("/state", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  const state = await getFarmState(c.env.DB, sub);
  return c.json({ ok: true, plots: state.plots, carrots: state.carrots });
});

app.post("/plant", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  let body: { slotIndex?: unknown } = {};
  try {
    body = (await c.req.json()) as { slotIndex?: unknown };
  } catch {
    /* tolerate empty body */
  }
  const slotIndex = Number(body.slotIndex);
  const res = await plantPlot(c.env.DB, sub, slotIndex);
  if (!res.ok) {
    return c.json(
      {
        ok: false,
        error: {
          code: res.reason === "invalid" ? "BAD_REQUEST" : "PLOT_OCCUPIED",
          message: res.reason ?? "plant failed",
        },
      },
      res.reason === "invalid" ? 400 : 409,
    );
  }
  const state = await getFarmState(c.env.DB, sub);
  return c.json({ ok: true, plots: state.plots, carrots: state.carrots });
});

app.post("/grow", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  // PR-117 — seedDelta param 제거 (씨앗 자원 폐기, 클라 PR-109). Body
  // 의 seedDelta 가 와도 무시 (구 클라 호환).
  let body: { steps?: unknown } = {};
  try {
    body = (await c.req.json()) as { steps?: unknown };
  } catch {
    /* empty body is fine */
  }
  const rawSteps = Number(body.steps);
  const steps =
    Number.isFinite(rawSteps) && rawSteps >= 1 && rawSteps <= 3
      ? Math.floor(rawSteps)
      : 1;
  for (let i = 0; i < steps; i++) {
    await growAllPlots(c.env.DB, sub);
  }
  const state = await getFarmState(c.env.DB, sub);
  return c.json({
    ok: true,
    plots: state.plots,
    carrots: state.carrots,
  });
});

app.post("/harvest", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  let body: { slotIndex?: unknown } = {};
  try {
    body = (await c.req.json()) as { slotIndex?: unknown };
  } catch {
    /* tolerate empty body */
  }
  const slotIndex = Number(body.slotIndex);
  const res = await harvestPlot(c.env.DB, sub, slotIndex);
  if (!res.ok) {
    return c.json(
      {
        ok: false,
        error: {
          code: res.reason === "invalid" ? "BAD_REQUEST" : "PLOT_NOT_READY",
          message: res.reason ?? "harvest failed",
        },
      },
      res.reason === "invalid" ? 400 : 409,
    );
  }
  const state = await getFarmState(c.env.DB, sub);
  return c.json({ ok: true, plots: state.plots, carrots: state.carrots });
});

export default app;
