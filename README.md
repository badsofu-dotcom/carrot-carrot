<img src="public/icons/app-icon-512.png" width="120" alt="버니타임 앱 아이콘" />

# 버니타임 (Bunny Time) 🥕

> 악동 토끼와 함께하는 25분 집중 타이머 🥕 — 토스 미니앱 v1.0.

**한 줄 소개:** 악동 토끼와 함께하는 25분 집중 타이머 🥕.
**카테고리:** 집중 / 생산성 도구 (게임물 분류 아님 — 보상 정책 공시 [`src/legal/reward-disclosure.md`](./src/legal/reward-disclosure.md)).
**제출 가이드:** [`DEPLOY.md`](./DEPLOY.md) 참고.

## 단계 로드맵

| 단계 | 범위 | 상태 |
| --- | --- | --- |
| 1단계 | 프로젝트 셋업, 디자인 토큰, 라우팅, mock 로그인, 자산 import | ✅ 완료 |
| 2단계 | UI/디자인 시스템 정비 | ✅ 완료 |
| 3단계 | Supabase 스키마/RLS, Edge Functions, Toss appLogin 어댑터, offline-first 골격 | ✅ 완료 |
| 4단계 | 집중 타이머/세션 로깅/컬렉션 획득 (Edge Functions 사용) | ✅ 완료 |
| 5단계 | 도감 rarity / unlock 오버레이 | ✅ 완료 |
| 6단계 | 리포트 차트 + 공유 카드 PNG | ✅ 완료 |
| 7단계 | 온보딩 polish, push 스캐폴드, 제출 자산, v1.0 | ✅ 완료 |
| **7.7단계** | **온보딩 폐기, 타이머 재설계, 토끼 등장 확대** | **✅ 완료** |

## 빠른 실행

```bash
npm install
cp .env.example .env.local   # mock 로그인 기본값 OK
npm run dev                  # http://localhost:5173
npm run build                # 타입체크 + 프로덕션 빌드
npm run preview              # 빌드 결과물 미리보기
npm run build:submit         # 제출용 zip 생성 (dist-submit/carrot-carrot-submit.zip)
npm run assets:optimize      # 새 토끼/앱 아이콘 원본 → WebP 자동 최적화
```

> 자산 추가 시: 토끼 PNG/JPG 원본을 `assets/characters-source/` 에 두고
> `npm run assets:optimize` 를 실행하면 `src/assets/characters/<stem>{,@2x}.webp`
> 가 생성된다 (1080×1080 기준 ≤80KB). 같은 이름의 .webp 가 이미 있으면 보호되며
> `--force` 플래그로만 덮어쓴다. 자세한 가이드는
> [`assets/characters-source/README.md`](./assets/characters-source/README.md).

> ⚠️ 라우팅은 **hash routing** (`/#/`, `/#/collection`, `/#/report`, `/#/settings`). 토스 미니앱 / iframe 호스팅에서 안전하다. 온보딩 페이지는 Phase 7.7 에서 폐기되고, 스플래시 → 홈 → 토스 자동 로그인 흐름로 대체되었다.

## 주요 의존성

| 라이브러리 | 용도 |
| --- | --- |
| `react`, `react-dom` | UI |
| `wouter` (with `useHashLocation`) | 가벼운 hash 라우팅 |
| `zustand` | 글로벌 상태 (사용자, 세션) |
| `framer-motion` | 인터랙션/모달 애니메이션 |
| `lucide-react` | 아이콘 |
| `html2canvas` | 4단계 공유 카드 캡처 |
| `@apps-in-toss/web-framework` | 토스 미니앱 SDK (3단계 실연동) |

## 폴더 구조

```
carrot-carrot/
├── src/
│   ├── assets/characters/        # 토끼 12종 + index.ts (import 매핑)
│   ├── components/               # Bunny, TabBar 등 공용 UI
│   ├── hooks/                    # 커스텀 훅 (예약)
│   ├── lib/                      # toss.ts (mock 로그인 어댑터)
│   ├── pages/                    # Home / Collection / Report / Settings / NotFound
│   ├── store/                    # zustand 스토어
│   ├── styles/                   # tokens.css, global.css
│   └── types/                    # 공용 타입 (예약)
├── .env.example                  # 환경변수 템플릿
├── index.html                    # 메타 태그, 한국어 lang
└── vite.config.ts                # base="./" + @ alias
```

## 디자인 토큰

`src/styles/tokens.css` 참고. 사용자 가이드를 그대로 반영:

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--color-cream` | `#FFF8E7` | 기본 배경 |
| `--color-card` | `#F4E4C1` | 카드 표면 |
| `--color-carrot` | `#FF6B35` | CTA, 강조 |
| `--color-demon` | `#C73E1D` | 위험/악동 강조 |
| `--color-text` | `#2D2D2D` | 본문 |

폰트: **Pretendard Variable** (CDN), 시스템 한국어 폰트 fallback.

토끼 그림에는 `bunny-breathe` 클래스로 호흡 애니메이션 기본 적용.

## 톤 가이드 (코드/카피 작성 시)

- 어미: `흐흐`, `킥킥`, `~당근`, `내꺼야`
- 절대 금지: 파스텔 착한 말투, 격려체, 따뜻한 코칭 어조
- 표정: 음흉하고 사랑스럽게. 협박은 절대 진지하지 않게.

## 토끼 자산 매핑

원본은 `.jpg` 12장 (`bunny_*.jpg`). 모두 `src/assets/characters/` 에 저장되어 있으며,
`src/assets/characters/index.ts` 가 `bunnyImages` 객체로 묶어 import 가능하게 한다.

```ts
import { bunnyImages, getEatBunny } from "@/assets/characters";
<img src={bunnyImages.idle} />
<img src={bunnyImages[getEatBunny(progress)]} />
```

상태 → 그림 매핑:

| 상태 | 키 |
| --- | --- |
| 대기 | `idle` |
| 집중 중 | `focus` |
| 식사 25/50/75% | `eat25` / `eat50` / `eat75` |
| 완료 | `success` |
| 잠 | `sleep` |
| 실패/슬픔 | `cry` |
| 레어 | `rare_king`, `rare_ninja`, `rare_wizard` |
| 레전더리 | `legendary_demon` |

## Phase 3 — 인증 + 백엔드 골격

### 아키텍처

```
[ Apps in Toss WebView ] --appLogin()--> [ Cloudflare Worker /login ]
  (browser fallback: mock)                  |
                                            v
                                  [ env.TOSS_MTLS.fetch() — mTLS ]
                                            |
                                            v
                              [ Apps in Toss OAuth (generate-token, login-me) ]
                                            |
                                            v
                                  [ AES-GCM userKey 복호화 ]
                                            |
                                            v
                                       [ D1 upsert ]
                                            |
                                            v
                                    [ 자체 JWT (HS256) ]
                                            |
[ React app ] --Bearer JWT--<--/login, /me, /refresh, /unlink, /health
```

- 자체 발급 HS256 JWT 사용 (`JWT_SECRET` 로 서명, Worker secret).
- Apps in Toss `userKey` 는 Worker 가 mTLS 로 받아 AES-GCM 복호화 후 D1 PK 로 저장.
- 클라이언트는 throw-free `ApiResult<T>` 만 본다 → 네트워크 실패 시 mock 데이터 유지.
- `VITE_MOCK_AUTH=true` 또는 Apps in Toss 환경이 아니면 mock 모드. 운영 빌드만 `false`.

### 디렉토리

```
cloudflare/workers/carrot-carrot-api/
├── src/
│   ├── index.ts                   # Hono entry + CORS
│   ├── routes/
│   │   ├── login.ts               # POST /login : authorizationCode -> JWT
│   │   ├── me.ts                  # GET  /me    : Bearer JWT -> 사용자/스탯
│   │   ├── refresh.ts             # POST /refresh : 토스 refreshToken -> JWT 재발급
│   │   ├── unlink.ts              # POST /unlink  : 탈퇴 (D1 cascade delete)
│   │   └── health.ts              # GET  /health  : { ok:true, time }
│   ├── lib/
│   │   ├── toss.ts                # env.TOSS_MTLS.fetch() 토스 OAuth 호출
│   │   ├── decrypt.ts             # AES-256-GCM userKey 복호화
│   │   ├── jwt.ts                 # jose HS256 sign/verify
│   │   └── db.ts                  # D1 헬퍼 (upsert/조회/cascade delete)
│   └── types.ts                   # Env / payload 타입
├── migrations/0001_init.sql       # users / focus_sessions / carrot_collection / unlocked_sounds
├── wrangler.toml                  # name, D1, mTLS, vars
├── package.json                   # hono / jose / wrangler
└── tsconfig.json

src/
├── lib/
│   ├── api.ts                     # apiCall + tokenStore (Worker JWT 단일 토큰)
│   ├── appsInTossLogin.ts         # SDK appLogin() -> Worker /login
│   ├── toss.ts                    # appLoginRequest mock fallback
│   ├── tossRewardedAd.ts          # 보상형 광고 (공식 그룹 ID 기본값)
│   ├── safeStorage.ts             # localStorage throw-free
│   └── offlineQueue.ts            # send-or-queue mutation 큐
├── services/
│   └── authService.ts             # initAuth / loginWithToss / logout / fetchMe
└── store/userStore.ts             # auth + stats (서버 실패 시 mock 유지)
```

### 로컬 개발

```bash
# 1) 프론트엔드
npm install
npm run dev          # vite 5173

# 2) Worker (별도 터미널, 옵션)
cd cloudflare/workers/carrot-carrot-api
npm install
wrangler dev         # http://127.0.0.1:8787
#   .env.local 에 VITE_APPS_IN_TOSS_PROXY_URL=http://127.0.0.1:8787 두고 vite 재시작
```

운영 배포 절차는 [`docs/SETUP_FOR_USER.md`](./docs/SETUP_FOR_USER.md) 참고.

### 보상형 광고 / 브랜드 아이콘

- 공식 그룹 ID `ait.v2.live.146b65d064c2402e` 가 코드 기본값. `VITE_TOSS_AD_GROUP_ID`
  로 덮어쓸 수 있다.
- `granite.config.ts` 가 `APPS_IN_TOSS_BRAND_ICON_URL` env 를 그대로 읽어 콘솔
  메타에 박는다. 콘솔 아이콘 슬롯에 `assets/app-icon-console-600.jpg`
  (600×600 JPEG) 를 업로드한 뒤 발급된 CDN URL 을 `.env.production` 에
  채운다. placeholder/비어있음/비-https 는 빌드 가드가 거부한다.

### 게스트 / 오프라인 동작

- `VITE_APPS_IN_TOSS_PROXY_URL` 가 비어 있거나 호출이 실패하면 `ApiResult` 가
  `ok:false (no_api_base)` 또는 네트워크 에러로 리턴 → UI 는 mock 데이터로 동작.
- 401 시에는 토큰을 비우고 `loginWithToss()` 재시도가 가능하다.

## 라이선스

Internal.

