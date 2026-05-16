# IMPLEMENTATION_REPORT_PR-13.md — BGM + SFX 풀스택

7 개 SFX + 3 트랙 farm BGM + Settings UI + 절차적 합성 fallback 도입. mp3 자산이 없어도 SFX 는 즉시 들리고, BGM 은 mp3 만 떨궈넣으면 활성화.

## A. 자산 자동 다운로드 — 보고

Pixabay CDN 직접 핫링크 차단 (403), Pixabay API + Freesound 모두 API key 필요 → 자동 다운로드 불가. 코드/UI/엔진을 완전히 wire 한 뒤 `public/sounds/README.md` 에 큐레이션 URL 매트릭스 + 정확한 파일명 매핑을 제공. **SFX 는 절차적 Web Audio API 합성** 으로 mp3 부재 시에도 즉시 들림 — BGM 만 mp3 의존.

## B. 아키텍처

```
                ┌─ playSfx (kind, opts) ─────┐
                │                            │
   FarmHub      │   try mp3 (HTMLAudioElement)
   VisitorBunny ├──>│   ↓ 404 / decode fail
   RewardsPanel │   playProcSfx (Web Audio synth)
   CollectionPg │                            │
                └─ src/lib/soundFx.ts ───────┘

   bgmEngine.start → HTMLAudioElement (loop)
        ↓ slot change (pickFarmBackgroundSlot)
   crossfade 2s → next track
   visibilitychange → pause / resume
```

## C. 신규 파일

1. **`src/lib/procSfx.ts`** — Web Audio API 절차적 합성 엔진. 7 kind 각각 oscillator / noise + envelope 그래프. 단일 lazy `AudioContext`, suspended 상태 자동 resume. window 부재(SSR / node) 시 silent.
2. **`src/lib/bgmEngine.ts`** — Farm BGM 매니저. mp3 only. `start(cfg)` 이 idempotent — 첫 user gesture 에서 호출 후 추가 호출은 resume 만. 5분마다 `pickFarmBackgroundSlot` 다시 호출 → 트랙 변경 시 2s crossfade. `document.visibilitychange` 로 백그라운드 시 pause.
3. **`src/lib/bgmEngine.test.mjs`** — `trackForSlot` 의 9 slot 라우팅 검증 (5 케이스).
4. **`public/sounds/README.md`** — drop-in 가이드. 정확한 파일명 (`sfx_*.mp3` / `bgm_*.mp3`), 권장 길이 / 무드, Pixabay/Freesound/Sonniss CC0 소스 큐레이션, 키워드 레시피.
5. **`public/sounds/LICENSES.md`** — 크레딧 템플릿. 모든 항목 현재 "(not shipped)" — 절차적 fallback 명시.

## D. 수정 파일

6. **`src/lib/soundFx.ts`** — `SfxKind` 가 `ProcSfxKind` 의 7 kind 그대로. mp3 우선 → 실패 시 `playProcSfx` fallback. `mp3Dead` Set 으로 죽은 kind 캐싱 (다음 호출 즉시 procSfx).
7. **`src/lib/soundFx.test.mjs`** — sfx_water 파일명 prefix 갱신 (sfx_ 접두).
8. **`src/lib/_test-helpers.mjs`** — `transformSync` → `buildSync(bundle: true)` 교체. cross-file ts import (soundFx → procSfx, bgmEngine → farmBackground) 처리.
9. **`src/lib/farmBackground.ts`** — `import.meta.env` 접근에 optional chaining 가드. node bundle 환경에서 `env` 가 undefined 일 때 안전.
10. **`src/store/soundStore.ts`** — 신규 필드 + setters:
    - `sfxVolume: number` (0..100, default 70)
    - `farmBgmEnabled: boolean` (default true)
    - `farmBgmVolume: number` (0..100, default 50)
    - safeStorage 3 신규 키 (`cc.sound.sfxVolume.v1`, `cc.sound.farmBgmEnabled.v1`, `cc.sound.farmBgmVolume.v1`)
    - 헬퍼 `loadIntInRange` / `saveInt` / `loadBoolDefaultTrue` / `saveBool`
11. **`src/pages/SettingsPage.tsx`** — 신규 row 3:
    - `SfxVolumeRow` (effect 음 볼륨 슬라이더)
    - `FarmBgmToggleRow` (BGM ON/OFF switch)
    - `FarmBgmVolumeRow` (BGM 볼륨 슬라이더, BGM 끄면 disabled)
    - 기존 `SfxMutedRow` last 속성 제거 → 마지막 row 가 `FarmBgmVolumeRow` 로 이동
12. **`src/features/collection/FarmHub.tsx`** — 기존 `playSfx` 의 masterVolume 소스가 `useSoundStore.volume` (white-noise) → `useSoundStore.sfxVolume` (전용) 로 분리. 행위 변화: SFX 볼륨이 white-noise 볼륨과 독립.
13. **`src/components/Farm/VisitorBunny.tsx`** — `shouldShow` 변경 시 `playSfx("bunny", { masterVolume: sfxVolume, muted: sfxMuted })` 한 번.
14. **`src/components/Farm/RewardsPanel.tsx`** — `onClaim` 사용자 탭 직후 `playSfx("giftbox", …)`.
15. **`src/features/collection/rewardsStore.ts`** — `unlockMedal` 이 성공 시 `cc:medal:unlocked` CustomEvent dispatch (`detail.id`). 스토어→React 오디오 직접 의존 회피.
16. **`src/pages/CollectionPage.tsx`** — FarmView 안에 3 신규 effect:
    - `cc:medal:unlocked` listener → `perfect_combo` 면 sfx_combo, 그 외 sfx_levelup
    - `pointerdown` one-shot (재첨가/idempotent) → `bgmEngine.start(cfg)`
    - soundStore subscribe → `bgmEngine.setEnabled` / `setVolume` 동기화

## E. 디자인 결정 — 절차적 SFX

| 측면 | 선택 |
| --- | --- |
| BGM 절차적 합성 | ❌ — 루프형 패드의 합성음은 robotic + fatiguing. mp3 의존 유지. |
| SFX 절차적 합성 | ✅ — 짧은 one-shot 은 합성으로 충분히 cute. 자산 부재에 strong fallback. |
| mp3 ↔ proc 우선순위 | mp3 가 있으면 우선, 404 시 1회 fail flag 후 다음부터 즉시 procSfx. |

## F. SFX 합성 세부 (procSfx.ts)

- `dig`: 0.2s low-pass swept noise (1500→200 Hz)
- `water`: 0.6s bandpass noise (1400→700 Hz) + high-shimmer 오버레이
- `harvest`: 0.18s triangle C5→E5 + 0.4s C6 bell tail
- `combo`: 4-note C major arpeggio (C5-E5-G5-C6) @ 120ms 간격
- `bunny`: E6 + B6 sine 더블 ping
- `levelup`: square C5/G5 단음 + 지속 C6 triangle + E6 shimmer
- `giftbox`: highpass noise pop + 두 sine 슬라이드 (C6→G6, C7→E7)

전부 master×gain×0.35 cap (mp3 0.45 보다 약간 낮음 — synth peak energy 가 상대적으로 큼).

## G. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **93/93 pass** (이전 90 + bgmEngine 5 - sfx 변경 영향 0) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 (Web Audio API 는 `AudioContext` / `Audio` 만 사용, 금지 토큰 없음) |

`build:ait` 는 PR-6 path 검증 완료. PR-13 은 client-only — assets 추가 없음 (proc 합성), `bgm_*.mp3` 는 향후 사용자 drop-in 시 빌드 산출물에 자동 포함.

## H. 자산 drop-in 워크플로우 (사용자용)

1. `public/sounds/README.md` 의 큐레이션 키워드로 Pixabay/Freesound CC0 검색
2. 정확한 파일명 (`sfx_dig.mp3`, `bgm_day.mp3`, ...) 으로 `public/sounds/` 에 떨궈넣기
3. `npm run dev` 재시작 또는 새로고침
4. 농장 탭 → 어디든 탭 (브라우저 user-gesture 정책)
5. BGM 은 2s 안에 crossfade-in, SFX 는 다음 도구 탭부터 mp3 재생
6. `public/sounds/LICENSES.md` 에 출처 추가

## I. Maintainer 후속 조치

없음. DB 마이그/시크릿/wrangler 불필요.

## J. 다음 작업

3개 PR (PR-11/12/13) 완료. 가능한 다음 후보 (사용자 결정):
- buff 활성 시각 인디케이터 (가방 푸터 / 농장 카드 코너)
- weekly treasure 클라 wire (테이블 + 워커 라우트 존재, 클라 호출 미연결)
- `combo` SFX 의 실제 5-streak 트래커 — 현재 perfect_combo 한 곳에만 wired
- BGM 자산 직접 드롭인 (mp3 3개 README 따라 받아 떨궈넣기)
- ad-token verification (시크릿 hard-stop)
