/**
 * Friend invite store (PR-54 stub).
 *
 * 본 PR 은 client-only stub. 진짜 wire 는 worker `/economy/invite`
 * 라우트 + 1-code-1-redeem 검증 필요.
 *
 * 동작:
 *   - `getOrCreateInviteCode()`: 사용자별 1회 발급. safeStorage 영속.
 *   - `applyInviteCode(code)`: 코드 검증 + 양쪽 grant 의 stub. 클라
 *     localStorage 만 — anti-abuse 우회 가능 (사용자 spec "백엔드
 *     미구현 시 클라 stub + TODO").
 *
 * Grant 정책 (사용자 spec):
 *   - 초대자: 하트 +1, 보석 +5
 *   - 가입자: 씨앗 +10, 보석 +5
 *   - 둘 다 일일 미션 "친구 초대" 클리어
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import { useItemsStore } from "../collection/itemsStore";
import { useFarmStore } from "../collection/farmStore";

const STORAGE_KEY_MY_CODE = "cc.friends.myCode.v1";
const STORAGE_KEY_USED = "cc.friends.usedCode.v1";
const STORAGE_KEY_INVITED_COUNT = "cc.friends.invitedCount.v1";

function generateCode(): string {
  // 6자 영숫자 — 사용자 공유용. crypto.randomUUID 가능하면 prefix.
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().slice(0, 6).toUpperCase();
    }
  } catch {
    /* fall through */
  }
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // O / 0 / I / 1 회피
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

interface InviteState {
  myCode: string;
  usedCode: string | null;
  invitedCount: number;

  applyInviteCode: (code: string) => "ok" | "self" | "already" | "invalid";
  shareIntent: () => string;
  reset: () => void;
}

function loadOrCreateMyCode(): string {
  const stored = safeStorage.get(STORAGE_KEY_MY_CODE);
  if (stored && stored.length >= 4) return stored;
  const fresh = generateCode();
  try {
    safeStorage.set(STORAGE_KEY_MY_CODE, fresh);
  } catch {
    /* ignore */
  }
  return fresh;
}

function loadUsedCode(): string | null {
  return safeStorage.get(STORAGE_KEY_USED);
}

function loadInvitedCount(): number {
  const raw = safeStorage.get(STORAGE_KEY_INVITED_COUNT);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export const useInviteStore = create<InviteState>((set, get) => ({
  myCode: loadOrCreateMyCode(),
  usedCode: loadUsedCode(),
  invitedCount: loadInvitedCount(),

  applyInviteCode: (code) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return "invalid";
    if (trimmed === get().myCode) return "self";
    if (get().usedCode) return "already";
    // Client stub — 코드 검증 (worker /economy/invite) TODO.
    // 우선 형식 검사 (4-12 자 영숫자).
    if (!/^[A-Z0-9]{4,12}$/.test(trimmed)) return "invalid";
    try {
      safeStorage.set(STORAGE_KEY_USED, trimmed);
    } catch {
      /* ignore */
    }
    // PR-109 — 씨앗 +10 → 캔디당근 +2 (+10P) 로 대체. 보석 +5 유지.
    useFarmStore.getState().incCandyCarrots(2);
    useItemsStore.getState().add("gem", 5);
    // 일일 미션 트리거.
    set({ usedCode: trimmed });
    return "ok";
  },

  shareIntent: () => {
    return `버니타임에서 같이 집중해요 🥕\n초대 코드: ${get().myCode}`;
  },

  reset: () => {
    safeStorage.remove(STORAGE_KEY_MY_CODE);
    safeStorage.remove(STORAGE_KEY_USED);
    safeStorage.remove(STORAGE_KEY_INVITED_COUNT);
    set({
      myCode: loadOrCreateMyCode(),
      usedCode: null,
      invitedCount: 0,
    });
  },
}));
