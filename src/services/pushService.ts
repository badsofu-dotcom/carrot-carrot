/**
 * App-in-Toss 푸시 토큰 등록 스캐폴드 — Phase 7.
 *
 * 설계 원칙:
 *   - SDK export 가 환경마다 다를 수 있어 dynamic import + feature detection.
 *     실제 토스 WebView 가 아니거나 SDK 가 없으면 'mock' 상태로 폴백.
 *   - 모든 함수는 throw 하지 않는다 — 항상 PushSnapshot 반환.
 *   - 권한/토큰 발급 실패해도 앱은 절대 깨지지 않게 한다.
 *   - 권한 상태와 enabled 토글을 safeStorage 에 저장.
 *
 * 흐름:
 *   1) requestPermission() — 토스 SDK 의 push permission 요청.
 *   2) registerPushToken() — token 발급 + /push-register 로 서버 upsert.
 *   3) unregisterPushToken() — 서버에 enabled=false 로 갱신, 로컬 토글 off.
 *   4) getPushSnapshot() — 현재 상태 (UI 가 polling 또는 호출 후 sync).
 */

import { apiCallWithRefresh } from "../lib/api";
import { safeStorage } from "../lib/safeStorage";

export type PushStatus =
  | "idle" // 아직 시도 안 함
  | "ready" // 권한 + 토큰 둘 다 OK
  | "permission_denied" // OS/토스에서 거부
  | "no_sdk" // 일반 브라우저 / SDK 없음 → mock
  | "error"; // 토큰 발급 실패

export interface PushSnapshot {
  enabled: boolean;
  status: PushStatus;
  /** 사용자에게 보여줄 한국어 라벨. */
  hint: string;
  /** 매일 22시 리마인더 카피. UI 가 항상 이 문구를 표시. */
  reminderText: string;
  /** 디버그용 — 마지막 토큰 (앞 8자만). */
  tokenPreview?: string;
}

const ENABLED_KEY = "cc.push.enabled";
const TOKEN_KEY = "cc.push.token";
const DEVICE_KEY = "cc.push.device";

const REMINDER_TEXT = "오늘 집중 안했어? 토끼가 울고있어 😢";

function readEnabled(): boolean {
  return safeStorage.get(ENABLED_KEY) === "1";
}
function writeEnabled(v: boolean) {
  safeStorage.set(ENABLED_KEY, v ? "1" : "0");
}
function readToken(): string | null {
  return safeStorage.get(TOKEN_KEY);
}
function writeToken(t: string | null) {
  if (t) safeStorage.set(TOKEN_KEY, t);
  else safeStorage.remove(TOKEN_KEY);
}
function readDeviceId(): string {
  let id = safeStorage.get(DEVICE_KEY);
  if (!id) {
    id = `web-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    safeStorage.set(DEVICE_KEY, id);
  }
  return id;
}

function statusHint(status: PushStatus, enabled: boolean): string {
  if (status === "ready") return enabled ? "준비됨 — 매일 22시" : "꺼짐";
  if (status === "permission_denied") return "권한 필요 — 설정에서 알림 허용";
  if (status === "no_sdk") return "토스 앱 안에서만 알림이 동작해";
  if (status === "error") return "오류 — 다음에 다시 시도해 줘";
  return enabled ? "대기 중..." : "꺼짐";
}

function snapshot(status: PushStatus, enabled: boolean, token?: string | null): PushSnapshot {
  return {
    enabled,
    status,
    hint: statusHint(status, enabled),
    reminderText: REMINDER_TEXT,
    tokenPreview: token ? token.slice(0, 8) + "…" : undefined,
  };
}

/* ------------------------- SDK 어댑터 ------------------------- */

interface PermissionResult {
  granted: boolean;
}
interface TokenResult {
  token?: string;
}

interface MaybePushModule {
  requestPushPermission?: (opts?: Record<string, unknown>) => Promise<PermissionResult>;
  getPushPermission?: () => Promise<PermissionResult>;
  getPushToken?: () => Promise<TokenResult>;
  registerPushToken?: () => Promise<TokenResult>;
}

async function loadSdk(): Promise<MaybePushModule | null> {
  if (typeof window === "undefined") return null;
  try {
    const ua = navigator.userAgent || "";
    const inToss = /toss/i.test(ua) || Boolean((window as unknown as { TossApps?: unknown }).TossApps);
    if (!inToss) return null;
    const mod = (await import("@apps-in-toss/web-framework").catch(() => null)) as MaybePushModule | null;
    return mod;
  } catch {
    return null;
  }
}

/* ------------------------- public API ------------------------- */

/**
 * 권한만 요청 — 토큰은 받지 않음. UI 가 두 단계로 나눠 부르고 싶을 때.
 * 일반 브라우저면 status 'no_sdk' 로 즉시 리턴.
 */
export async function requestPushPermission(): Promise<PushSnapshot> {
  const enabled = readEnabled();
  const sdk = await loadSdk();
  if (!sdk || typeof sdk.requestPushPermission !== "function") {
    return snapshot("no_sdk", enabled, readToken());
  }
  try {
    const r = await sdk.requestPushPermission({});
    if (!r?.granted) return snapshot("permission_denied", enabled, readToken());
    return snapshot("ready", enabled, readToken());
  } catch {
    return snapshot("error", enabled, readToken());
  }
}

/**
 * 토글 켜기 — 권한 요청 → 토큰 발급 → 서버 등록 → enabled=true.
 * 어떤 단계가 실패해도 앱은 정상. 상태만 적절히 반환.
 */
export async function enablePush(): Promise<PushSnapshot> {
  writeEnabled(true);
  const sdk = await loadSdk();

  if (!sdk) {
    // 일반 브라우저 — mock 으로 토글만 켜둔 상태.
    return snapshot("no_sdk", true, readToken());
  }

  // 1) 권한
  let granted = false;
  try {
    if (typeof sdk.requestPushPermission === "function") {
      const r = await sdk.requestPushPermission({});
      granted = Boolean(r?.granted);
    } else if (typeof sdk.getPushPermission === "function") {
      const r = await sdk.getPushPermission();
      granted = Boolean(r?.granted);
    } else {
      // 어떤 권한 API 도 없음 — 'no_sdk' 처리
      return snapshot("no_sdk", true, readToken());
    }
  } catch {
    return snapshot("error", true, readToken());
  }
  if (!granted) {
    writeEnabled(false);
    return snapshot("permission_denied", false, readToken());
  }

  // 2) 토큰
  let token: string | undefined;
  try {
    const fn = sdk.getPushToken ?? sdk.registerPushToken;
    if (typeof fn === "function") {
      const r = await fn.call(sdk);
      token = r?.token;
    }
  } catch {
    return snapshot("error", true, readToken());
  }
  if (!token) {
    return snapshot("error", true, readToken());
  }
  writeToken(token);

  // 3) 서버 등록 — 실패해도 로컬 상태는 유지.
  await apiCallWithRefresh("/push-register", {
    method: "POST",
    body: {
      deviceId: readDeviceId(),
      pushToken: token,
      platform: "web",
      enabled: true,
    },
  });

  return snapshot("ready", true, token);
}

/**
 * 토글 끄기 — 서버에 enabled=false 로 알리고 로컬 enabled 만 false 처리.
 * 토큰 자체는 보관 (사용자가 다시 켤 때 빠르게).
 */
export async function disablePush(): Promise<PushSnapshot> {
  writeEnabled(false);
  const token = readToken();
  if (token) {
    await apiCallWithRefresh("/push-register", {
      method: "POST",
      body: {
        deviceId: readDeviceId(),
        pushToken: token,
        platform: "web",
        enabled: false,
      },
    });
  }
  // 끈 직후 상태는 SDK 유무에 따라 ready or no_sdk 로 표시.
  const sdk = await loadSdk();
  return snapshot(sdk ? "ready" : "no_sdk", false, token);
}

/**
 * 현재 상태 스냅샷 — UI 첫 렌더에서 호출. 네트워크 호출 없음.
 */
export function getPushSnapshot(): PushSnapshot {
  const enabled = readEnabled();
  const token = readToken();
  // 첫 렌더에서는 SDK 미탐지. 사용자가 토글을 만지면 enable/disable 에서 정확한 status 반환.
  return snapshot(token ? "ready" : "idle", enabled, token);
}

export const PUSH_REMINDER_TEXT = REMINDER_TEXT;
