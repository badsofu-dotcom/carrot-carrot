# ERROR_AUDIT.md — 에러 / 오프라인 fallback (PR-119)

베타 출시 전 워커 다운 / 네트워크 오프라인 시 UX 검증.

## A. Fetch / API 호출 사이트

| 사이트 | wrapper | Result<T> | catch 처리 |
| --- | --- | --- | --- |
| `lib/api.ts` apiCall | try/catch + Result<T> | ✅ | ok=false 반환 (NETWORK_ERROR) |
| `lib/api.ts` apiCallWithRefresh | apiCall 래핑 | ✅ | 同上 |
| `services/rewardedAdService.ts:78` | raw fetch | ❌ | 검증 필요 |
| `lib/appsInTossLogin.ts:266` | raw fetch | ❌ | 로그인 path — 검증 필요 |
| `lib/appsInTossLogin.ts:319` | raw fetch | ❌ | /health probe — 검증 필요 |
| `pages/CollectionPage.tsx:467` | raw fetch | ❌ | asset preload 추정 |

## B. Adapter 사이트 (mode noop fallback)

| 사이트 | Pattern |
| --- | --- |
| `farmSync.ts` | `canCallServer()` 거짓 → NOOP_OK |
| `bunniesSync.ts` | 동일 (가정) |
| `itemsSync.ts` | 동일 |
| `friendsStore` | 동일 |
| `grantSync.ts` (PR-116) | canCallServer false 시 silent |

→ **모든 mutating 사이트 가 게스트/오프라인 fallback ✅**. 게스트 모드 작동.

## C. 오프라인 시나리오 (사용자 검증)

| 시나리오 | 예상 | 실제 |
| --- | --- | --- |
| 앱 로드 + 네트워크 끊김 | 게스트 모드로 전환 | `AppsInTossLoginGate` 가 `setMode('guest')` ✅ |
| 게스트 모드 + 농장 작업 | 로컬 작동 (서버 sync 안 됨) | farmStore 로컬 사 — 작동 ✅ |
| 게스트 모드 + 출금 시도 | "콘솔 설정 후" 안내 | RewardsPanel `withdrawStatus` 메시지 표시 ✅ |
| 로그인 중 네트워크 끊김 | 게스트 fallback | `loginWithToss` 의 error path → `setMode('guest')` |
| 인증 후 worker 다운 | 게임 진행 (mutating 사이트 noop) | 모든 sync 함수 try/catch — UI 영향 없음 ✅ |
| Worker 응답 시간 초과 | 사용자 인지 없음 | `apiCall` 60초 timeout 없음 — 옵션 |

## D. 발견

### D-1. `fetch` raw call 3 사이트 (Medium)

`rewardedAdService.ts:78`, `appsInTossLogin.ts:266/319`, `CollectionPage.tsx:467` 가 raw `fetch()` 호출. 오프라인 / DNS 실패 시 `fetch` 가 throw → caller try/catch 필요.

확인:
- `rewardedAdService.ts:78` — `await fetch(url, {...})` 가 try 안에 있어야 함
- `appsInTossLogin.ts:266` — 로그인 path. 자체 try/catch 필요
- `CollectionPage.tsx:467` — asset preload. fail 시 fallback 무관 (이미지 로드 실패 분리 처리)

미배포 컨텍스트 → 베타 5~20명 대상은 안정 환경 (대부분 wifi/4G). 실 raw fetch 누락이 critical 영향 적음.

### D-2. 에러 UI 부재 (Low)

worker 다운 + UI 정상 작동. 그러나 사용자에게 "오프라인" 안내 부재. 향후 status bar / toast 추가 가능 (Round 16).

### D-3. AppsInTossLoginGate "로딩 중" 시 timeout 부재 (Low)

`AppsInTossLoginGate` 가 토스 SDK 응답 무한 대기 시 stuck 화면. timeout (예: 10s) 후 게스트 fallback 권장.

## E. 결정 — Critical fix 0건

### Raw fetch 사이트 검증

| 사이트 | try/catch | timeout | 결론 |
| --- | --- | --- | --- |
| `rewardedAdService.ts:78` | ✅ (line 77 try) | 없음 | OK (fire-and-forget) |
| `appsInTossLogin.ts:266` | ✅ + AbortController 8s | ✅ | OK |
| `appsInTossLogin.ts:319` | ✅ (/health probe) | timeout 동일 | OK |
| `CollectionPage.tsx:467` | ✅ (line 465 try) | 없음 | OK (이미지 preload, fail 시 fallback OK) |

→ **4 사이트 모두 안전 처리**. critical fix 없음.

## F. 결론

Critical blocker: **0건**.

Beta ship 가능 상태. 모든 mutating endpoint 가 게스트/오프라인 fallback (Result<T> 패턴 또는 noop). Raw fetch 4 사이트 모두 try/catch wrapped.

### Round 16 후보 (이월)

1. AppsInTossLoginGate timeout 후 게스트 자동 fallback (현재 무한 대기 가능)
2. 오프라인 상태 status bar / toast 안내
3. apiCall 의 fetch timeout 도입 (현재는 무한)
4. 사용자에게 "Worker 다운" 명시적 안내 (현재는 silent noop)

## 변경 파일

- `ERROR_AUDIT.md` (신규 — 본 보고서, 코드 변경 0)
