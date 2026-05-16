# IMPLEMENTATION_REPORT_PR-15.md — SkyView 진입 시 cloud haze 제거

농장의 always-on 구름 패럴랙스가 SkyView 풀화면에서도 함께 렌더되어 별/달 가시성을 흐림. SkyView 의 Atmosphere instance 에 `noClouds` 옵션 전달.

## A. 진단

`src/components/Farm/Atmosphere.tsx:58-72` 의 cloud 패럴랙스 div 는 `radial-gradient` 흰색 + `opacity: 0.6` + 70s 무한 드리프트 — **이게 사용자가 보는 "뿌연 haze"**.

Atmosphere 는 두 곳에서 마운트:
- `FarmHub.tsx:563` → 농장 카드 내 — **이건 디자인 의도, 유지**
- `SkyView.tsx:268` → 풀화면 SkyView 내 — **별/달 흐림의 원인**

## B. 해법

Atmosphere 에 옵셔널 `noClouds: boolean` prop (default false). 일반 호출은 변경 없음. SkyView 만 `<Atmosphere variant={variant} noClouds />` 로 전달.

weather 입자 (rain / snow / cherry / autumn) 는 노이즈 없이 그대로 — "비 오는 밤 별빛" 같은 분위기 케이스 보존.

## C. 변경 파일

1. **`src/components/Farm/Atmosphere.tsx`**:
   - `Atmosphere` props 시그니처 확장 — `noClouds?: boolean` 추가.
   - cloud 패럴랙스 div 를 `{!noClouds && ( ... )}` 로 감쌈.
   - 클라우드 div 에 `data-testid="atmosphere-clouds"` 추가 (회귀 테스트용).
2. **`src/components/Farm/SkyView.tsx`** 268라인 부근:
   - `<Atmosphere variant={variant} />` → `<Atmosphere variant={variant} noClouds />`.
   - 인라인 주석으로 PR-15 의도 명시.

FarmHub 의 Atmosphere 호출 (line 563) 은 **변경 없음** — 농장 카드의 haze 는 사용자가 명시적으로 OK 함.

## D. 검증

코드 리뷰 기반 시각 추정:
- SkyView open ⇒ cloud div 마운트 안 됨 ⇒ 화면에서 흰색 radial 글로우 없음 ⇒ 배경 sky 이미지 + 별/달 그대로 보임.
- SkyView close ⇒ FarmHub 의 Atmosphere 그대로 ⇒ 농장 카드 cloud 효과 복귀.
- 비/눈/꽃잎/낙엽 (weather variant) 은 SkyView 내에서도 정상 표시.

## E. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **93/93 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |

## F. Maintainer 후속 조치

없음. CSS 조건부 렌더링 단일 변경.

## G. 다음 작업

PR-16 — 농장 ↔ SkyView 스와이프 전환 (touch up/down + wheel).
