# IMPLEMENTATION_REPORT_PR-78.md — 볼륨 슬라이더 + 진동 완전 제거

## 동기

학습 도구 톤 강화. 토글이 이미 ON/OFF 제어인데 볼륨 슬라이더 4개 (효과음 1, BGM 1) 는 사용 빈도 낮은 중복 UI. 진동은 학습 중 시각/촉각 노이즈.

## 변경

### Settings (`src/pages/SettingsPage.tsx`)

PR-69 후의 SoundNotifyGroup master 4개 → **3개**:

| 이전 (PR-69) | PR-78 |
| --- | --- |
| 🔔 알림 받기 | 🔔 알림 받기 |
| 🔊 효과음 + 볼륨 슬라이더 | 🔊 효과음 (토글만) |
| 🎵 농장 BGM + 볼륨 슬라이더 | 🎵 농장 BGM (토글만) |
| 📳 진동 | (제거) |

제거된 row:
- `SfxVolumeRow` — 함수 자체 제거 (호출자 없어짐)
- `FarmBgmVolumeRow` — 同上
- `HapticToggleRow` — 同上

상수 정리:
- `HAPTIC_KEY` 제거 (영속 데이터 없어짐, 구 v1 키는 사이드에 남고 무해)

### haptic 시스템 (`src/design-system/haptic.ts`)

**완전 no-op stub**:

```ts
export type HapticIntent = "light" | "medium" | "heavy" | "success" | "warning";
export function haptic(_intent: HapticIntent = "light"): void {
  // intentionally empty
}
```

이전 (PR-1~77): Web Vibration API / Toss SDK 진동 호출.
PR-78: 32개 caller 사이트 코드 변경 없이 자동으로 진동 disabled.

이 접근의 이점:
- caller 수정 0건 (32개 사이트 그대로)
- export 시그니처 유지 → typecheck 안전
- 향후 mission/session 클리어 햅틱이 의도된 UX 로 되돌리면 함수 본체만 수정

### 볼륨 default 유지

`soundStore.sfxVolume / farmBgmVolume` 상태는 그대로 (제거 안 함). 단순히 UI 가 사라짐. 사용자는 default volume (현재 값) 으로 재생되며 미세조절 불가. user spec: "내부 default volume 은 코드 상수로 유지 — 재생 시 그 값 사용".

## 테스트

### 신규 — `src/lib/haptic.test.mjs`

| 케이스 | 검증 |
| --- | --- |
| function export | typeof haptic === function |
| 5 intent 모두 no-throw | light/medium/heavy/success/warning |
| default intent no-throw | haptic() |
| undefined 반환 | void 시그니처 |
| 소스에 vibrate / TossApps 호출 잔여 없음 | grep |

5 신규 tests. 총 **167 / 167 pass**.

### 기존 테스트 영향

없음. soundStore / SettingsPage / haptic 모듈 시그니처 호환.

## 변경 파일

- `src/pages/SettingsPage.tsx` — 3 row 제거 + `HAPTIC_KEY` 제거
- `src/design-system/haptic.ts` — no-op stub
- `src/lib/haptic.test.mjs` — 신규

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 167 / 167 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
