/**
 * Phase 6 — 공유 유틸.
 *
 * 책임:
 *  - html2canvas 로 DOM → PNG Blob 캡처.
 *  - Toss SDK 가 있으면 동적 import 후 share/shareViaMessenger 시도 (텍스트 메시지).
 *  - 이미지 파일 공유는:
 *      1) navigator.share + canShare({ files: [...] }) 가 되면 그걸로,
 *      2) 안 되면 Blob 다운로드 fallback.
 *  - 모든 경로는 throw 하지 않고 ShareResult 의 `kind` 로 표현.
 */

export type ShareResult =
  | { kind: "shared-files"; via: "web-share" }
  | { kind: "shared-text"; via: "toss" | "web-share" }
  | { kind: "downloaded"; filename: string }
  | { kind: "cancelled" }
  | { kind: "error"; reason: string };

export interface ShareCardPayload {
  /** Web Share / 다운로드용 파일명 (확장자 포함). */
  filename: string;
  /** Web Share API 의 title. */
  title: string;
  /** Web Share / Toss 의 본문 텍스트. */
  text: string;
}

/**
 * DOM 노드를 1080×1920 PNG Blob 으로 캡처.
 * - 노드는 hidden 영역에 1080px 폭으로 렌더돼 있다고 가정.
 * - useCORS + backgroundColor 를 명시해 모바일 캡처 안정성 확보.
 */
export async function captureNodeToPng(
  node: HTMLElement,
  opts: { width: number; height: number; backgroundColor?: string } = {
    width: 1080,
    height: 1920,
  },
): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(node, {
    width: opts.width,
    height: opts.height,
    windowWidth: opts.width,
    windowHeight: opts.height,
    backgroundColor: opts.backgroundColor ?? null,
    scale: 1, // 노드가 이미 1080×1920 이라 scale=1
    useCORS: true,
    allowTaint: false,
    logging: false,
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas-toBlob-null"));
      },
      "image/png",
      0.95,
    );
  });
}

/** Web Share API 로 파일을 공유할 수 있는지 feature detect. */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (typeof n.share !== "function") return false;
  if (typeof n.canShare !== "function") return false;
  try {
    // 빈 파일 1바이트로 probe
    const probe = new File([new Blob(["x"])], "probe.png", { type: "image/png" });
    return n.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Web Share 텍스트만 가능한지. */
export function canShareText(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as Navigator & { share?: unknown }).share === "function";
}

function isInTossApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ua = navigator.userAgent || "";
    if (/toss/i.test(ua)) return true;
    if ((window as unknown as { TossApps?: unknown }).TossApps) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Toss SDK 의 공유 함수를 동적 import 로 시도. 없으면 실패만 반환.
 * - shareViaMessenger 는 SDK 에 정의돼 있을 수 있음 → typeof 체크.
 * - 그 외엔 share({ message }) — 텍스트만 보냄.
 */
async function tryTossShareText(text: string): Promise<boolean> {
  if (!isInTossApp()) return false;
  try {
    const mod = (await import("@apps-in-toss/web-framework").catch(
      () => null,
    )) as
      | (Record<string, unknown> & {
          share?: (m: { message: string }) => Promise<void>;
          shareViaMessenger?: (m: { message: string }) => Promise<void>;
        })
      | null;
    if (!mod) return false;
    if (typeof mod.shareViaMessenger === "function") {
      await mod.shareViaMessenger({ message: text });
      return true;
    }
    if (typeof mod.share === "function") {
      await mod.share({ message: text });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Blob 을 다운로드 시켜주는 fallback. */
function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // 살짝 딜레이 후 cleanup — Safari 호환.
  window.setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * 이미지 파일을 공유. 가능한 경로를 순서대로 시도:
 *  1) navigator.share + canShare({ files })
 *  2) Toss share 텍스트 only (이미지는 다운로드 + 텍스트 공유)
 *  3) 다운로드 fallback
 */
export async function shareImage(
  blob: Blob,
  payload: ShareCardPayload,
): Promise<ShareResult> {
  const file = new File([blob], payload.filename, { type: "image/png" });

  // 1) Web Share API 로 파일 공유 — 모바일 사파리/안드로이드 크롬에서 동작.
  if (canShareFiles()) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
        files: [file],
        title: payload.title,
        text: payload.text,
      });
      return { kind: "shared-files", via: "web-share" };
    } catch (e) {
      // 사용자가 취소한 경우.
      const msg = e instanceof Error ? e.message : "";
      if (/abort|cancel/i.test(msg)) {
        return { kind: "cancelled" };
      }
      // share 실패 → 다음 단계로.
    }
  }

  // 2) Toss 환경이면 — 이미지는 어차피 못 보내니 다운로드 후 텍스트 공유.
  const tossOk = await tryTossShareText(payload.text);
  if (tossOk) {
    downloadBlob(blob, payload.filename);
    return { kind: "shared-text", via: "toss" };
  }

  // 3) 그 외 — 텍스트만 Web Share API 로 (이미지는 같이 못 보냄).
  if (canShareText()) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
        title: payload.title,
        text: payload.text,
      });
      downloadBlob(blob, payload.filename);
      return { kind: "shared-text", via: "web-share" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/abort|cancel/i.test(msg)) {
        return { kind: "cancelled" };
      }
    }
  }

  // 4) 다운로드 fallback
  try {
    downloadBlob(blob, payload.filename);
    return { kind: "downloaded", filename: payload.filename };
  } catch (e) {
    return {
      kind: "error",
      reason: e instanceof Error ? e.message : "download-failed",
    };
  }
}
