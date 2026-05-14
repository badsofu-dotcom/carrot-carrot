import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";
import {
  addSeeds,
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
  return c.json({ ok: true, plots: state.plots, carrots: state.carrots, seeds: state.seeds });
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
  return c.json({ ok: true, plots: state.plots, carrots: state.carrots, seeds: state.seeds });
});

app.post("/grow", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  // Body: { steps?: 1|2|3, seedDelta?: 0|1|2|3 }. Both default to safe
  // values so older clients keep working. Tier rules live in the client
  // (src/lib/farmRules.ts); the worker just respects the numbers it
  // gets and clamps them. seeds persistence requires migration 0004 —
  // `addSeeds` silently no-ops if the column is missing.
  let body: { steps?: unknown; seedDelta?: unknown } = {};
  try {
    body = (await c.req.json()) as { steps?: unknown; seedDelta?: unknown };
  } catch {
    /* empty body is fine */
  }
  const rawSteps = Number(body.steps);
  const steps =
    Number.isFinite(rawSteps) && rawSteps >= 1 && rawSteps <= 3
      ? Math.floor(rawSteps)
      : 1;
  const rawSeed = Number(body.seedDelta);
  const seedDelta =
    Number.isFinite(rawSeed) && rawSeed >= 0 && rawSeed <= 3
      ? Math.floor(rawSeed)
      : 0;
  for (let i = 0; i < steps; i++) {
    await growAllPlots(c.env.DB, sub);
  }
  if (seedDelta > 0) {
    await addSeeds(c.env.DB, sub, seedDelta);
  }
  const state = await getFarmState(c.env.DB, sub);
  return c.json({
    ok: true,
    plots: state.plots,
    carrots: state.carrots,
    seeds: state.seeds,
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
  return c.json({ ok: true, plots: state.plots, carrots: state.carrots, seeds: state.seeds });
});

export default app;
