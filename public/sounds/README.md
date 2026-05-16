# public/sounds/ — Drop-in audio guide (PR-13)

This directory ships with **13 white-noise mp3s** (PR-3-era focus mode sounds — air-purifier, rain, etc.). PR-13 adds two more audio surfaces that *do not yet have mp3s in the repo*:

1. **SFX** — 7 short event cues
2. **BGM** — 3 looping farm tracks (day / night / rainy)

Both gracefully no-op when files are missing — SFX falls back to procedural Web Audio API synthesis (still audible, just synthetic), BGM stays silent until the mp3 lands.

## Required filenames

Drop the files **exactly** as named below — the engines look these up at `${BASE_URL}sounds/<filename>`.

### SFX (one-shot, < 1.5 s each)

| File | Trigger | Suggested length / mood |
| --- | --- | --- |
| `sfx_dig.mp3` | 씨 뿌리기 (모종삽 사용) | ~0.4 s — dirt scrape, low |
| `sfx_water.mp3` | 물 주기 (물뿌리개 사용) | ~0.6 s — soft splash |
| `sfx_harvest.mp3` | 수확 (바구니 사용) | ~0.5 s — pop + sparkle |
| `sfx_combo.mp3` | perfect-combo 9-plot 동시 익음 | ~1 s — ascending chime |
| `sfx_bunny.mp3` | VisitorBunny 등장 | ~0.6 s — twinkle |
| `sfx_levelup.mp3` | 메달 / 도감 신규 unlock | ~1.2 s — short fanfare |
| `sfx_giftbox.mp3` | 오늘의 선물상자 오픈 | ~0.7 s — magic shimmer |

### BGM (looping)

| File | Active when | Suggested mood |
| --- | --- | --- |
| `bgm_day.mp3` | sky slot ∈ {morning, day, evening, cherry, autumn} | Cozy LoFi / acoustic 2–3 min loop |
| `bgm_night.mp3` | sky slot ∈ {night, dawn} | Lullaby / soft pad |
| `bgm_rainy.mp3` | sky slot ∈ {rainy, snowy} | Ambient + light rain texture |

## Where to find free, license-clear audio

Both Pixabay and Freesound require account login / API keys for direct hot-link download — so **the repo doesn't auto-fetch**. Manual download is the path. All sources below allow commercial use without attribution (Pixabay License) or with simple credit (CC0 / CC-BY).

### Recommended sources

- **Pixabay Music** — https://pixabay.com/music — search "cozy farm", "lullaby", "rain ambient" — Pixabay License (commercial OK, no attribution required, but credit is appreciated)
- **Pixabay Sound Effects** — https://pixabay.com/sound-effects — search "dig", "water pour", "pop", "fanfare" — same license
- **Freesound** (filter by license = CC0) — https://freesound.org/search/?f=license%3A%22Creative+Commons+0%22 — direct downloads after free signup
- **Sonniss GameAudioGDC** — https://sonniss.com/gameaudiogdc — annual free CC0 game-audio bundles
- **OpenGameArt.org** — https://opengameart.org/art-search?keys=&field_art_type_tid%5B%5D=13 — sort by license CC0

### Quick-pick keyword recipes

| File | Pixabay search | Freesound search (CC0) |
| --- | --- | --- |
| `sfx_dig.mp3` | `shovel dirt` | `dirt scoop` |
| `sfx_water.mp3` | `water pour short` | `water splash short` |
| `sfx_harvest.mp3` | `pop sparkle short` | `magic pop` |
| `sfx_combo.mp3` | `arpeggio rise short` | `chime ascending` |
| `sfx_bunny.mp3` | `cute twinkle short` | `tinkle short` |
| `sfx_levelup.mp3` | `fanfare short` | `level up jingle` |
| `sfx_giftbox.mp3` | `magic chest open` | `treasure open short` |
| `bgm_day.mp3` | `lofi farm loop` | `acoustic loop calm` |
| `bgm_night.mp3` | `lullaby ambient loop` | `night ambient pad` |
| `bgm_rainy.mp3` | `rain ambient loop` | `rain pad loop` |

## After dropping files in

1. Restart `npm run dev` (or just refresh — Vite picks new static assets up).
2. Open the farm tab → tap anywhere (browser needs a user gesture before audio can start).
3. BGM should crossfade to the active sky-slot track within 2 seconds.
4. Tool taps should swap from procedural synth → your mp3.

If a sound doesn't play:
- Check the path matches **exactly** (`sfx_dig.mp3`, not `dig.mp3`).
- DevTools → Network tab → confirm 200 (not 404) on the file.
- If 404 in a deployed Apps-in-Toss bundle, the asset wasn't picked up by the build — run `npm run build:ait` again.

## License accounting

Every file you drop should be entered in `LICENSES.md` next to this README so the credits surface stays accurate.
