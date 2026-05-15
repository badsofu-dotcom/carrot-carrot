# 버니타임 — 앱인토스 제출 가이드

> 흐흐, 너 집중하면 내가 다 먹어줄게.
>
> 이 문서는 **앱인토스(Apps in Toss) 콘솔**에 버니타임을 제출하기 위한 메타
> 정보 / 빌드 / 자산 / 심사 체크리스트를 한 곳에 모은다.
> 백엔드 셋업(Cloudflare Workers + D1)은 [`docs/SETUP_FOR_USER.md`](./docs/SETUP_FOR_USER.md)
> 를 참고한다.

---

## 1. 앱 메타

- 앱 이름: **버니타임:집중타이머** (한국어 표시명) / **Bunny Time** (영문)
- granite/콘솔 ID: `carrot-carrot`
- 카테고리: 생산성 / 집중
- 한 줄 설명: 25분 집중하면 토끼가 자라요.
- 핵심 가치: 포모도로 + 캐릭터 보상 + 보상형 광고로 사운드 잠금해제.
- 프레임워크: Vite + React 19 (Apps in Toss web-framework)
- 백엔드: Cloudflare Worker (`carrot-carrot-api`) + D1 (`carrot-carrot-db`).

## 2. 디렉토리 구성

| 경로                                          | 역할                                                  |
| --------------------------------------------- | ----------------------------------------------------- |
| `src/`                                        | React 앱 소스                                         |
| `cloudflare/workers/carrot-carrot-api/`       | 백엔드 Worker (Hono + jose, mTLS / D1 바인딩)         |
| `cloudflare/workers/carrot-carrot-api/migrations/` | D1 마이그레이션 (0001_init.sql, 0002_farm.sql)   |
| `granite.config.ts`                           | Apps in Toss 콘솔 메타 (앱 이름, 브랜드 아이콘 URL)   |
| `docs/SETUP_FOR_USER.md`                      | Cloudflare 배포 매뉴얼 (사용자가 직접 실행)           |
| `legacy/vercel-proxy/`                        | (예전 Vercel mTLS 프록시 — 현재는 미사용 보관)        |

## 3. 환경변수 (.env.production)

`.env.production.example` 을 그대로 복사해 `.env.production` 으로 저장하고
값을 채운다 (`.env.production` 은 gitignore). 또는 인라인으로 빌드한다:

```bash
VITE_APPS_IN_TOSS_PROXY_URL=https://carrot-carrot-api.bunniesfarm.workers.dev \
  npm run build:ait
```

`build:submit` / `build:ait` 는 `scripts/check-build-env.mjs` 가 먼저 실행되어
필수 VITE_* 가 비어 있으면 즉시 중단한다 — 과거 빈 env 로 빌드된 .ait 가 콘솔에
업로드되어 `SERVER_ENV_MISSING` 으로 로그인이 깨진 사고 재발 방지.

서버 시크릿 (Worker 측) 은 `wrangler secret put` 으로만 등록한다 — 자세한 내용은
[`docs/SETUP_FOR_USER.md`](./docs/SETUP_FOR_USER.md) 참고.

## 4. 보안 체크리스트 (커밋/배포 전)

다음 카테고리의 문자열이 tracked / dist / .ait 어디에도 남아 있지 않은지 확인한다.

- 폐기된 토스 본인인증 키/시크릿 (구 TossCert 클라이언트 ID/시크릿).
- 폐기된 본인인증 SDK 함수명 (`appsInTossSign...` 류 — TossCert 변형).
- 폐기된 본인인증 콜백 경로 (`/auth/id/req...`).
- 구 백엔드 식별자 (`@supa` `base/...`, `SUPA` `BASE_URL`, `VERC` `EL_*`).
- PEM 형식 비밀키 헤더 (`---BEGIN... PRIVATE... KEY---`) 가 dist/ait/zip 에 절대 없어야 함.

자동 점검 스크립트는 `scripts/check-secrets.mjs` (또는 사내 표준 도구) 로 운영하고,
검사 패턴은 동일 파일에서만 관리한다 — 본 문서에는 패턴 자체를 직접 기재하지
않는다 (문서 자체가 grep 대상에 잡히지 않도록).

추가:

- `.secrets/` 가 `.gitignore` 에 포함되어 있는지.
- `.env.production`, `.env.local` 이 tracked 되어 있지 않은지 (`git ls-files | grep '^.env'`).

## 5. 빌드 절차

```bash
npm install
npm run typecheck
npm run build          # vite -> dist/
npm run build:submit   # zip + report
npm run build:ait      # carrot-carrot.ait
```

성공 후 산출물:

- `dist/` — Vite 정적 번들 (콘솔 외부에 직접 배포하지 않음).
- `dist-submit/carrot-carrot-submit.zip` — 백업/검수용 zip.
- `carrot-carrot.ait` — Apps in Toss 콘솔 업로드용 아티팩트.

## 6. 백엔드 (Cloudflare) 배포

전 과정은 [`docs/SETUP_FOR_USER.md`](./docs/SETUP_FOR_USER.md) 의 1~16 단계.
요약:

1. wrangler login (Bunniesfarm@naver.com).
2. mTLS 업로드 → `certificate_id` 를 `wrangler.toml` 에 박는다.
3. `wrangler d1 create carrot-carrot-db` → `database_id` 를 `wrangler.toml` 에 박는다.
4. `wrangler d1 migrations apply carrot-carrot-db --remote`.
5. `wrangler secret put APPS_IN_TOSS_DECRYPTION_KEY`, `JWT_SECRET`.
6. `wrangler deploy --dry-run` → `wrangler deploy`.
7. 출력된 Worker URL 을 `.env.production` 의 `VITE_APPS_IN_TOSS_PROXY_URL` 에.

## 7. Apps in Toss 콘솔 업로드

1. 브랜드 아이콘 — 콘솔 → 앱 정보 → 아이콘 슬롯에 등록된 아이콘이
   `https://static.toss.im/appsintoss/9399/e8354053-e837-4e0e-ad25-8a0834f06620.png`
   인지 확인한다. granite.config.ts 의 `CONSOLE_BRAND_ICON_URL` 기본값과
   동일해야 심사가 통과된다 (실제 거부 사례: granite 메타가 placeholder 인
   채로 제출되어 콘솔 아이콘과 불일치 판정).
   - 콘솔에서 아이콘을 새로 업로드해 URL 이 바뀌면, granite.config.ts 의
     `CONSOLE_BRAND_ICON_URL` 상수를 새 URL 로 갱신한 뒤 ait 를 재빌드한다.
   - 임시 override 가 필요한 경우에만 `APPS_IN_TOSS_BRAND_ICON_URL` 환경변수로
     덮어쓴다 — 평소엔 `.env.production` 에서 비워두면 된다.
2. `npm run build:ait` 실행. 가드(`scripts/check-build-env.mjs`) 가:
   - `VITE_APPS_IN_TOSS_PROXY_URL` 가 채워졌는지 확인.
   - override 가 들어왔을 때만 `APPS_IN_TOSS_BRAND_ICON_URL` 의 형식
     (https://, placeholder 아님) 을 검증.
3. 생성된 `carrot-carrot.ait` 를 콘솔 업로드 → 심사 신청.

## 8. 회귀 체크 (UI / 기능)

- [ ] Apps in Toss 환경에서 `appLogin()` 동의 → 우리 Worker `/login` 200 → JWT 저장.
- [ ] `/me` 200 (Authorization Bearer JWT). focusStats / carrots / unlockedSounds 가 빈 객체라도 응답.
- [ ] 보상형 광고 — `VITE_TOSS_AD_GROUP_ID` 미설정 시 기본 그룹
      (`ait.v2.live.146b65d064c2402e`) 으로 호출. 외부 브라우저는 simulation.
- [ ] 게스트 모드 (Worker URL 미설정/오프라인) 에서도 UI 가 mock stats 로 동작.
- [ ] 외부 브라우저(Perplexity preview 등) 에서 `VITE_TOSS_AUTH_MOCK=true` 면 mock 통과.

## 9. CORS / WebView origin 점검

Apps in Toss WebView 가 사용하는 origin 은 환경에 따라
`https://apps-in-toss.com` / `https://toss.im` / `https://*.toss.im` 등으로 다양하다.
Worker 의 허용 목록과 preflight 테스트 명령은 [`docs/SETUP_FOR_USER.md` 부록 A-2](./docs/SETUP_FOR_USER.md#부록-a-2-cors-허용-origin-목록)
참고. 배포 직후 다음을 반드시 확인:

- [ ] `OPTIONS /login` 에 대해 `https://apps-in-toss.com` / `https://toss.im` / `https://www.toss.im`
      모두 `Access-Control-Allow-Origin` 이 echo 되어 돌아온다.
- [ ] `Access-Control-Allow-Headers` 에 `authorization, content-type` 포함.
- [ ] 알 수 없는 origin (e.g. `https://example.com`) 은 `Access-Control-Allow-Origin` 헤더가
      **비어 있다** (와일드카드 echo 없음).

`network_error` / `worker_fetch_failed` 라벨이 게이트에 떠도 더 이상
`UNKNOWN` 으로 묶이지 않고 `NETWORK_ERROR · worker_fetch_failed` 로 표시된다.

## 10. Smoke test: first promotion

`POST /economy/withdraw` 가 실제 Toss `executePromotion` 을 호출하기 직전,
사전 점검은 다음 순서로 — **반드시 staging 에서 1회 통과 후 production**.

전제:
- D1 migrations 0003 + 0006 적용 완료 (`ECONOMY_DESIGN.md` 마이그레이션 체크리스트 참고).
- `wrangler secret put` 으로 `TOSS_PROMOTION_API_BASE` / `TOSS_PROMOTION_API_KEY` / `TOSS_AD_VERIFY_KEY` 등록.
- 워커 배포 (`wrangler deploy` — 사람만 실행).

1. **잔액 확인** — 로그인 후:
   ```bash
   curl -s -H "authorization: Bearer $JWT" \
     https://carrot-carrot-api.<acct>.workers.dev/economy/balance
   # 기대: { ok: true, data: { pending: N, lifetimeTotal: N, withdrawEnabled: true, minPayout: 50 } }
   ```
   `withdrawEnabled:false` 면 시크릿 미등록 — 다시 확인.

2. **MIN_PAYOUT (50P) 보유** — 광고 시청 / 당근 수확으로 50P 이상 누적. 미달이면
   /withdraw 가 400 BELOW_MIN.

3. **withdraw 호출**:
   ```bash
   curl -s -X POST -H "authorization: Bearer $JWT" \
     -H "content-type: application/json" \
     -d '{"amount":50}' \
     https://carrot-carrot-api.<acct>.workers.dev/economy/withdraw
   # 기대: { ok: true, data: { txid: "...", status: "succeeded"|"pending", newPending: N-50 } }
   ```

4. **감사 로그 확인** — D1:
   ```bash
   wrangler d1 execute carrot-carrot-db --remote \
     --command="SELECT id, user_key, amount, toss_txid, status, settled_at \
                FROM promotion_withdrawals ORDER BY id DESC LIMIT 5"
   ```
   status 가 `pending` 이면 Toss 비동기 처리 중 — 동일 idempotencyKey 로 재시도하지 말 것 (Toss 가 dedupe).

5. **/refill ad-token 경로 검증** — `TOSS_AD_VERIFY_KEY` 등록 후:
   ```bash
   # signedToken 미동봉 → 401
   curl -s -X POST -H "authorization: Bearer $JWT" \
     -H "content-type: application/json" \
     -d '{"nonce":"deadbeefdeadbeef"}' \
     https://carrot-carrot-api.<acct>.workers.dev/tools/refill
   # 기대: { ok: false, error: { code: "INVALID_SIG", message: "signedToken required" } }
   ```

6. **nonce 재사용 차단** — 같은 nonce 로 두 번째 호출 시 409 DUPLICATE_NONCE.

실패 시 절대 자동 재시도 금지. 잔액 환불 로직이 워커 안에 있지만 (`refundPending`),
upstream timeout 등 모호한 케이스는 사람이 promotion_withdrawals 로그를 보고 결정.
