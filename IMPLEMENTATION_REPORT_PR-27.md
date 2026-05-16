# IMPLEMENTATION_REPORT_PR-27.md — 자원 부족 광고 안내 팝업

워터링캔 잔여 0 인 상태에서 물주기 시도 시 toast 대신 광고 안내 모달.

## 컴포넌트

`src/components/Farm/AdSuggestionModal.tsx`:
- `cc:ad-suggest:open` 이벤트 listener — `{ resource, title, body }` detail.
- Spam guard: 같은 자원 5분 cooldown, 자원별 일일 3회 cap (KST). safeStorage keys `cc.adPrompt.lastShownAt.<r>` / `cc.adPrompt.dailyCount.<r>`.
- 광고 보기 버튼 → `cc:ad-channel:open` 으로 AdRewardChannelModal 호출.
- export 헬퍼 `shouldShowAdSuggestion(resource)` (pure) + `suggestAdFor(resource, title, body)` (dispatch + 가드 결과 반환).

## 트리거 사이트 (이번 PR)

- FarmHub watering tool 사용 시 spendWatering() === false 분기.
  - 가드 통과 → 모달 표시
  - 가드 차단 → fallback toast "오늘 물뿌리개를 다 썼어요 🥲"

추가 trigger (heart 0 / 도구 아이템 등) 는 후속 PR 에서 자원별로 wire 가능. 현재는 spam guard + 모달 인프라 + 최우선 trigger (watering) 만 ship.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 후속

새 라운드 PR-36 에서 본 모달 재검증 + heart 0 / 다른 자원 트리거 추가 예정.
