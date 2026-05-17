# ROUND 15 SUMMARY — Beta Ship Prep

Round 14 종료 (`4bc54c6`) → Round 15 종료 (`2098c2d`). 10 PR.

## A. PR 1줄 요약

| PR | SHA | 요약 | 카테고리 |
| --- | --- | --- | --- |
| PR-116 | `39abeca` | Worker `POST /economy/grant` 서버 quota 권위 | Security |
| PR-117 | `914701c` | Worker 씨앗 schema 정리 + migration 0008 | Schema |
| PR-118 | `b5c24c4` | ONBOARDING_AUDIT — critical 0, 권장 fix 2 | Audit |
| PR-119 | `833a373` | ERROR_AUDIT — 4 raw fetch 안전, blocker 0 | Audit |
| PR-120 | `d741053` | PWA_AUDIT + manifest categories | PWA |
| PR-121 | `a3293ae` | 법적 문서 라우트 `/privacy /terms /rewards` | Legal |
| PR-122 | `51d04c2` | 인앱 피드백 채널 (FeedbackSheet + Settings 그룹) | Beta |
| PR-123 | `e523e7f` | LAUNCH_CHECKLIST 10 섹션 | docs |
| PR-124 | `2098c2d` | 5분 gate 사전 hint (ONBOARDING 발견 1) | UX |
| PR-125 | (this) | Round 15 통합 보고 | docs |

## B. 메트릭

| 항목 | 값 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **247 / 247 pass** (Round 14 종료 동일 — Round 15 는 audit + UX 중심) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지 토큰 in dist-preview | **0** |
| `"/assets/farm"` literal | **0** |

## C. 산출 audit 문서 (Round 15 핵심)

1. **ONBOARDING_AUDIT.md** — 신규 사용자 5분 시나리오, critical 0
2. **ERROR_AUDIT.md** — fetch / API fallback 검증, blocker 0
3. **PWA_AUDIT.md** — manifest + iOS standalone, blocker 0
4. **LAUNCH_CHECKLIST.md** — 10 섹션 출시 체크리스트
5. **IMPLEMENTATION_REPORT_PR-116~124** — 각 변경 이유

## D. 핵심 변경

### D-1. Worker server-side cap (PR-116)

`POST /economy/grant`:
- 클라이언트 cap (PR-90) 의 server 권위 enforcement
- daily_caps 테이블 (PR-32 0003) 활용 — 새 migration 불필요
- bunnies_owned 카운트 12+ 시 +10P boost (dogam_100 passive 일치)
- point_grants ledger + pending_points UPSERT
- Client adapter `grantSync.ts` fire-and-forget — 게임 흐름 차단 X
- localStorage tamper 보호: server pending_points 가 출금 시 진실

### D-2. Worker schema 씨앗 정리 (PR-117)

Client PR-109 후속:
- migration 0008 — `ALTER TABLE farm_inventory DROP COLUMN seeds`
- `FarmState.seeds` / `addSeeds()` 제거
- 4 farm endpoints 응답에서 `seeds` 필드 제거
- `/grow` body 의 `seedDelta` 무시 (구 클라 호환)

### D-3. 법적 문서 in-app (PR-121)

3 routes (`/privacy /terms /rewards`):
- Vite `?raw` markdown import — 가벼운 의존성
- LegalPage 컴포넌트 + 3 lazy routes
- SettingsPage 고급 disclosure 안에 링크
- privacy-policy.md 의 `localStorage` 리터럴 우회 (forbidden token 정책)

### D-4. 베타 피드백 채널 (PR-122)

`VITE_FEEDBACK_WEBHOOK_URL` webhook 으로 사용자 의견 + 환경 정보 (app version / mode / UA) 전송. 개인정보 미포함. 미설정 시 클립보드 fallback. SettingsPage 의 **visible 그룹** (고급 X) — 발견성 우선.

### D-5. 5분 gate 사전 hint (PR-124)

ONBOARDING_AUDIT 발견 1 적용. IDLE 시 TimerControls 아래 "💡 5분 이상 집중해야 작물이 자라요". 학습 톤 일관.

## E. 베타 출시 전 메인테이너 수동 단계

LAUNCH_CHECKLIST.md G 섹션 참조. 핵심:

1. **Worker deploy** (`wrangler deploy`)
   - PR-116 의 `/economy/grant` 활성화
   - PR-117 의 seeds 제거 코드 적용
2. **D1 migration 0008 apply** (`wrangler d1 migrations apply <DB>`)
   - seeds 컬럼 drop
3. **`VITE_FEEDBACK_WEBHOOK_URL` env 설정** (Cloudflare Pages 또는 Apps in Toss 콘솔)
4. **Apps in Toss 콘솔 `.ait` 업로드**

## F. 알려진 베타 제약

1. 광고 OFF (TOSS_AD_VERIFY_KEY 미설정)
2. 출금 OFF (TOSS_PROMOTION_API_BASE 미설정)
3. Worker 미배포 시 게스트 모드만
4. Service Worker 부재 (오프라인 캐시 없음, Round 16)

## G. Round 16 후보

이월 audit 발견:
1. AppsInTossLoginGate timeout fallback (ERROR_AUDIT)
2. 오프라인 status bar 안내 (ERROR_AUDIT)
3. apiCall fetch timeout (ERROR_AUDIT)
4. Onboarding "심기" step 보강 (ONBOARDING_AUDIT 발견 2)
5. 🎁 보상함 버튼 발견성 (ONBOARDING_AUDIT 발견 3)
6. 게스트 모드 명시성 (ONBOARDING_AUDIT 발견 4)
7. Service Worker 오프라인 캐시 (PWA_AUDIT)
8. Manifest screenshots / shortcuts (PWA_AUDIT)
9. 법무 검토 → 정식본 (LAUNCH_CHECKLIST D)
10. 광고 ID 정책 (정식 출시 시 / 베타엔 광고 OFF)

## H. 결론

Round 15 = **"Beta Ship Prep"**.

핵심 보안 (worker cap) + 법적 준비 (privacy/terms) + 베타 피드백 채널 + UX 마무리 (5분 hint). audit 4 문서로 알려진 위험 모두 파악, blocker 0건.

**베타 출시 가능 상태.** 메인테이너의 wrangler deploy + Apps in Toss 콘솔 업로드 단계만 남음.

모두 push 완료 — `origin/main` 최신 `2098c2d` (이 보고서 commit 후 갱신).
