# Kanji Builder

A puzzle game for Japanese learners — combine radicals (部首) to build kanji,
then combine kanji to build words. Cross-platform mobile app built with Expo
(React Native + TypeScript) targeting iOS and Android.

## Status

Early development. The Python data pipeline (KANJIDIC2, KRADFILE, JLPT N5–N1
mapping) is in place. The mobile app scaffold is **pending** — we are migrating
away from the previous Kotlin/Compose bootstrap to Expo so a single codebase
can ship to both stores. See [docs/migration-2026-05.md](docs/migration-2026-05.md)
(to be written) for the rationale.

## Getting started

```bash
# 1. Generate the bundled SQLite (one-time, after a fresh clone)
python scripts/01_download_sources.py
python scripts/02_parse_kanjidic.py
python scripts/03_parse_kradfile.py
python scripts/04_apply_jlpt_new.py

# 2. (Coming soon) Run the Expo app
#    npm install
#    npx expo start
```

The Python pipeline emits `data/bundle/kanji.sqlite`. Once the Expo project
lands, that file will be copied into the app's `assets/` and read by
`expo-sqlite` at runtime — no platform-specific build glue required.

## Concept

- **Audience**: Non-Japanese learners of Japanese (JLPT N5 → N1).
- **Core loop**: Drag radicals onto a board → form a target kanji → score combos
  → unlock the next stage. Higher chapters introduce word- and sentence-building.
- **Pacing**: 1–3 minute sessions. WaniKani-style discrete SRS for retention.
- **Monetization**: Free download. IAP for higher-level stage packs, hint coins,
  and ad removal.

## Tech stack (planned)

| Layer | Choice |
|---|---|
| App framework | Expo (React Native) + TypeScript |
| UI | React Native primitives + a styling solution (Tamagui / NativeWind, TBD) |
| Game animation | `react-native-svg` + `react-native-reanimated` |
| Local persistence | `expo-sqlite` (+ Drizzle ORM, TBD) for user progress |
| Static data | Pre-built SQLite shipped in `assets/`, opened via `expo-sqlite` |
| Data pipeline | Python 3.12 (Windows-side) — see `scripts/` |
| Build | EAS Build (cloud) — produces iOS .ipa and Android .aab without a local Mac |
| Submit | EAS Submit — uploads directly to App Store Connect and Google Play |
| CI | GitHub Actions: `tsc --noEmit` + lint + jest on `ubuntu-latest` (cheap) |
| Distribution | Apple App Store ($99/year) + Google Play ($25 one-time) |

See [docs/data-model.md](docs/data-model.md) once written for schema details.

## Data sources & licensing

This project uses the following openly-licensed Japanese language data.
All are bundled at build time by the Python pipeline in `scripts/`; raw and
generated data files are excluded from the repository via `.gitignore`.

| Source | Content | License |
|---|---|---|
| [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) | Kanji info (readings, meanings, old JLPT, grade) | CC BY-SA 4.0 (EDRDG) |
| [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) | Japanese–multilingual dictionary | CC BY-SA 4.0 (EDRDG) |
| [KRADFILE / RADKFILE](https://www.edrdg.org/krad/kradinf.html) | Kanji ↔ radical decomposition | EDRDG License |
| [KanjiVG](https://kanjivg.tagaini.net/) | Kanji stroke order SVG | CC BY-SA 3.0 |
| [Tatoeba](https://tatoeba.org/) | Example sentence corpus | CC BY 2.0 FR |
| [kanji-data](https://github.com/davidluzgouveia/kanji-data) | Modern JLPT N5–N1 mapping per kanji (post-2010) | MIT |

The above data is used under their respective licenses. An in-app
**Credits** screen will reproduce these acknowledgements. Per the
SA (ShareAlike) clauses, derived data files are kept out of this
repository so this project's source code is not auto-licensed CC BY-SA.

Note on JLPT: the post-2010 JLPT (N5–N1) has no official kanji list. The
`kanji-data` mapping is the community standard used by most learning apps;
we adopt it for the `jlpt_new` column. The old JLPT levels (1–4) from
KANJIDIC2 are retained in `jlpt_old` for reference.

## Project structure (planned)

```
kanji-builder/
├── app/                   # (coming) Expo source — screens, components, hooks
├── assets/                # (coming) bundled kanji.sqlite + SVG, icons, fonts
├── scripts/               # Python data pipeline
│   ├── 01_download_sources.py
│   ├── 02_parse_kanjidic.py
│   ├── 03_parse_kradfile.py
│   ├── 04_apply_jlpt_new.py
│   ├── 05_parse_jmdict.py
│   ├── 06_filter_tatoeba.py
│   ├── 07_optimize_svg.py
│   └── 08_build_bundle.py
├── data/                  # gitignored — generated artifacts
│   ├── raw/               # downloaded source files
│   └── bundle/            # final SQLite + SVG copied into assets/
├── docs/                  # design docs
└── .github/workflows/     # CI
```

The Python pipeline emits a platform-neutral SQLite file. The same database
serves both iOS and Android since `expo-sqlite` reads identical bytes on each
platform — no per-OS build step required.

## License

To be decided. The code in this repository is © 2026 the author, all rights
reserved until a license is chosen. Third-party data is used under the licenses
listed above.
