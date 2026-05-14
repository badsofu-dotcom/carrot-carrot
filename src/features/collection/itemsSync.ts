/**
 * Items server sync adapter — Cloudflare Worker (carrot-carrot-api) backed.
 *
 * Mirrors farmSync.ts: never throws, returns a discriminated Result, and
 * goes "noop" when there's no API base or no JWT (mock/guest/offline).
 *
 * Routes (Worker, JWT-authenticated via Bearer token):
 *   GET  /items/inventory       → { items: [{code, count}] }
 *   POST /items/use {code, nonce?} → { item: {code, count} }
 *
 * The local zustand store stays the in-tab SoT; this adapter mirrors
 * mutations to the server so the inventory persists across sessions
 * once migration 0006 is applied. Server failures fall through silently
 * — itemsStore keeps the optimistic count.
 */

import { apiCall, apiBaseUrl, tokenStore } from "../../lib/api";
import type { ItemCode } from "./itemsStore";

export interface RemoteItemRow {
  code: string;
  count: number;
}
export interface RemoteInventory {
  items: RemoteItemRow[];
}

export type ItemsSyncOk =
  | { ok: true; mode: "noop" }
  | { ok: true; mode: "remote"; inventory: RemoteInventory }
  | { ok: true; mode: "remote"; item: RemoteItemRow };
export type ItemsSyncErr = { ok: false; code: string; message: string };
export type ItemsSyncResult = ItemsSyncOk | ItemsSyncErr;

const NOOP_OK: ItemsSyncOk = { ok: true, mode: "noop" };

function canCallServer(): boolean {
  if (!apiBaseUrl()) return false;
  if (!tokenStore.getAccess()) return false;
  return true;
}

/**
 * Convert sparse server rows into the dense `Record<ItemCode, number>`
 * shape the store uses. Unknown codes from the server are ignored — the
 * worker may eventually carry extra rows that the client doesn't render.
 */
export function countsFromRemote(
  inv: RemoteInventory,
  known: readonly ItemCode[],
): Partial<Record<ItemCode, number>> {
  const out: Partial<Record<ItemCode, number>> = {};
  const allow = new Set<string>(known);
  for (const row of inv.items) {
    if (
      typeof row.code === "string" &&
      allow.has(row.code) &&
      Number.isInteger(row.count) &&
      row.count >= 0
    ) {
      out[row.code as ItemCode] = row.count;
    }
  }
  return out;
}

export async function loadInventory(): Promise<ItemsSyncResult> {
  if (!canCallServer()) return NOOP_OK;
  const r = await apiCall<RemoteInventory>("/items/inventory", {
    method: "GET",
  });
  if (!r.ok) {
    return { ok: false, code: r.error.code, message: r.error.message };
  }
  return { ok: true, mode: "remote", inventory: r.data };
}

export async function useItemOnServer(
  code: ItemCode,
  nonce?: string,
): Promise<ItemsSyncResult> {
  if (!canCallServer()) return NOOP_OK;
  const body: { code: string; nonce?: string } = { code };
  if (nonce) body.nonce = nonce;
  const r = await apiCall<{ item: RemoteItemRow }>("/items/use", {
    method: "POST",
    body,
  });
  if (!r.ok) {
    return { ok: false, code: r.error.code, message: r.error.message };
  }
  return { ok: true, mode: "remote", item: r.data.item };
}
