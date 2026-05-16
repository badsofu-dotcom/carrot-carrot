/**
 * Boxes routes — daily gift + weekly treasure chest.
 *
 * Tables (migration 0006):
 *   gift_box_state(user_key, last_claim_ymd, total_claims)
 *   treasure_box_state(user_key, progress, opens)
 *
 * Routes:
 *   POST /boxes/gift/open                  → rolls DAILY_GIFT_TABLE
 *                                              if not yet claimed today
 *   GET  /boxes/treasure/state             → { progress, opens }
 *   POST /boxes/treasure/open              → rolls WEEKLY_TREASURE_TABLE
 *                                              when progress >= 7
 *
 * The drop tables live in `src/lib/rewardTables.ts` on the frontend.
 * The worker duplicates the probability/EV table inline below so the
 * server can compute reward outcomes without a shared package
 * dependency. Keep this table in sync when the frontend's
 * `DAILY_GIFT_TABLE` / `WEEKLY_TREASURE_TABLE` change.
 */
import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";

type AppContext = Context<{ Bindings: Env }>;
const app = new Hono<{ Bindings: Env }>();

async function requireUser(c: AppContext): Promise<string | Response> {
  const token = bearerToken(c.req.raw);
  if (!token) return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "missing bearer" } }, 401);
  const claims = await verifyAppJwt(token, c.env.JWT_SECRET);
  if (!claims) return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "bad token" } }, 401);
  return claims.sub;
}

function kstYmd(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

interface Entry { p: number; kind: string; amount: number; }
// PR-17c — aligned with src/lib/giftRoll.ts and src/lib/rewardTables.ts
// DAILY_GIFT_TABLE. EV 2.0 P (gem and seed contribute 0 P; candy 5,
// golden 10 → 0.24*5 + 0.08*10 = 2.0).
const DAILY: readonly Entry[] = [
  { p: 0.6, kind: "seed", amount: 1 },
  { p: 0.24, kind: "candy", amount: 1 },
  { p: 0.08, kind: "golden", amount: 1 },
  { p: 0.06, kind: "seed", amount: 3 },
  { p: 0.02, kind: "gem", amount: 1 },
];
const WEEKLY: readonly Entry[] = [
  { p: 0.25, kind: "candy", amount: 2 },
  { p: 0.2, kind: "golden", amount: 1 },
  { p: 0.2, kind: "carrot", amount: 5 },
  { p: 0.15, kind: "seed", amount: 3 },
  { p: 0.15, kind: "star", amount: 3 },
  { p: 0.05, kind: "golden", amount: 3 },
];

function roll(table: readonly Entry[]): Entry {
  const r = Math.random();
  let acc = 0;
  for (const e of table) {
    acc += e.p;
    if (r < acc) return e;
  }
  return table[table.length - 1]!;
}

app.post("/gift/open", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  const today = kstYmd();
  try {
    const cur = await c.env.DB
      .prepare(`SELECT last_claim_ymd FROM gift_box_state WHERE user_key = ?`)
      .bind(sub)
      .first<{ last_claim_ymd: string | null }>();
    if (cur?.last_claim_ymd === today) {
      return c.json(
        { ok: false, error: { code: "ALREADY_CLAIMED", message: "already opened today" } },
        409,
      );
    }
    await c.env.DB
      .prepare(
        `INSERT INTO gift_box_state (user_key, last_claim_ymd, total_claims, updated_at)
         VALUES (?, ?, 1, unixepoch())
         ON CONFLICT(user_key) DO UPDATE SET
           last_claim_ymd = ?,
           total_claims = gift_box_state.total_claims + 1,
           updated_at = unixepoch()`,
      )
      .bind(sub, today, today)
      .run();
  } catch {
    return c.json({ ok: false, error: { code: "SCHEMA_NOT_READY", message: "apply 0006" } }, 409);
  }
  const reward = roll(DAILY);
  return c.json({ ok: true, reward });
});

app.get("/treasure/state", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  try {
    const cur = await c.env.DB
      .prepare(`SELECT progress, opens FROM treasure_box_state WHERE user_key = ?`)
      .bind(sub)
      .first<{ progress: number; opens: number }>();
    return c.json({
      ok: true,
      progress: cur?.progress ?? 0,
      opens: cur?.opens ?? 0,
      needed: 7,
    });
  } catch {
    return c.json({ ok: false, error: { code: "SCHEMA_NOT_READY", message: "apply 0006" } }, 409);
  }
});

app.post("/treasure/open", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  try {
    const cur = await c.env.DB
      .prepare(`SELECT progress, opens FROM treasure_box_state WHERE user_key = ?`)
      .bind(sub)
      .first<{ progress: number; opens: number }>();
    if (!cur || cur.progress < 7) {
      return c.json(
        { ok: false, error: { code: "NOT_READY", message: "need 7 progress" } },
        409,
      );
    }
    await c.env.DB
      .prepare(
        `UPDATE treasure_box_state
         SET progress = progress - 7, opens = opens + 1, updated_at = unixepoch()
         WHERE user_key = ?`,
      )
      .bind(sub)
      .run();
  } catch {
    return c.json({ ok: false, error: { code: "SCHEMA_NOT_READY", message: "apply 0006" } }, 409);
  }
  const reward = roll(WEEKLY);
  return c.json({ ok: true, reward });
});

export default app;
