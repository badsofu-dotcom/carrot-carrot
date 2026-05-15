/**
 * Bunny collection server sync adapter — mirrors farmSync.ts / itemsSync.ts.
 *
 * Routes (Worker, JWT-authenticated via Bearer token):
 *   GET  /bunnies/collection
 *     → { bunnies: [{ bunny_id, tier, owned_at }] }
 *   POST /bunnies/draw   { excludeLegendary?: boolean }
 *     → { bunny: { bunny_id, tier, newly_owned } | null }
 *
 * Contract:
 *   - Never throws. `canCallServer()` short-circuits to `noop` when
 *     there's no API base or no JWT (mock/guest/offline).
 *   - The local Zustand store (`collectionStore`) stays the in-tab SoT.
 *     This adapter mirrors the server-side authoritative draw so the
 *     dogam survives across devices once migration 0006 is applied.
 *   - On server failure the call site keeps the optimistic local
 *     `forceUnlock` — UX is never blocked on a network round-trip.
 */

import { apiCall, apiBaseUrl, tokenStore } from "../../lib/api";

export type BunnyTier = "common" | "rare" | "epic" | "legendary";

export interface RemoteBunnyRow {
  bunny_id: string;
  tier: BunnyTier;
  owned_at: number;
}

export interface RemoteBunnyCollection {
  bunnies: RemoteBunnyRow[];
}

export interface RemoteBunnyDrawResult {
  bunny: {
    bunny_id: string;
    tier: BunnyTier;
    newly_owned: boolean;
  } | null;
}

export type BunniesSyncOk =
  | { ok: true; mode: "noop" }
  | { ok: true; mode: "remote"; collection: RemoteBunnyCollection }
  | { ok: true; mode: "remote"; draw: RemoteBunnyDrawResult };
export type BunniesSyncErr = { ok: false; code: string; message: string };
export type BunniesSyncResult = BunniesSyncOk | BunniesSyncErr;

const NOOP_OK: BunniesSyncOk = { ok: true, mode: "noop" };

function canCallServer(): boolean {
  if (!apiBaseUrl()) return false;
  if (!tokenStore.getAccess()) return false;
  return true;
}

export async function loadBunnyCollection(): Promise<BunniesSyncResult> {
  if (!canCallServer()) return NOOP_OK;
  const r = await apiCall<RemoteBunnyCollection>("/bunnies/collection", {
    method: "GET",
  });
  if (!r.ok) {
    return { ok: false, code: r.error.code, message: r.error.message };
  }
  return { ok: true, mode: "remote", collection: r.data };
}

export async function drawBunnyOnServer(
  excludeLegendary: boolean = true,
): Promise<BunniesSyncResult> {
  if (!canCallServer()) return NOOP_OK;
  const r = await apiCall<RemoteBunnyDrawResult>("/bunnies/draw", {
    method: "POST",
    body: { excludeLegendary },
  });
  if (!r.ok) {
    return { ok: false, code: r.error.code, message: r.error.message };
  }
  return { ok: true, mode: "remote", draw: r.data };
}
