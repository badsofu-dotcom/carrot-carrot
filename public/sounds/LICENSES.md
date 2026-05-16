# public/sounds/ — License credits

Audio file attributions. Update this table whenever a new mp3 is dropped per `README.md`.

## White-noise focus tracks (PR-3 era)

See `public/sounds/SOURCES.md` for the canonical list of the 13 white-noise tracks.

## SFX (PR-13)

The procedural Web Audio API fallback in `src/lib/procSfx.ts` covers every kind below. Listed mp3s, if present, override the synth. If a row says **(not shipped)** the synth handles it.

| File | License | Source | Notes |
| --- | --- | --- | --- |
| `sfx_dig.mp3` | (not shipped) | — | proc-synth: low-pass noise burst |
| `sfx_water.mp3` | (not shipped) | — | proc-synth: bandpass noise sweep |
| `sfx_harvest.mp3` | (not shipped) | — | proc-synth: triangle pluck + bell |
| `sfx_combo.mp3` | (not shipped) | — | proc-synth: C major arpeggio |
| `sfx_bunny.mp3` | (not shipped) | — | proc-synth: high-register twinkle |
| `sfx_levelup.mp3` | (not shipped) | — | proc-synth: 3-note fanfare + shimmer |
| `sfx_giftbox.mp3` | (not shipped) | — | proc-synth: noise pop + sine cluster |

## Farm BGM (PR-13)

| File | License | Source | Notes |
| --- | --- | --- | --- |
| `bgm_day.mp3` | (not shipped) | — | engine no-op until file lands |
| `bgm_night.mp3` | (not shipped) | — | engine no-op until file lands |
| `bgm_rainy.mp3` | (not shipped) | — | engine no-op until file lands |

## How to add an entry

When you drop a new file:

```markdown
| `sfx_dig.mp3` | Pixabay License | https://pixabay.com/sound-effects/<slug>/ | Trimmed to 0.4s, normalized -1 dB |
```

Pixabay License doesn't require attribution but the URL is still useful for revisability.

For Creative Commons licenses (CC-BY, CC-BY-SA), full attribution **is** required — include creator name and license name verbatim in the row plus a separate credits surface in the app (TBD).
