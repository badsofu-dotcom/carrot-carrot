/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 일반 브라우저/로컬에서 무조건 mock 인증 강제. true 권장. */
  readonly VITE_MOCK_AUTH?: string;
  /** 구버전 호환 — 같이 두지만 우선순위는 VITE_MOCK_AUTH */
  readonly VITE_USE_MOCK_LOGIN?: string;
  /**
   * Cloudflare Worker (`carrot-carrot-api`) 의 배포 URL.
   * 예: https://carrot-carrot-api.<account-subdomain>.workers.dev
   * 비어있으면 클라이언트는 오프라인/mock 모드로 동작한다.
   */
  readonly VITE_APPS_IN_TOSS_PROXY_URL?: string;
  readonly VITE_TOSS_CLIENT_ID?: string;
  /** 토스 본인인증 mock 강제 — Perplexity preview 등 토스 외부 환경에서 true. */
  readonly VITE_TOSS_AUTH_MOCK?: string;
  /**
   * Apps in Toss 보상형 광고 그룹 ID. 미설정 시 코드 기본값(공식 그룹
   * `ait.v2.live.146b65d064c2402e` — '백색소음 사운드 잠금해제 보상') 사용.
   * 그룹 교체 시에만 env 로 덮어쓴다.
   */
  readonly VITE_TOSS_AD_GROUP_ID?: string;
  /** 구버전 호환 — VITE_TOSS_AD_GROUP_ID 미설정 시 fallback 으로 사용. */
  readonly VITE_TOSS_AD_UNIT_ID?: string;
  /** 토스 보상형 광고 mock 강제 — Perplexity preview/외부 브라우저에서 simulation. */
  readonly VITE_TOSS_AD_MOCK?: string;
  /** Phase 4: 타이머 QA 압축. true 면 25분 → 25초. */
  readonly VITE_TIMER_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
