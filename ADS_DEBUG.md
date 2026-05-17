# ADS_DEBUG.md — 광고 진단 가이드 (Round 20 PR-139)

베타6 사용자 피드백: "광고가 재생 안 됨". 코드 흐름 추적 + 사용자가
콘솔에서 확인해야 할 외부 의존성 정리.

## 1. 코드 흐름 (요약)

`AdPassModal` (또는 다른 광고 트리거) → `watchRewardedAd()` →

```
[ad/diag] watchRewardedAd called { mockForced, tossLike, adGroup }
  ↓ mockForced && !tossLike → simulated (mock fallback)
  ↓
[ad/diag] SDK ready — load + show isSupported=true, calling load…
  ↓ loadFn({ adGroupId, onEvent, onError })
[ad/diag] load event: loaded            ← 정상 흐름
  ↓ showFn({ adGroupId, onEvent, onError })
[ad/diag] show event: userEarnedReward  ← 보상 지급
  → kind: granted
```

실패 분기:
- `[ad/diag] mock forced (non-toss env) → simulated` — preview/외부 브라우저
- `[ad/diag] adGroupId empty → simulated` — env / 코드 상수 둘 다 빔
- `[ad/diag] SDK isSupported() false → simulated` — WebView 가 토스앱 아님
- `[ad/diag] load error: ...` — 콘솔 측 그룹 비활성 / 미디에이션 응답 X
- `[ad/diag] show error: ...` — 광고 fill 실패 / 네트워크
- `[ad/diag] show event: failedToShow` — SDK 가 보고한 표시 실패
- `[ad/diag] show event: dismissed` (without earned reward) — 사용자 X 닫음

## 2. 디바이스에서 로그 확인 방법

### Apps in Toss WebView (실 디바이스)

방법 A — Chrome remote debugging:
1. Android 디바이스 + Chrome PC `chrome://inspect`
2. 토스 앱 → 버니타임 → 광고 시도
3. 콘솔에서 `[ad/diag]` 필터

방법 B — 콘솔 SDK 직접 조회:
- Apps in Toss 콘솔 → "버니타임" → 광고 그룹 상태 (활성 / 비활성)

### Cloudflare Worker tail
```bash
cd cloudflare/workers/carrot-carrot-api
npx wrangler tail carrot-carrot-api --format pretty
```
→ 광고는 워커를 안 거쳐서 worker tail 에는 안 보임. 클라이언트 콘솔만.

## 3. 사용자(메인테이너) 가 콘솔에서 확인할 체크리스트

| 항목 | 확인 방법 | 정상 |
| --- | --- | --- |
| **광고 그룹 활성화** | Apps in Toss 콘솔 → 광고 → `ait.v2.live.146b65d064c2402e` (보상형) | 상태 "활성" |
| **베타 채널 노출** | 콘솔 → 광고 그룹 → 노출 채널 | "베타" 포함 |
| **미디에이션 네트워크** | 콘솔 → 광고 그룹 → 연결 네트워크 | Pangle / AppLovin / Meta 등 ≥1 활성 |
| **빌드 deploymentId 활성** | 콘솔 → 빌드 → 활성 deploymentId 가 최신 (`019e...`) 인지 | 최신 round 의 id |
| **사용자 토스 앱 버전** | 토스 앱 → 설정 → 버전 | 최신 (광고 SDK 포함 버전) |

## 4. 코드에 박힌 광고 ID

```
src/lib/tossRewardedAd.ts:26
  DEFAULT_AD_GROUP_ID = "ait.v2.live.146b65d064c2402e"   ← 보상형 (사용 중)
```

env 로 override 가능:
- `VITE_TOSS_AD_GROUP_ID` (현재 ID)
- `VITE_TOSS_AD_INTERSTITIAL_ID` (전면형 — 코드 wire X, Round 21+ 예정)
- `VITE_TOSS_AD_BANNER_ID` (배너형 — 동일)

## 5. 빠른 진단 절차

베타 디바이스에서 광고 안 나오면 순서대로:

1. **Chrome inspect** → `[ad/diag] watchRewardedAd called` 보이는지
   - 안 보임 → 호출 자체가 안 됨 → AdPassModal 흐름 확인
2. **`adGroup`** 값 확인 → `ait.v2.live.146b65d064c2402e` 인지
   - 다르면 → .env.production 오염 또는 빌드 캐시
3. **`tossLike: true`** 확인 → false 면 WebView 가 토스 앱 안 아님
4. **`SDK isSupported`** false → 토스 앱 자체가 광고 SDK 미포함 버전
5. **`load error`** 메시지 → 콘솔 측 그룹 상태 / 미디에이션 fill 확인

## 6. 자주 보는 에러 메시지 매칭

| 메시지 | 의미 | 조치 |
| --- | --- | --- |
| `No fill` / `NO_FILL` | 미디에이션 네트워크가 광고를 안 줌 | 콘솔에서 추가 네트워크 활성화 / 사용자 지역/타깃 변경 |
| `Ad group not found` | adGroupId 가 콘솔에 없음 | ID 확인 + 콘솔 등록 |
| `Ad group inactive` | 그룹 비활성 | 콘솔에서 활성화 |
| `network error` / `fetch failed` | 디바이스 네트워크 | Wi-Fi / LTE 확인 |
| `Not supported` | 외부 브라우저 (토스 앱 X) | 토스 앱에서 실행 |

## 7. 전면형/배너형 (Round 21+ 예정)

env 메모만 해둠 — 코드 wire 안 됨:
- 전면형: `ait.v2.live.501716299c57434b` (예: 5세션 완료 시)
- 배너형: `ait.v2.live.4dd2294692cd4ebb` (예: 도감 페이지 하단)

지금 호출하면 `Ad group not found` 또는 SDK 미인식.

---

*마지막 갱신: Round 20 / PR-139 (2026-05-17)*
