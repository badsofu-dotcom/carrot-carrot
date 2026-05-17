# IMPLEMENTATION_REPORT_PR-88.md — 물뿌리개 칩 옵션 C

## 결정 (자율) — 3-state badge + select 차단

### Badge state 매트릭스

| wateringLeft | Badge value | Badge bg | Chip cursor | Click 동작 |
| --- | --- | --- | --- | --- |
| > 5 (정상) | `"N"` | white | pointer | 선택 토글 |
| 1..5 (경고) | `"N"` | `#FFE3A8` (soft amber) | pointer | 선택 토글 |
| 0 (도달) | `"끝"` | grey | not-allowed | 토스트 + 선택 차단 |

이전 (PR-86 까지): `"N/10"` 고정 표기. PR-78 의 soup buff 로 11/10 도 가능 (분모 misleading) + 5 이하 경고 없음 + 0 일 때도 select 가능 (사용 시점에야 좌절).

### 0 시 토스트

```
"오늘 10회 다 썼어요. 자정에 다시 채워져요"
```

`onSelect` 가드 — `t.id === "watering_can" && wateringLeft <= 0` 면 toast 후 early-return.

## 변경

### ToolDock.tsx

| 부분 | 변경 |
| --- | --- |
| Badge value | `"${wateringLeft}/10"` → `wateringLeft === 0 ? "끝" : String(wateringLeft)` |
| Badge bg | 항상 `#fff` → 3-state (`grey` / `amber` / `white`) |
| Badge color | 항상 `#222` → disabled 시 `#888` |
| Chip cursor | 항상 pointer → `wateringDisabled` 시 `not-allowed` |
| Chip opacity | 항상 1 → `wateringDisabled` 시 `0.45` |
| onSelect 가드 | 없음 | 0 시 토스트 + early-return |
| aria-label | `"물뿌리개"` (정적) | 3-state 동적 |

### Aria-label 3-state

- 0: `"물뿌리개 — 오늘 사용 한도 도달"`
- 1..5: `"물뿌리개 — N회 남음 (오늘 마지막)"`
- 6+: `"물뿌리개 — N회 남음"`

## 왜 "끝" 텍스트?

옵션 후보:
- `"0"` — 일반적이지만 임계 상태 차분이 약함
- `"끝"` — 한국어 직관 (이미 사용한 만큼 끝남 의미)
- `"DONE"` — 영어 토큰 (PR-73~77 의 한국어 정책 위반)
- 빈 badge — 사용자가 "왜 안 되지?" 혼란

`"끝"` 선택: 1글자 / 한국어 / 명료. 토스트가 보충 설명.

## 왜 "분모 /10 제거"?

- soup buff (PR-9) 적용 시 wateringCanLeft 가 11 까지 갈 수 있음 → "11/10" 비논리
- 보유량 (잔여 횟수) 만으로 인지 충분 (max 가 알아서 cap)
- max 가 동적 (10 + bonus) 이라 정적 분모 표기 부적합

## 변경 파일

- `src/components/Farm/ToolDock.tsx` — badge logic + chip cursor/opacity + select guard + aria-label

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 188 / 188 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
