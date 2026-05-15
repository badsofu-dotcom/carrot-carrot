# IMPLEMENTATION_REPORT_PR-4 — Tool action SFX + sfxMuted toggle

**Date:** 2026-05-15
**Branch:** `main`
**Scope:** Wire short one-shot audio cues into the farm tool actions (dig / water / harvest) with a defensive `playSfx` wrapper that silently no-ops on missing files or autoplay-blocked environments, and add a Settings → `농장 효과음` toggle backed by `useSoundStore.sfxMuted`. Audio assets themselves are **not** in this PR — the wrapper targets `public/sounds/{dig,water,harvest}.mp3` filenames so dropping the files in later is a zero-code change.

## What landed

### New files
- `src/lib/soundFx.ts` — `playSfx(kind, opts)` wrapper around `HTMLAudioElement`. Lazy allocation (no module-init audio side-effects), per-kind cache, master-volume × per-call gain capped at 0.45 of master (SFX always quieter than BGM). Honors `muted`. `import.meta.env.BASE_URL` is read defensively so the helper loads cleanly in both Vite (`import.meta.env` present) and `node --test` (absent).
- `src/lib/soundFx.test.mjs` — 7 cases: muted → no play, masterVolume=0 → no play, normal play hits the sounds path, volume cap math (master × gain × 0.45), gain scales below the cap, cache reuse, and unknown kind silently does nothing. Stubs `globalThis.Audio` before the loader so the helper runs under node.

### Modified
- `src/store/soundStore.ts`
  - New persisted flag `sfxMuted: boolean` (storage key `cc.sound.sfxMuted.v1`).
  - New action `setSfxMuted(v)` writes through `safeStorage`.
  - Loaded via `loadSfxMuted()` in the same store init that hydrates volume / pass / permanent unlocks.
- `src/features/collection/FarmHub.tsx`
  - Plant action: `playSfx("dig", …)` immediately after `haptic("light")`.
  - Water action: `playSfx("water", …)` immediately after `haptic("light")`.
  - Harvest action: `playSfx("harvest", …)` immediately after `haptic("medium")`.
  - Reads `sfxMuted` + `masterVolume` from `useSoundStore` (selector form, no subscription churn).
- `src/pages/SettingsPage.tsx`
  - New `SfxMutedRow` rendered inside the 알림 SettingsGroup, directly after the haptic toggle. Label `농장 효과음`, sub `씨앗·물뿌리개·바구니 탭 사운드 — 마스터 볼륨에 곱해져 재생`. Switch checked = on, unchecked = muted (mirrors the haptic UX so toggles read consistently).
- `assets-missing.md` — Sounds section refreshed: documents that the wrapper is wired but mp3 files are pending. Lists the 3 target filenames + the 96 kbps mono / ≤ 50 KB encoding target. Notes that ambient farm BGM (`bgm_*.mp3`) is intentionally deferred because the existing `useSoundPlayer` already provides ambient looping for focus sessions.

## Out of scope vs the playbook

The PR-4 playbook listed several follow-ups; the deferred items + the reason:

- **Ambient farm BGM (`bgm_day.mp3` / `bgm_night.mp3` / `bgm_rainy.mp3`)** — deferred. The existing background-soundscape player (`useSoundPlayer`) already handles ambient looping via the white-noise pack. Adding a parallel farm-only BGM track risks audio collision (two loops mixed at low volume can sound muddier than one). When the user supplies a farm-specific track, it should plug into the existing `useSoundPlayer` flow rather than a new layer.
- **Sky-view reverb track** — deferred. Same reason.
- **Asset files themselves** — not in this PR. Drop short MP3s at `public/sounds/{dig,water,harvest}.mp3` and the wired-up cues will start playing on next reload; no other code changes needed.

## Verification

```
node --test src/lib/*.test.mjs          ✔ 73/73 (was 66, +7 soundFx)
npm run typecheck (root)                ✔ clean
npm run build                           ✔
npm run build:preview                   ✔
VITE_APPS_IN_TOSS_PROXY_URL=… npm run build:ait  ✔ (deploymentId 019e2912-6592-752e-94f9-edf536478be2)
```

Forbidden-token scrub against `dist-preview/`:
```
localStorage: 0      sessionStorage: 0    indexedDB: 0
requestFullscreen: 0 exitFullscreen: 0    requestPointerLock: 0  exitPointerLock: 0
"/assets/farm: 0     '/assets/farm: 0
```

## Risk surface

- **First-play autoplay block:** Apps-in-Toss WebView blocks audio that fires before the first user gesture. `playSfx` is only called from tap handlers, so by construction it inherits the gesture. If a future caller fires from a non-gesture context (e.g. an auto-grow effect), the `.play()` Promise rejection is swallowed silently and the user sees no error.
- **404 / decode error:** the wrapper catches both `new Audio()` constructor throws and the `play()` Promise rejection. No console spam in production — the wrapper uses `try/catch` and a `.catch(()=>undefined)` to keep DevTools quiet. Trade-off: a genuinely broken mp3 won't surface in logs. Mitigation: keep filenames simple (matches the `assets-missing.md` table).
- **Volume cap interaction with BGM:** SFX uses 0.45 × master, so even at master=100 the SFX peaks at 45 % of the headroom. Intentional — the SFX should support haptic, not overpower the focus-session ambient track. If the user wants louder SFX, the master volume already covers them.
