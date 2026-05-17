import type { UserRow } from "../types.js";

export async function upsertUserOnLogin(
  db: D1Database,
  userKey: string,
  name: string | null,
  email: string | null,
  gender: string | null,
): Promise<UserRow | null> {
  try {
    await db
      .prepare(
        `INSERT INTO users (user_key, name_encrypted, email_encrypted, gender, created_at, last_login_at)
         VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
         ON CONFLICT(user_key) DO UPDATE SET
           name_encrypted = COALESCE(excluded.name_encrypted, users.name_encrypted),
           email_encrypted = COALESCE(excluded.email_encrypted, users.email_encrypted),
           gender = COALESCE(excluded.gender, users.gender),
           last_login_at = unixepoch()`,
      )
      .bind(userKey, name, email, gender)
      .run();
    return await getUser(db, userKey);
  } catch {
    return null;
  }
}

export async function getUser(
  db: D1Database,
  userKey: string,
): Promise<UserRow | null> {
  const row = await db
    .prepare(
      `SELECT user_key, name_encrypted, email_encrypted, gender, created_at, last_login_at
       FROM users WHERE user_key = ?`,
    )
    .bind(userKey)
    .first<UserRow>();
  return row ?? null;
}

export interface FocusStats {
  totalSessions: number;
  totalCarrots: number;
  totalFocusMinutes: number;
  longestFocusMinutes: number;
}

export async function getFocusStats(
  db: D1Database,
  userKey: string,
): Promise<FocusStats> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS totalSessions,
         COALESCE(SUM(carrots_earned), 0) AS totalCarrots,
         COALESCE(SUM(CASE WHEN status='completed' THEN duration_seconds ELSE 0 END), 0) AS totalFocusSeconds,
         COALESCE(MAX(CASE WHEN status='completed' THEN duration_seconds ELSE 0 END), 0) AS longestFocusSeconds
       FROM focus_sessions WHERE user_key = ?`,
    )
    .bind(userKey)
    .first<{
      totalSessions: number;
      totalCarrots: number;
      totalFocusSeconds: number;
      longestFocusSeconds: number;
    }>();
  if (!row) {
    return { totalSessions: 0, totalCarrots: 0, totalFocusMinutes: 0, longestFocusMinutes: 0 };
  }
  return {
    totalSessions: row.totalSessions,
    totalCarrots: row.totalCarrots,
    totalFocusMinutes: Math.round((row.totalFocusSeconds ?? 0) / 60),
    longestFocusMinutes: Math.round((row.longestFocusSeconds ?? 0) / 60),
  };
}

export async function getCarrotCount(
  db: D1Database,
  userKey: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(count), 0) AS total
       FROM carrot_collection WHERE user_key = ?`,
    )
    .bind(userKey)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export async function getUnlockedSounds(
  db: D1Database,
  userKey: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT sound_id FROM unlocked_sounds WHERE user_key = ? ORDER BY unlocked_at ASC`,
    )
    .bind(userKey)
    .all<{ sound_id: string }>();
  return (results ?? []).map((r) => r.sound_id);
}

export async function deleteUserCascade(
  db: D1Database,
  userKey: string,
): Promise<boolean> {
  try {
    await db.batch([
      db.prepare(`DELETE FROM unlocked_sounds WHERE user_key = ?`).bind(userKey),
      db.prepare(`DELETE FROM carrot_collection WHERE user_key = ?`).bind(userKey),
      db.prepare(`DELETE FROM focus_sessions WHERE user_key = ?`).bind(userKey),
      db.prepare(`DELETE FROM farm_plots WHERE user_key = ?`).bind(userKey),
      db.prepare(`DELETE FROM farm_inventory WHERE user_key = ?`).bind(userKey),
      db.prepare(`DELETE FROM users WHERE user_key = ?`).bind(userKey),
    ]);
    return true;
  } catch {
    return false;
  }
}

export interface FarmPlotRow {
  slotIndex: number;
  stage: number;
}

export interface FarmState {
  plots: FarmPlotRow[];
  carrots: number;
}

// PR-117 — 씨앗 자원 폐기 (client PR-109 후속). seeds 필드 + addSeeds
// helper 제거. migration 0008 이 farm_inventory.seeds 컬럼 drop.
export async function getFarmState(
  db: D1Database,
  userKey: string,
): Promise<FarmState> {
  const [plotsRes, invRes] = await Promise.all([
    db
      .prepare(
        `SELECT slot_index AS slotIndex, stage FROM farm_plots
         WHERE user_key = ? ORDER BY slot_index ASC`,
      )
      .bind(userKey)
      .all<FarmPlotRow>(),
    db
      .prepare(`SELECT carrots FROM farm_inventory WHERE user_key = ?`)
      .bind(userKey)
      .first<{ carrots: number }>(),
  ]);
  return {
    plots: plotsRes.results ?? [],
    carrots: invRes?.carrots ?? 0,
  };
}

export async function plantPlot(
  db: D1Database,
  userKey: string,
  slotIndex: number,
): Promise<{ ok: boolean; reason?: "occupied" | "invalid" }> {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) {
    return { ok: false, reason: "invalid" };
  }
  // Only insert when slot is empty (no row) or stage = 0. Use INSERT
  // ... ON CONFLICT DO UPDATE WHERE stage = 0 to atomically guard.
  const res = await db
    .prepare(
      `INSERT INTO farm_plots (user_key, slot_index, stage, updated_at)
       VALUES (?, ?, 1, unixepoch())
       ON CONFLICT(user_key, slot_index) DO UPDATE SET
         stage = 1,
         updated_at = unixepoch()
       WHERE farm_plots.stage = 0`,
    )
    .bind(userKey, slotIndex)
    .run();
  // D1 returns meta.changes when row is updated; we accept any successful run
  // here because the insert path also counts. If conflict-update was filtered
  // by stage != 0, no row was affected — treat as occupied.
  const changes = res.meta?.changes ?? 0;
  if (changes === 0) return { ok: false, reason: "occupied" };
  return { ok: true };
}

export async function growAllPlots(
  db: D1Database,
  userKey: string,
): Promise<number> {
  const res = await db
    .prepare(
      `UPDATE farm_plots
       SET stage = MIN(stage + 1, 4),
           updated_at = unixepoch()
       WHERE user_key = ? AND stage BETWEEN 1 AND 3`,
    )
    .bind(userKey)
    .run();
  return res.meta?.changes ?? 0;
}

export async function harvestPlot(
  db: D1Database,
  userKey: string,
  slotIndex: number,
): Promise<{ ok: boolean; carrots?: number; reason?: "not_ready" | "invalid" }> {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) {
    return { ok: false, reason: "invalid" };
  }
  const row = await db
    .prepare(`SELECT stage FROM farm_plots WHERE user_key = ? AND slot_index = ?`)
    .bind(userKey, slotIndex)
    .first<{ stage: number }>();
  if (!row || row.stage < 4) return { ok: false, reason: "not_ready" };

  // Single-batch: reset slot, bump inventory, return updated carrots.
  await db.batch([
    db
      .prepare(
        `UPDATE farm_plots SET stage = 0, updated_at = unixepoch()
         WHERE user_key = ? AND slot_index = ?`,
      )
      .bind(userKey, slotIndex),
    db
      .prepare(
        `INSERT INTO farm_inventory (user_key, carrots, updated_at)
         VALUES (?, 1, unixepoch())
         ON CONFLICT(user_key) DO UPDATE SET
           carrots = farm_inventory.carrots + 1,
           updated_at = unixepoch()`,
      )
      .bind(userKey),
  ]);
  const inv = await db
    .prepare(`SELECT carrots FROM farm_inventory WHERE user_key = ?`)
    .bind(userKey)
    .first<{ carrots: number }>();
  return { ok: true, carrots: inv?.carrots ?? 1 };
}
