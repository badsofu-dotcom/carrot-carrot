# IMPLEMENTATION_REPORT_PR-107.md — 광고 칩 = 하트 토큰 표기 일치

## 동기

광고 칩이 🎬 (movie) 아이콘 + 숫자 badge "N" 만 표시 → 사용자가 "왜 자기 자원이 깎이지?" 인지 어려움. 하트 토큰 = 광고 시청 자격을 시각/언어로 명시.

## 결정 (자율) — composite badge

옵션 검토:
| 옵션 | Icon | Badge | aria-label |
| --- | --- | --- | --- |
| A. 하트 단일 | 🩷 | N | 광고 시청 (하트 N) |
| B. **composite** (채택) | 🎬 | 🩷 N | 광고 시청 (하트 N개 보유) |
| C. 가로 라벨 | 🎬 | "🩷 N · 광고" | (긴 라벨) |

**B 채택 이유**:
- 🎬 = 행위 (영상 시청)
- 🩷 = 자원 (하트 소비)
- composite 가 "광고 시청 → 하트 소비" 인과 명확

## 변경

### `ToolDock.tsx`

| 측면 | Before | After |
| --- | --- | --- |
| Badge value | `N` | `🩷 N` |
| Badge minWidth | 22 | 32 (emoji + 숫자 수용) |
| Badge gap | 0 | 2 (간격) |
| aria-label (heart>0) | `"광고 보고 보상 받기 (하트 N개)"` | `"광고 시청 (하트 N개 보유)"` |
| aria-label (heart=0) | `"광고 보상 — 하트 부족"` | `"광고 시청 — 하트 부족, 자정에 다시 채워져요"` |
| title (신규) | 없음 | `"광고 시청 (하트 N개)"` |
| 부족 토스트 | `"하트가 부족해요 — 내일 자정에 다시 채워져요"` | `"🩷 하트가 없어요. 자정에 다시 채워져요"` |

## 일관성

| 위치 | 하트 표기 |
| --- | --- |
| InventoryModal 토큰 탭 heart 카드 | `icon_heart_hp.png` + ko: "하트" |
| ToolDock 광고 칩 badge (PR-107) | `🩷 N` |
| 광고 부족 토스트 (PR-107) | `🩷 하트가 없어요` |
| AdRewardChannelModal | (광고 1회당 하트 -1) |

이제 모든 사이트가 동일 하트 토큰 메타포 사용.

## 변경 파일

- `src/components/Farm/ToolDock.tsx` — 광고 칩 (5th slot) badge / aria / title / 토스트

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 233 / 233 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
