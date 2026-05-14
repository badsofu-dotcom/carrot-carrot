/**
 * Offline-first 큐 (Phase 3 골격, Phase 4 가 사용).
 *
 * - 세션 완료/중단 등 mutation 을 즉시 서버에 보내고, 실패하면
 *   localStorage(safeStorage) 에 쌓아 두었다가 다음 부팅 때 flush 시도.
 * - 모든 동작은 throw-free. 실패해도 UI 동작 유지.
 */

import { safeStorage } from "./safeStorage";
import { apiCallWithRefresh } from "./api";

const QUEUE_KEY = "cc.queue.v1";

export interface QueuedMutation {
  id: string;             // uuid
  path: string;           // e.g. '/session-complete'
  body: unknown;
  enqueuedAt: number;
}

function load(): QueuedMutation[] {
  const raw = safeStorage.get(QUEUE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function save(q: QueuedMutation[]) {
  try {
    safeStorage.set(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* ignore */
    }
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function enqueue(path: string, body: unknown): string {
  const id = uuid();
  const q = load();
  q.push({ id, path, body, enqueuedAt: Date.now() });
  save(q);
  return id;
}

/**
 * 큐를 순서대로 보내본다. 실패한 항목은 큐에 남긴다.
 * 결과로 처리한 개수 / 남은 개수를 돌려준다.
 */
export async function flushQueue(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const q = load();
  if (q.length === 0) return { flushed: 0, remaining: 0 };

  const remaining: QueuedMutation[] = [];
  let flushed = 0;
  for (const item of q) {
    const res = await apiCallWithRefresh(item.path, {
      method: "POST",
      body: item.body,
    });
    if (res.ok) {
      flushed += 1;
    } else {
      // 4xx 인증/입력 실패는 영구 실패로 보고 버린다 (status 400~499)
      const st = res.error.status ?? 0;
      const permanent = st >= 400 && st < 500 && st !== 401 && st !== 408;
      if (!permanent) remaining.push(item);
    }
  }
  save(remaining);
  return { flushed, remaining: remaining.length };
}

export function queueSize(): number {
  return load().length;
}

/**
 * mutation 을 즉시 시도하고, 실패 시 큐에 넣는다.
 * Phase 4 에서 useFocusTimer 류가 호출.
 */
export async function sendOrQueue(
  path: string,
  body: unknown,
): Promise<{ sentImmediately: boolean }> {
  const res = await apiCallWithRefresh(path, { method: "POST", body });
  if (res.ok) return { sentImmediately: true };
  enqueue(path, body);
  return { sentImmediately: false };
}
