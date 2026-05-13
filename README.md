# Kanji Builder

A puzzle game for Japanese learners — combine radicals (部首) to build kanji,
then combine kanji to build words. Android native, Kotlin + Jetpack Compose.

## Status

Early planning. No code yet.

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
| App | Kotlin + Jetpack Compose (min API 26 / Android 8.0) |
| Game animation | Compose `Canvas` + `animate*AsState`; Compose Multiplatform-ready where possible |
| Local persistence | Room (SQLite) for user progress |
| Static data | Pre-built SQLite shipped in `assets/`, opened via Room `createFromAsset` |
| Data pipeline | Python 3.12 (Windows-side) — see `scripts/` |
| Build system | Gradle (Kotlin DSL) |
| CI | GitHub Actions: ktlint/detekt + Gradle test on `ubuntu-latest` (cheap), assemble on tag only |
| Distribution | Google Play (developer registration $25 one-time) |

See [docs/data-model.md](docs/data-model.md) once written for schema details.

## Data sources & licensing

This project uses the following openly-licensed Japanese language data.
All are bundled at build time by the Python pipeline in `scripts/`; raw and
generated data files are excluded from the repository via `.gitignore`.

| Source | Content | License |
|---|---|---|
| [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) | Kanji info (readings, meanings, JLPT, grade) | CC BY-SA 4.0 (EDRDG) |
| [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) | Japanese–multilingual dictionary | CC BY-SA 4.0 (EDRDG) |
| [KRADFILE / RADKFILE](https://www.edrdg.org/krad/kradinf.html) | Kanji ↔ radical decomposition | EDRDG License |
| [KanjiVG](https://kanjivg.tagaini.net/) | Kanji stroke order SVG | CC BY-SA 3.0 |
| [Tatoeba](https://tatoeba.org/) | Example sentence corpus | CC BY 2.0 FR |
| JLPT vocab/kanji lists | Public lists, level grouping | Public |

The above data is used under their respective licenses. An in-app
**Credits** screen will reproduce these acknowledgements. Per the
SA (ShareAlike) clauses, derived data files are kept out of this
repository so this project's source code is not auto-licensed CC BY-SA.

## Project structure (planned)

```
kanji-builder/
├── android/                # Android Studio project (Kotlin + Compose)
├── scripts/                # Python data pipeline
│   ├── 01_download_sources.py
│   ├── 02_parse_kanjidic.py
│   ├── 03_parse_kradfile.py
│   ├── 04_parse_jmdict.py
│   ├── 05_filter_tatoeba.py
│   ├── 06_optimize_svg.py
│   └── 07_build_bundle.py
├── data/                   # gitignored — generated artifacts
│   ├── raw/                # downloaded source files
│   └── bundle/             # final SQLite + SVG copied into android/app/src/main/assets/
├── docs/                   # design docs
└── .github/workflows/      # CI
```

The Python pipeline emits `kanji.sqlite` once, and the Android build step
copies it into the app's `assets/` (or the script writes there directly).
The same database file would also work on iOS if a future port is built —
the data layer is platform-neutral.

## License

To be decided. The code in this repository is © 2026 the author, all rights
reserved until a license is chosen. Third-party data is used under the licenses
listed above.
