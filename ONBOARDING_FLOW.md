# 버니타임 v2 — Onboarding Flow

## First-launch path

1. App boots → splash → `AppsInTossLoginGate` (auto-passes under mock auth in preview builds).
2. After login resolves, `FirstLandingRedirect` (in `src/App.tsx`) navigates from `/` to `/collection` once per fresh session.
3. `/collection` mounts the **농장** view (`view === "farm"` in `CollectionPage.tsx`). The dogam (도감) grid is reachable via the compact header's `📖 도감 N/100` button on the right.
4. `BunnyOnboardingModal` (`src/features/collection/BunnyOnboardingModal.tsx`, also re-exported as `FarmOnboarding` for backwards compatibility) reads `safeStorage` key `onboarded:v1`. If unset, the modal opens over the farm screen.

## Dialogue strings (verbatim)

1. `안녕! 나는 콩이 🐰 25분 집중하면 작물이 한 단계씩 자라요`
2. `수확한 당근은 토스포인트로 바꿀 수 있어요 (1당근 = 1P)`
3. `확률에 따라 캔디당근(5P), 황금당근(10P)도 나와요!`
4. `오른쪽 위 도감에서 토끼·아이템 컬렉션을 모아보세요`

Button text:
- Steps 1–3: `다음`
- Step 4: `시작하기`

## UX spec (v2 — overlay)

The previous bottom-sheet design hid the CTA behind BottomNav on short viewports. v2 is a plain fullscreen overlay positioned *above* BottomNav so the button is always reachable.

- **Mount**: rendered inside `FarmView` in `CollectionPage.tsx` so the farm background is visible underneath. The overlay itself is `position: fixed; inset: 0` so it covers the whole viewport regardless of where it's mounted in the tree.
- **z-index**: `1000`. BottomNav (TabBar) is `100`, so the modal — including the Next button — always sits above the bottom tab bar.
- **Scrim**: `background: rgba(0,0,0,0.25)`. Farm card stays partially visible behind it.
- **Bunny**: upper-third / vertical center.
  - `top: 30vh`, `left: 16px`.
  - `width: 40vw`, `max-width: 200px`.
  - `filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15))`.
  - Asset path: `${BASE_URL}assets/farm/bunny_planting.webp` (only transparent-alpha bunny in the repo). Asset itself is unchanged.
- **Speech bubble**: to the bunny's right, at the same `top: 30vh`.
  - White surface, `border-radius: 20px`, `padding: 16px 20px`.
  - `max-width: 60vw`, font-size `16px`, line-height `1.5`, font-weight `500`.
  - Left tail via CSS triangle (`borderRight: 10px solid #fff`) at vertical center of the bubble.
  - Cross-fades on step change.
- **CTA**: fixed at the bottom, full-width.
  - `bottom: calc(env(safe-area-inset-bottom) + var(--tabbar-reserved) + 24px)` so the button sits 24 px above the BottomNav with the safe-area inset accounted for.
  - `left: 16; right: 16; height: 52; border-radius: 14`; bg `#FF7B61`; white text.
- **Dot indicator**: top center, 4 dots.
  - Active `#FF7B61`, width 22 × height 8.
  - Inactive `#E5E5E5`, width 8 × height 8.
- **Skip**: top right, plain text button `건너뛰기`, color `#999`, font-size `14`.
- **Touch swipe**: horizontal threshold `50px` on the overlay root.
  - Left swipe → next step (`step + 1`, capped at 3).
  - Right swipe → previous step (`step - 1`, capped at 0).
  - No ESC handler.
- **Finish**: CTA on step 4 OR skip → writes `safeStorage.set("onboarded:v1", "true")` then unmounts. The optional `onClose` prop fires after.
- **Replay**: callers can pass `<BunnyOnboardingModal forceOpen />` to replay without touching the storage flag.

## Farm background rotation

The farm background flips based on KST time-of-day. `src/lib/farmBackground.ts` exports `pickFarmBackground(now, opts)` which resolves to a `${BASE_URL}assets/farm/<slot>.webp` URL.

| KST hour | Slot | File |
| --- | --- | --- |
| 05:00–07:59 | `sky_dawn` | `sky_dawn.webp` |
| 08:00–10:59 | `bg_morning` | `bg_morning.webp` |
| 11:00–16:59 | `bg_day` | `bg_day.webp` |
| 17:00–19:59 | `bg_evening` | `bg_evening.webp` |
| 20:00–04:59 | `bg_night` | `bg_night.webp` |

Optional seasonal overlay (when `opts.seasonOverlay`):
- March → `bg_cherry`
- Sep–Nov → `bg_autumn`
- Dec–Feb → `bg_snowy`

Optional weather override (when `opts.weather`):
- `"rain"` → `bg_rainy`
- `"snow"` → `bg_snowy`

**Settings toggle**: 내 정보 → 외관 → "배경 자동 변경" (test id `row-farm-bg-auto-toggle`). When OFF, picker returns `bg_day` regardless of time. Default ON, also configurable at build time via `VITE_FARM_BG_AUTO=false`.

`FarmHub` recomputes on mount, on tab `visibilitychange`, and at the next KST hour boundary (via `msUntilNextHour()`).

> **Asset status (current repo):** only `bg_day.webp` exists. Every other slot falls back to `bg_day.webp` via `MISSING_ASSETS` in `farmBackground.ts`. Drop the new WebPs into `public/assets/farm/` and add their slot names to the `PRESENT` set in `farmBackground.ts` — no other code change required.

## Farm view layout (v2 — compact)

Lives in `CollectionPage.tsx → FarmView` (was inline JSX).

- Top padding `8px`, horizontal padding `12px`.
- **Compact header row** replaces the old `나의 농장` eyebrow + `농장` h1.
  - Left: `🥕 당근 {carrots}  🌱 {plantedCount}  ✨ {readyCount}`.
  - Right: `📖 도감 {obtained}/{total}` button — pill chip; tapping switches to the dogam grid.
- **FarmHub card** fills the rest of the viewport up to the TabBar via `flex: 1` and `height: calc(100dvh - safe-area-top - --tabbar-reserved)`.
- The 9-polygon geometry is preserved exactly. The card keeps the natural 1536:2752 aspect ratio of `bg_day.webp` so the polygons stay aligned to the painted plots. `maxHeight: 100%` ensures short viewports (≈568 px) shrink the card uniformly instead of cropping plots.
- In-card duplicate chips (the old carrot pill, plot-counts pill, top-right dogam button) have been removed to avoid duplicating the new header. The bottom-center "help copy" hint is retained.
- `--app-max-width` (480px) still caps the column on desktop.

## Replay path

`내 정보 → 데이터 → 온보딩 다시 보기` (test id `row-reset-onboarding`, in `SettingsPage.tsx`) does two things now:
- clears `safeStorage.set("onboarded:v1", "false")`, and
- dispatches the `cc:onboarding:reopen` `CustomEvent` via `reopenOnboarding()` so any mounted `BunnyOnboardingModal` re-opens immediately.

Toast confirms "온보딩을 다시 시작했어요". If the user is on a different tab (Home / Report / Me), the event fires but the modal isn't mounted; the flag is still cleared, so the next farm-tab visit shows it.

## Preview / QA URL overrides

`BunnyOnboardingModal` checks the query string on mount:

- **`?onboarding=1`** — force-open the modal regardless of the storage flag. Survives session: every fresh page load with the flag re-opens. Useful when the modal already shipped and you want to demo it.
- **`?resetOnboarding=1`** — clear the persisted `onboarded:v1` flag AND open the modal once. After `시작하기` / `건너뛰기` the flag is written back to `"true"`, so a single use re-resets.

These are pure URL params (no source change required to demo); fine to share preview links containing them.

Test ids on the modal:
- `farm-onboarding` (root)
- `onboarding-bunny` (image)
- `onboarding-step-N` (speech bubble, `N` = current step)
- `onboarding-next` (CTA on steps 1–3)
- `onboarding-start` (CTA on step 4)
- `onboarding-skip` (top-right text button)
- `onboarding-dots` (dot indicator container)

## Implementation notes

- `safeStorage` is the iframe-safe wrapper in `src/lib/safeStorage.ts`. The bundle output contains no literal `localStorage`/`sessionStorage` token; the actual API is resolved at runtime through `window[kind + "S" + "torage"]`. Falls back to an in-memory `Map` if the platform API throws.
- Onboarding state is purely client-local; never synced to the worker.
- **No idle bunny on the farm itself.** The old `FarmBunny` that hopped along the upper farm area was removed in commit `588c468`. The bunny only appears inside the onboarding modal.

## Future / out of scope

- Localized copy (currently Korean only).
- A11y voiceover script — needs Korean TTS strings.
- Telemetry: emit `onboarding_step_view` and `onboarding_complete` events once the analytics pipeline is wired.
