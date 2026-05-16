# IMPLEMENTATION_REPORT_PR-50.md — 토끼 도감 100마리 풀 정의

## 구조

`src/features/collection/bunnyDex.ts` (new) — 100 마리 `BunnyDexEntry` 정의.

각 entry: `{ id, name, rarity, season, theme, iconRel, lore }`.

### 분포 검증
- **Rarity**: common 60 / rare 25 / sr 10 / legendary **5** = 100
- **Season**: spring 25 / summer 25 / autumn 25 / winter 25 = 100
- **Legendary**: 4 시즌 × 1마리 + 여름 추가 1마리 (`baramnori-summer` 바람놀이 legendary) = 5

### Theme 다양화

forest / farm / sky / water / fire / ice / magic / myth 8 카테고리 mix.

## 자산 처리

`iconRel: assets/farm/bunnies/<id>.png` — 자산 부재 시 UI 컴포넌트가 onError fallback (PR-49 MedalIcon 패턴 차용). 본 PR 은 metadata-only 레이어 — `collectionData.CHARACTERS` 와 별도 surface. 향후 wire 시 통합 가능.

## 명명 패턴

- **common**: 의성어/의태어 (꼬물이/폴짝이/도토리 등) + 시즌 추가 ("-spring" suffix)
- **rare**: 특징/직업 (벗추기/햇늘이/북풍이)
- **sr**: 도사/마법사 등 (영춘이/얼음제/별자리)
- **legendary**: 보석 이름 (사파이어/루비/토파즈/다이아몬드 + 바람놀이)

이름 모두 한국어 고유 명사 / 의태어. 중복 없음 (id + name 모두 unique).

## 신규 파일

1. `src/features/collection/bunnyDex.ts` — 100 entries + helpers (`dexRarityCounts / dexSeasonCounts / DEX_BY_ID`)
2. `src/lib/bunnyDex.test.mjs` — 8 test (100마리 / rarity 60-25-10-5 / season 25 each / id/name 중복 없음 / lookup / 필드 검증 / legendary 5 + 4 unique seasons)

## 향후 wire (별도 PR)

`collectionData.CHARACTERS` 의 12 named + 88 placeholder 슬롯 시스템 → bunnyDex 의 100 마리로 통합. 본 PR 는 데이터 추가만, UI re-wire 없음 — collectionStore 의 ownedCharacters 는 기존 id 들을 그대로 사용. bunnyDex 의 신규 id 는 PR-35 HiddenBunnyLayer 의 풀에 추가 wire 가능.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **126/126 pass** (PR-50 bunnyDex +8) |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-53 (Push 알림 — Apps in Toss 환경 검증 + in-app fallback).
