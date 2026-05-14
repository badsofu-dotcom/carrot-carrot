/**
 * Farm server sync adapter — Cloudflare Worker (carrot-carrot-api) backed.
 *
 * Routes (Worker, JWT-authenticated via Bearer token):
 *   GET  /farm/state              → { plots: [{slotIndex, stage}], carrots }
 *   POST /farm/plant   {slotIndex} → same shape (full state after mutation)
 *   POST /farm/grow                → same shape (grows all 1-3 plots by 1)
 *   POST /farm/harvest {slotIndex} → same shape (+1 carrot on success)
 *
 * Contract:
 *   - Every method returns a Result. Mode is "remote" when the API was used,
 *     "noop" when there is no API base / no auth token (mock/guest/offline).
 *   - Errors never throw. Callers stay session-only on `ok:false`.
 *   - The store is the SoT for the in-tab UX; server is the SoT across
 *     sessions. After successful mutations the server returns the canonical
 *     state which the caller MAY reconcile with via `stages` payload.
 *
 * Auth fallback:
 *   - No `VITE_APPS_IN_TOSS_PROXY_URL`  → noop (e.g. local Vite preview).
 *   - No JWT in tokenStore               → noop (guest mode — local-only).
 *   In both cases the store keeps optimistic state and never crashes.
 */

import { apiCall, apiBaseUrl, tokenStore } from "../../lib/api";

export interface RemotePlot {
  slotIndex: number;
  stage: number;
}
export interface RemoteFarmState {
  plots: RemotePlot[];
  carrots: number;
  /** Bonus seeds (focus-tier rewards). Optional for back-compat with pre-0004 workers. */
  seeds?: number;
}

export type FarmSyncOk =
  | { ok: true; mode: "noop" }
  | { ok: true; mode: "remote"; state: RemoteFarmState };
export type FarmSyncErr = { ok: false; code: string; message: string };
export type FarmSyncResult = FarmSyncOk | FarmSyncErr;

const NOOP_OK: FarmSyncOk = { ok: true, mode: "noop" };

function canCallServer(): boolean {
  if (!apiBaseUrl()) return false;
  if (!tokenStore.getAccess()) return false;
  return true;
}

/**
 * Convert sparse server plots (only non-empty rows are stored) into the
 * fixed-length 9-slot stages[] array the store uses.
 */
export function stagesFromRemote(remote: RemoteFarmState): number[] {
  const stages = new Array(9).fill(0);
  for (const p of remote.plots) {
    if (
      Number.isInteger(p.slotIndex) &&
      p.slotIndex >= 0 &&
      p.slotIndex < 9 &&
      Number.isInteger(p.stage) &&
      p.stage >= 0 &&
      p.stage <= 4
    ) {
      stages[p.slotIndex] = p.stage;
    }
  }
  return stages;
}

export async function loadFarmState(): Promise<FarmSyncResult> {
  if (!canCallServer()) return NOOP_OK;
  const r = await apiCall<RemoteFarmState>("/farm/state", { method: "GET" });
  if (!r.ok) {
    return { ok: false, code: r.error.code, message: r.error.message };
  }
  return { ok: true, mode: "remote", state: r.data };
}

export async function plantOnServer(slotIndex: number): Promise<FarmSyncResult> {
  if (!canCallServer()) return NOOP_OK;
  const r = await apiCall<RemoteFarmState>("/farm/plant", {
    method: "POST",
    body: { slotIndex },
  });
  if (!r.ok) {
    return { ok: false, code: r.error.code, message: r.error.message };
  }
  return { ok: true, mode: "remote", state: r.data };
}

export async function harvestOnServer(
  slotIndex: number,
): Promise<FarmSyncResult> {
  if (!canCallServer()) return NOOP_OK;
  const r = await apiCall<RemoteFarmState>("/farm/harvest", {
    method: "POST",
    body: { slotIndex },
  });
  if (!r.ok) {
    return { ok: false, code: r.error.code, message: r.error.message };
  }
  return { ok: true, mode: "remote", state: r.data };
}

/**
 * Persist focus-driven growth. `growthSnapshotId` is informational only —
 * the store dedupes by snapshot before calling. `steps` is the tier
 * count returned by `getFocusFarmReward()` (1..3); the worker clamps
 * to [1,3] regardless.
 */
export async function growOnServer(
  steps: number,
  _growthSnapshotId: number | null,
  seedDelta: number = 0,
): Promise<FarmSyncResult> {
  if (!canCallServer()) return NOOP_OK;
  const safeSteps =
    Number.isFinite(steps) && steps >= 1 && steps <= 3
      ? Math.floor(steps)
      : 1;
  const safeSeed =
    Number.isFinite(seedDelta) && seedDelta >= 0 && seedDelta <= 3
      ? Math.floor(seedDelta)
      : 0;
  const r = await apiCall<RemoteFarmState>("/farm/grow", {
    method: "POST",
    body: { steps: safeSteps, seedDelta: safeSeed },
  });
  if (!r.ok) {
    return { ok: false, code: r.error.code, message: r.error.message };
  }
  return { ok: true, mode: "remote", state: r.data };
}

/**
 * Pull initial farm state from /me bundle if present. Kept for compatibility
 * with auth init flow — falls back to /farm/state when /me lacks `farm`.
 */
export async function loadFarmFromMe(): Promise<FarmSyncResult> {
  if (!canCallServer()) return NOOP_OK;
  const r = await apiCall<{ farm?: RemoteFarmState }>("/me", { method: "GET" });
  if (r.ok && r.data?.farm) {
    return { ok: true, mode: "remote", state: r.data.farm };
  }
  return loadFarmState();
}
