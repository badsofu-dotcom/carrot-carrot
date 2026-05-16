# IMPLEMENTATION_REPORT_PR-25.md — DEV "모든 자원" 풀스택 보강

PR-19 의 `handleAllResources999` 가 farm currency 5 + star/gem 만 채우고 도구 아이템 (juice/soup/cake/hourglass/bolt), 컬렉션 (medal/heart), 워터링 캔, 메달 unlock 을 빠뜨림.

## 변경

`src/features/dev/DevActionsGroup.tsx` 의 `handleAllResources999` 확장:

| 카테고리 | 채움 |
| --- | --- |
| Farm currency | carrots +999, candyCarrots +999, goldenCarrots +999, seeds +999 |
| Bag items | carrot_coin/hourglass/bolt/juice/soup/cake/medal/star/gem/heart 전부 +N (currency 3 종은 farmStore SoT 이므로 중복 카운트 회피) |
| Tools | wateringCanLeft → MAX_DAILY |
| Medals | 정의된 11 IDs 전부 unlock |
| Toast | "모든 자원/도구/메달 +max" |

idempotent — 재탭 시 자연 top-up.

별도 "도구 아이템 충전" 액션은 그대로 유지 — 타깃 충전 use case.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

DCE 영향 없음 — 이미 PR-19 의 `import.meta.env.DEV` 가드 하에 있음.

## 다음 작업

PR-26 (훈장 위치 이동).
