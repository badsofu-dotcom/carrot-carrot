# LAUNCH_CHECKLIST.md — 베타 출시 체크리스트

베타 5~20명 친한 사람 대상 TestFlight / 카카오톡 베타 단계.

## A. 자동 검증 (CI)

- [x] `node --test src/lib/*.test.mjs` — **247 / 247 pass** (Round 15 종료 시점)
- [x] `npm run typecheck` — clean
- [x] `npm run build` — OK
- [x] `npm run build:preview` — OK
- [x] 금지 토큰 (`localStorage` / `sessionStorage` / `indexedDB` / fullscreen / pointerlock) in dist-preview = 0
- [x] `"/assets/farm"` literal in dist-preview = 0

## B. 코드 정합성

- [x] Round 13 audit 6 문서 (INTERACTION / THEME / TIME / PROB / TAB / SETTINGS_INVENTORY) — critical 0건
- [x] Round 14 씨앗 자원 폐기 — 28 파일 정리
- [x] PR-104 P0 미션 드롭다운 회귀 fix
- [x] PR-116 worker server-side cap (`/economy/grant`)
- [x] PR-117 worker schema 정리 (migration 0008)

## C. UX

- [x] 5분 gate (focus < 5min → 보상 0, toast 안내) — `farmRules.ts`
- [x] 일일 P 캡 100P + dogam 10P boost — `dailyCap.ts`
- [x] cap 도달 1회 toast (PR-113)
- [x] 다크 모드 contrast WCAG AA — PR-80/83/84/96/106/110
- [x] 미션 카드 기본 접힘 + FOCUSING 자동 접힘 — PR-100/104
- [x] 광고 채널 모달 safe-area — PR-79
- [x] InventoryModal TabBar 위로 lift — PR-68
- [ ] 신규 사용자 첫 5분 시나리오 손수 검증 (ONBOARDING_AUDIT.md 발견 1, 2 추후)

## D. 법적 / 컴플라이언스

- [x] `/privacy` 라우트 in-app (PR-121)
- [x] `/terms` 라우트 in-app (PR-121)
- [x] `/rewards` 보상 정책 공시 in-app (PR-121)
- [x] reward-disclosure.md "확률형 보너스" 명시
- [x] PR-51 GRAC 회피: gem 50 → 전설 토끼 확률형 X (결과 보장)
- [ ] 법무 검토 (베타 후 정식 출시 전)
- [ ] 광고 ID 처리 정책 — 애드몹 적용 시 (베타엔 광고 OFF)
- [ ] 미성년자 보호 — 결제 없으므로 별도 절차 없음

## E. 인프라

- [ ] Worker `wrangler deploy` (메인테이너 수동) — Round 15 코드 반영
- [ ] D1 migration 0008 적용 (메인테이너 수동, 씨앗 컬럼 drop)
- [x] manifest.webmanifest (categories 추가, PR-120)
- [x] iOS apple-touch-icon (180/152/120)
- [x] favicon 16/32
- [ ] **DNS / HTTPS** — 베타 도메인 (`bunnies.farm` 또는 staging) 확인
- [ ] Apps in Toss 콘솔에 베타 deploymentId

## F. 피드백 채널

- [x] FeedbackSheet 모달 (PR-122)
- [x] SettingsPage "💬 피드백" 그룹 (visible)
- [ ] `VITE_FEEDBACK_WEBHOOK_URL` env 설정 (메인테이너 — Telegram bot 등)
- [ ] 베타 테스터에게 알림 ("의견 환영, 메뉴 안에서 보내요")

## G. 베타 배포 단계

### Stage 1: 빌드
```bash
npm run build:ait
# → carrot-carrot.ait 생성
```

### Stage 2: Apps in Toss 콘솔 업로드 (메인테이너)
- `.ait` 파일 업로드
- deploymentId 발급
- 테스트 그룹에 공유

### Stage 3: Worker 적용 (메인테이너)
```bash
cd cloudflare/workers/carrot-carrot-api
wrangler deploy
wrangler d1 migrations apply <DB_NAME>  # migration 0008
```

### Stage 4: 베타 테스터 안내
- 카카오톡 / 텔레그램 그룹 5~20명
- 첫 화면 + 농장 + 미션 카드 흐름 사진 1장
- "피드백 보내기" 시연

## H. 출시 후 모니터링 (베타 1주차)

- [ ] 사용자 피드백 webhook (Telegram chat) 매일 확인
- [ ] worker error rate (Cloudflare dashboard)
- [ ] 일일 P 캡 도달율 (heavy player 비율)
- [ ] crash / TypeError 발생 시 ROUND_16 후보

## I. 알려진 제약 (베타 한정)

1. **Worker 미배포** 상태에서 출시 시 게스트 모드만 작동 — 출금 불가, 토스 로그인 안 됨
2. **Apps in Toss preview** 외 환경에서 토스 SDK 응답 X — 게스트 fallback
3. **광고 OFF** — TOSS_AD_VERIFY_KEY 베타에 미설정. 광고 칩 시각 작동, 실 보상 X
4. **출금 OFF** — `TOSS_PROMOTION_API_BASE` 미설정. "콘솔 설정 후 출금" 안내만

## J. Round 16 candidate (이월)

- AppsInTossLoginGate timeout fallback (ERROR_AUDIT)
- 오프라인 status bar (ERROR_AUDIT)
- Onboarding "심기" step 보강 (ONBOARDING_AUDIT 발견 2)
- Service Worker 오프라인 캐시 (PWA_AUDIT)
- 광고 ID 정책 명시 (정식 출시 전)
- 법무 검토 (정식 출시 전)
