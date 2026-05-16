/**
 * Web Notification 안전 wrapper (PR-53).
 *
 * Apps in Toss WebView 의 Web Notification API 지원 여부는 환경별
 * 차이. 본 wrapper 는 사용 가능 시 native notification, 불가 시
 * `cc:notify:in-app` CustomEvent dispatch 로 in-app banner fallback.
 *
 * 권한 요청 / 가능 여부 / 발송 모두 safe (throw 안 함).
 */

export type NotifyKind = "drop" | "mission" | "session" | "midnight" | "treasure";

export interface NotifyDetail {
  kind: NotifyKind;
  title: string;
  body: string;
}

export function notificationAvailable(): boolean {
  try {
    return typeof window !== "undefined" && "Notification" in window;
  } catch {
    return false;
  }
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationAvailable()) return "unsupported";
  try {
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!notificationAvailable()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "denied";
  }
}

/**
 * Fires either a native Notification (if granted) or dispatches an
 * in-app event for a fallback banner. Returns true on native fire,
 * false on event fallback or noop.
 */
export function notify(detail: NotifyDetail): boolean {
  // Native path
  if (notificationAvailable() && notificationPermission() === "granted") {
    try {
      // eslint-disable-next-line no-new -- side-effect by design
      new Notification(detail.title, { body: detail.body });
      return true;
    } catch {
      /* fall through to in-app */
    }
  }
  // In-app fallback
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cc:notify:in-app", { detail }),
      );
    }
  } catch {
    /* ignore */
  }
  return false;
}
