/**
 * API 클라이언트 — Cloudflare Worker (carrot-carrot-api).
 *
 * 백엔드는 단일 Cloudflare Worker (`VITE_APPS_IN_TOSS_PROXY_URL`).
 * 인증은 Worker 가 발급한 자체 JWT (HS256) 단일 토큰을 사용한다.
 * 401 시에는 토큰을 비우고 호출자가 게스트 모드 또는 재로그인을 결정한다.
 *
 * 모든 호출은 Result<T> 를 반환하고 throw 하지 않는다.
 */

import { safeStorage } from "./safeStorage";

export interface ApiOk<T> {
  ok: true;
  data: T;
}
export interface ApiErr {
  ok: false;
  error: {
    code: string;
    message: string;
    status?: number;
    fallback?: boolean;
  };
}
export type ApiResult<T> = ApiOk<T> | ApiErr;

const ACCESS_KEY = "cc.auth.access";

export const tokenStore = {
  getAccess: () => safeStorage.get(ACCESS_KEY),
  set: (access: string | null) => {
    if (access) safeStorage.set(ACCESS_KEY, access);
    else safeStorage.remove(ACCESS_KEY);
  },
  clear: () => {
    safeStorage.remove(ACCESS_KEY);
  },
};

function deriveBaseUrl(): string {
  const explicit = import.meta.env.VITE_APPS_IN_TOSS_PROXY_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return "";
}

interface RequestOpts {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** 인증 헤더 자동 부착. 기본 true. */
  auth?: boolean;
  /** 명시적 timeout (ms). 기본 8000. */
  timeoutMs?: number;
}

export async function apiCall<T = unknown>(
  path: string,
  opts: RequestOpts = {},
): Promise<ApiResult<T>> {
  const base = deriveBaseUrl();
  if (!base) {
    return {
      ok: false,
      error: {
        code: "no_api_base",
        message: "API 미설정 — 오프라인/mock 모드",
        fallback: true,
      },
    };
  }
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.auth ?? true) {
    const tok = tokenStore.getAccess();
    if (tok) headers["authorization"] = `Bearer ${tok}`;
  }

  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl
    ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000)
    : null;

  try {
    const res = await fetch(url, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl?.signal,
      // Worker 는 쿠키 / 세션을 사용하지 않으므로 credentials 는 항상 omit.
      // 'include' 로 보내면 Toss WebView 의 null Origin 과 결합해 preflight 가
      // 막혀 POST 자체가 발사되지 않는다.
      credentials: "omit",
      mode: "cors",
      cache: "no-store",
    });
    if (timer) clearTimeout(timer);

    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      /* empty / non-json — 라이트 응답 처리 */
    }

    if (!res.ok) {
      const e = (parsed as { error?: { code?: string; message?: string; fallback?: boolean } } | null)?.error;
      return {
        ok: false,
        error: {
          code: e?.code ?? `http_${res.status}`,
          message: e?.message ?? `HTTP ${res.status}`,
          status: res.status,
          fallback: e?.fallback ?? true,
        },
      };
    }

    // 정상 응답은 { ok: true, ...data } 또는 raw payload 둘 다 허용.
    if (parsed && typeof parsed === "object" && "ok" in (parsed as object)) {
      const obj = parsed as { ok: boolean } & Record<string, unknown>;
      if (obj.ok === true) {
        const { ok: _ok, ...rest } = obj;
        return { ok: true, data: rest as T };
      }
      return parsed as ApiResult<T>;
    }
    return { ok: true, data: parsed as T };
  } catch (e) {
    if (timer) clearTimeout(timer);
    return {
      ok: false,
      error: {
        code: "network_error",
        message: e instanceof Error ? e.message : "fetch failed",
        fallback: true,
      },
    };
  }
}

/**
 * 401 발생 시 토큰을 비우고 결과를 그대로 반환한다.
 *
 * Cloudflare Worker 백엔드에서는 refresh 가 토스 OAuth refresh 토큰을
 * 요구하므로 클라이언트가 자동 회전하지 않는다. Apps in Toss SDK 의
 * `appLogin()` 으로 다시 인증할 수 있다.
 */
export async function apiCallWithRefresh<T = unknown>(
  path: string,
  opts: RequestOpts = {},
): Promise<ApiResult<T>> {
  const r = await apiCall<T>(path, opts);
  if (r.ok) return r;
  if (r.error.status === 401) {
    tokenStore.clear();
  }
  return r;
}

export const apiBaseUrl = deriveBaseUrl;
