# 버니타임 — Cloudflare Workers + D1 셋업 가이드 (사용자용)

이 문서는 **Bunniesfarm@naver.com** Cloudflare 계정에서 `carrot-carrot-api`
Worker 와 `carrot-carrot-db` D1 데이터베이스를 직접 배포하는 절차다.
모든 명령은 macOS / Linux 셸 기준이며, 기존 `colortherapy-toss` 프로젝트와
이름이 겹치지 않도록 모든 리소스 이름은 `carrot-carrot-*` 네임스페이스를 쓴다.

> **주의**: 본 가이드의 명령은 **사용자가 직접 실행**한다. 자동 에이전트는 코드/설정/문서
> 만 준비했고 `wrangler deploy --dry-run` 만 시도했다. 실제 업로드/배포는 사용자가
> 진행해야 한다.

---

## 1. Cloudflare 계정 (Bunniesfarm@naver.com) 확인

새 계정을 만들지 않는다. 기존 `colortherapy-toss` 가 배포된 계정을 그대로 사용한다.

- 브라우저에서 https://dash.cloudflare.com 접속 → Bunniesfarm@naver.com 로그인.
- 좌측 상단 계정 이름이 콘솔과 동일한지 확인.

---

## 2. wrangler 설치

```bash
# 최신 wrangler 4.x 설치 (글로벌)
npm install -g wrangler@latest

# 또는 프로젝트 로컬로 사용 (이 레포는 cloudflare/workers/carrot-carrot-api/ 에 devDep 으로 박혀 있음)
cd cloudflare/workers/carrot-carrot-api
npm install
```

**성공 출력 예**:

```
added 1 package, and audited 2 packages in 3s
```

**실패 체크포인트**:

- `EACCES` → `sudo` 또는 `nvm` 환경 권장.
- `wrangler: command not found` → `npm bin -g` 결과를 PATH 에 추가.

---

## 3. wrangler login (Bunniesfarm@naver.com 선택)

```bash
wrangler login
```

브라우저가 열리면 **Bunniesfarm@naver.com 계정으로 로그인** 후 권한 승인.

**성공 출력 예**:

```
Successfully logged in.
```

**실패 체크포인트**: 다른 계정으로 로그인된 상태라면 `wrangler logout` 후 다시 시도.

---

## 4. wrangler whoami

```bash
wrangler whoami
```

**성공 출력 예**:

```
👋 You are logged in with an OAuth Token, associated with the email Bunniesfarm@naver.com.
┌──────────────────────────────────┬──────────────────────────────────┐
│ Account Name                     │ Account ID                       │
├──────────────────────────────────┼──────────────────────────────────┤
│ Bunniesfarm@naver.com's Account  │ <ACCOUNT_ID>                     │
└──────────────────────────────────┴──────────────────────────────────┘
```

`<ACCOUNT_ID>` 는 다음 단계에서 사용되지 않지만 화면에 메모해 둔다.

---

## 5. mTLS 인증서 / 키 파일 위치 — `.secrets/`

토스로부터 받은 mTLS 인증서/키 (PEM) 와 AES 복호화 키, JWT 시크릿은 절대 깃에
들어가면 안 된다. 레포 루트에 `.secrets/` 디렉토리를 만들고 거기에만 둔다.

```bash
mkdir -p .secrets
chmod 700 .secrets

# 토스에서 발급받은 PEM 파일을 아래 경로에 둔다 (예시 파일명)
#   .secrets/toss-mtls.crt   — 클라이언트 인증서
#   .secrets/toss-mtls.key   — 클라이언트 개인키
#   .secrets/decryption.b64  — APPS_IN_TOSS_DECRYPTION_KEY (base64 32B) 한 줄
```

`.gitignore` 에 `.secrets/` 가 포함되어 있는지 확인:

```bash
grep -n "^.secrets/" .gitignore
# 출력: 18:.secrets/   (라인 번호는 다를 수 있음)
```

없으면 `.gitignore` 에 `.secrets/` 한 줄을 추가한다.

---

## 6. mTLS 인증서 업로드

```bash
cd cloudflare/workers/carrot-carrot-api

wrangler mtls-certificate upload \
  --cert ../../../.secrets/toss-mtls.crt \
  --key  ../../../.secrets/toss-mtls.key \
  --name carrot-carrot-mtls-prod
```

**성공 출력 예**:

```
Uploading mTLS Certificate carrot-carrot-mtls-prod...
Success! Uploaded mTLS Certificate carrot-carrot-mtls-prod
ID: 2f7c8b23-1a4d-4f3e-9a1c-abcdef012345
Issuer: CN=Toss Apps mTLS Issuer, O=Toss
Expires on 12/31/2027
```

위 `ID:` 값을 **복사** 해서 `cloudflare/workers/carrot-carrot-api/wrangler.toml`
의 `[[mtls_certificates]]` 섹션 `certificate_id` 에 붙여넣는다 (
현재는 `PLACEHOLDER_USER_WILL_FILL`).

```toml
[[mtls_certificates]]
binding = "TOSS_MTLS"
certificate_id = "2f7c8b23-1a4d-4f3e-9a1c-abcdef012345"
```

**실패 체크포인트**:

- `ENOENT cert file` → 경로 확인 (cd 위치 주의, 위 명령은 worker 디렉토리 기준).
- `name already exists` → `wrangler mtls-certificate list` 로 확인 후 동일 이름이
  있으면 그 ID 를 그대로 사용해도 된다.

---

## 7. D1 데이터베이스 생성 (`carrot-carrot-db`)

```bash
cd cloudflare/workers/carrot-carrot-api
wrangler d1 create carrot-carrot-db
```

**성공 출력 예**:

```
✅ Successfully created DB 'carrot-carrot-db' in region APAC

[[d1_databases]]
binding = "DB"
database_name = "carrot-carrot-db"
database_id = "9a1f0c72-3b48-4d2e-89cf-1234567890ab"
```

`database_id` 값을 **복사** 해서 `wrangler.toml` 의 `[[d1_databases]]` 섹션
`database_id` 에 붙여넣는다 (현재 `PLACEHOLDER_USER_WILL_FILL`).

**실패 체크포인트**: `name already exists` → 이미 만들어진 경우 `wrangler d1 list`
로 확인하고 ID 를 가져온다. 다른 프로젝트(`colortherapy-toss`)와 이름이 겹치지
않으니 안전하다.

---

## 8. D1 마이그레이션 적용 (원격)

```bash
cd cloudflare/workers/carrot-carrot-api
wrangler d1 migrations apply carrot-carrot-db --remote
```

**성공 출력 예**:

```
🚣  Applied 1 migration:
  - 0001_init.sql
```

**실패 체크포인트**:

- `database_id` 가 placeholder 면 실패. 먼저 7번을 끝낸다.
- 권한 오류면 5번 wrangler login 계정 확인.

---

## 9. APPS_IN_TOSS_DECRYPTION_KEY 시크릿 등록

토스 가이드에 따라 base64 인코딩된 32B AES 키를 Worker secret 으로 등록한다.
**키 문자열은 stdin 으로 전달하고, .gitignore 에서 제외된 파일에서만 읽는다.**
PowerShell 과 bash 모두에서 동작하는 형태:

```bash
cd cloudflare/workers/carrot-carrot-api

# Linux / macOS / Git Bash
wrangler secret put APPS_IN_TOSS_DECRYPTION_KEY < ../../../.secrets/decryption.b64
```

**Windows PowerShell**:

```powershell
cd cloudflare\workers\carrot-carrot-api
Get-Content ..\..\..\.secrets\decryption.b64 -Raw | wrangler secret put APPS_IN_TOSS_DECRYPTION_KEY
```

**Windows CMD**:

```cmd
cd cloudflare\workers\carrot-carrot-api
type ..\..\..\.secrets\decryption.b64 | wrangler secret put APPS_IN_TOSS_DECRYPTION_KEY
```

같은 방법으로 AAD 도 등록한다 (vars 로 박혀 있어도 secret 으로 덮어쓰면 안전).
`wrangler.toml` 의 `[vars]` 에 `APPS_IN_TOSS_DECRYPTION_AAD = "TOSS"` 가 이미
있으므로 보통은 secret 으로 다시 넣을 필요가 없다.

**성공 출력 예**:

```
🌀 Creating the secret for the Worker "carrot-carrot-api"
✨ Success! Uploaded secret APPS_IN_TOSS_DECRYPTION_KEY
```

> Worker 가 아직 배포되지 않은 상태라면 `wrangler secret put` 이 "Worker not found"
> 에러를 낼 수 있다. 그 경우는 11→12 (dry-run + 실제 deploy) 를 먼저 진행한 뒤
> 이 단계를 다시 시도한다.

### DECRYPT_FAILED 가 떴을 때

`/login` 응답에 `{ "error": { "code": "DECRYPT_FAILED" } }` 가 보이면 거의 항상
secret 키 또는 AAD 가 잘못된 것이다 (응답에 `failedFields` 배열이 함께 온다).
키 자체가 변경되었을 수도 있으므로 다음 순서로 확인한다:

```bash
# 1) 현재 등록된 secret 목록 확인
wrangler secret list

# 2) 토스 콘솔/이메일로 받은 최신 base64 키를 .secrets/decryption.b64 에 다시 저장
#    (한 줄, trailing newline 없이 저장하는 것을 권장. base64 32B 라 디코딩 시 32바이트여야 함)

# 3) secret 갱신 (같은 이름으로 put 하면 덮어쓴다)
cd cloudflare/workers/carrot-carrot-api
wrangler secret put APPS_IN_TOSS_DECRYPTION_KEY < ../../../.secrets/decryption.b64

# 4) AAD 도 의심되면 wrangler.toml [vars] 의 APPS_IN_TOSS_DECRYPTION_AAD 값
#    (현재 "TOSS") 이 토스 이메일과 정확히 일치하는지 확인. 다르면 wrangler.toml
#    수정 후 wrangler deploy.
```

`SERVER_ENV_MISSING` 코드는 secret 자체가 등록되어 있지 않거나 base64 디코딩
결과가 32B 가 아닌 경우다 — 위 1)~3) 을 그대로 진행하면 해결된다.

---

## 10. JWT_SECRET 생성 + 등록

```bash
openssl rand -hex 32 | wrangler secret put JWT_SECRET
```

**성공 출력 예**:

```
🌀 Creating the secret for the Worker "carrot-carrot-api"
✨ Success! Uploaded secret JWT_SECRET
```

**실패 체크포인트**: `openssl: command not found` → macOS 는 기본 설치, Linux 는
`apt install openssl`. 또는 `head -c 32 /dev/urandom | xxd -p -c 64` 로 대체.

---

## 11. wrangler deploy --dry-run (충돌 체크)

```bash
cd cloudflare/workers/carrot-carrot-api
wrangler deploy --dry-run
```

**성공 출력 예**:

```
Total Upload: 250.45 KiB / gzip: 80.12 KiB
--dry-run: exiting now.
```

업로드는 일어나지 않는다. TypeScript 빌드/번들 에러만 검사한다.

**실패 체크포인트**:

- `Cannot find module 'hono'` → `npm install` 미실행. worker 디렉토리에서 다시.
- `placeholder ... is not a valid UUID` → wrangler.toml 의 `database_id` /
  `certificate_id` 가 아직 PLACEHOLDER. 7, 6 번 결과를 박아넣어야 한다.

---

## 12. wrangler deploy (실제 배포)

```bash
cd cloudflare/workers/carrot-carrot-api
wrangler deploy
```

**성공 출력 예**:

```
Total Upload: 250.45 KiB / gzip: 80.12 KiB
Uploaded carrot-carrot-api (1.8 sec)
Published carrot-carrot-api (0.2 sec)
  https://carrot-carrot-api.<account-subdomain>.workers.dev
Current Deployment ID: 7f1a...
```

`https://carrot-carrot-api.<account-subdomain>.workers.dev` URL 을 복사해 둔다 —
다음 단계에서 `.env.production` 에 박는다.

`/health` 로 살아있는지 확인:

```bash
curl https://carrot-carrot-api.<account-subdomain>.workers.dev/health
# {"ok":true,"time":"2026-05-04T..."}
```

**실패 체크포인트**: `colortherapy-toss` 와 이름이 다르므로 충돌 없음. 만약 동일
계정에 같은 이름의 Worker 가 있으면 덮어쓴다 → 본 작업은 신규 이름이라 해당 없음.

---

## 13. `.env.production` 에 Worker URL 입력

레포 루트에 `.env.production` 파일을 만들고 (이미 `.gitignore` 됨):

```bash
cat > .env.production <<'EOF'
VITE_MOCK_AUTH=false
VITE_USE_MOCK_LOGIN=false
VITE_TOSS_AUTH_MOCK=false
VITE_TOSS_AD_MOCK=false
VITE_APPS_IN_TOSS_PROXY_URL=https://carrot-carrot-api.<account-subdomain>.workers.dev
APPS_IN_TOSS_BRAND_ICON_URL=
EOF
```

`<account-subdomain>` 부분을 12번에서 복사한 실제 값으로 바꾼다.

---

## 14. Apps in Toss 콘솔 — 브랜드 아이콘 업로드

1. 브라우저에서 Apps in Toss 개발자 콘솔 접속 → "carrot-carrot" 앱 → 앱 정보 → 아이콘.
2. **`assets/app-icon-console-600.jpg`** (600×600 JPEG) 를 업로드.
   콘솔에 이미 등록된 아이콘과 동일한 원본 파일이다. 다른 파일 (예:
   `app-icon-1024.png`) 을 올리면 granite.config.ts 의 brand.icon 과
   어긋나 심사에서 거부된다.
3. 콘솔이 발급한 CDN URL 을 복사 (예: `https://static.toss.im/3rd-party/.../<hash>.jpg`).
4. `.env.production` 의 `APPS_IN_TOSS_BRAND_ICON_URL` 에 붙여넣는다.

`granite.config.ts` 와 `scripts/check-build-env.mjs` 가 다음을 강제한다:

- env 미설정 → 빌드 거부.
- `REPLACE_WITH_CONSOLE_ICON_URL` placeholder → 빌드 거부.
- https:// 로 시작하지 않으면 → 빌드 거부.

`scripts/run-ait-build.mjs` 가 `.env.production` 을 로드해 granite.config.ts
가 보는 `process.env.APPS_IN_TOSS_BRAND_ICON_URL` 에 주입하므로, env 만 채우면
`npm run build:ait` 만으로 끝난다.

---

## 15. 프론트엔드 빌드 (.ait)

```bash
# 레포 루트에서
npm install
npm run build:ait
```

**성공 출력 예**:

```
ait build: wrote carrot-carrot.ait (17.0 MiB)
```

프로젝트 루트에 `carrot-carrot.ait` 파일이 생성된다.

---

## 16. .ait 파일 Apps in Toss 콘솔 업로드

1. Apps in Toss 콘솔 → carrot-carrot → 빌드 업로드.
2. 위에서 생긴 `carrot-carrot.ait` 파일 선택 → 업로드.
3. 심사/배포 절차는 콘솔 가이드에 따른다.

업로드 직전 체크리스트:

- [ ] `.env.production` 의 `VITE_APPS_IN_TOSS_PROXY_URL` 이 실제 deployed Worker URL.
- [ ] `APPS_IN_TOSS_BRAND_ICON_URL` 이 콘솔에 등록된 실제 아이콘 URL.
- [ ] `wrangler deploy` 완료 + `/health` 200 확인.
- [ ] `wrangler d1 migrations apply ... --remote` 완료.

---

## 부록 A. 시크릿/인증서 보관 정책

| 자산                                | 보관 위치                              | 절대 안 되는 곳            |
| ----------------------------------- | -------------------------------------- | -------------------------- |
| toss-mtls.crt / toss-mtls.key (PEM) | `.secrets/` 또는 1Password             | git, .env*, listing-assets |
| APPS_IN_TOSS_DECRYPTION_KEY         | `wrangler secret put` (Worker secret)  | git, .env*, 코드 안        |
| JWT_SECRET                          | `wrangler secret put` (Worker secret)  | git, .env*, 코드 안        |
| Worker URL (VITE_APPS_IN_TOSS_..)   | `.env.production`                      | 안전 (공개됨)              |
| 광고 그룹 ID (VITE_TOSS_AD_GROUP)   | 코드 기본값 + `.env.production` 옵션   | 안전 (공개 식별자)         |
| BRAND_ICON_URL                      | `.env.production`                      | 안전 (공개됨)              |

## 부록 A-2. CORS 허용 origin 목록

`carrot-carrot-api` Worker (`cloudflare/workers/carrot-carrot-api/src/index.ts`) 가
허용하는 origin:

| 종류        | 값                                                                  |
| ----------- | ------------------------------------------------------------------- |
| exact       | `https://apps-in-toss.com`, `https://www.apps-in-toss.com`          |
| exact       | `https://toss.im`, `https://www.toss.im`                            |
| exact       | `http://localhost:5173`, `http://127.0.0.1:5173` (vite dev)         |
| exact       | `http://localhost:4173`, `http://127.0.0.1:4173` (vite preview)     |
| suffix      | `https://*.toss.im`                                                 |
| suffix      | `https://*.apps-in-toss.com`                                        |

쿠키를 쓰지 않고 `Authorization: Bearer` 헤더만 사용하므로 `Allow-Credentials`
는 보내지 않는다. 알 수 없는 origin 은 `Access-Control-Allow-Origin` 을 비워서
브라우저가 차단하도록 둔다.

### preflight 검증 방법

배포 후 실제 Worker URL 로 다음 명령을 돌려 모든 origin 이 통과하는지 확인한다:

```bash
WORKER=https://carrot-carrot-api.<account>.workers.dev

for ORIGIN in \
  https://apps-in-toss.com \
  https://www.apps-in-toss.com \
  https://toss.im \
  https://www.toss.im \
  https://kr.toss.im ; do
  echo "--- $ORIGIN"
  curl -sS -i -X OPTIONS "$WORKER/login" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: authorization,content-type" \
    | grep -i "^access-control-"
done
```

성공 응답에는 모든 항목에서 `Access-Control-Allow-Origin: <ORIGIN>`,
`Access-Control-Allow-Methods: GET,POST,OPTIONS`,
`Access-Control-Allow-Headers: authorization,content-type,...` 가 포함되어야 한다.

`/login` 외에도 `/me`, `/refresh`, `/unlink` 에 대해 동일하게 동작한다 (전역
`app.use("*", cors(...))` 로 묶여 있음).

## 부록 B. 자주 쓰는 명령어 (cheat sheet)

```bash
# Worker 로그 실시간 확인
wrangler tail carrot-carrot-api

# D1 스키마 점검
wrangler d1 execute carrot-carrot-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"

# 시크릿 목록
wrangler secret list

# mTLS 인증서 목록
wrangler mtls-certificate list
```
