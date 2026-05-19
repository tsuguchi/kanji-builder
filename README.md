# Kanji Builder

[![CI](https://github.com/tsuguchi/kanji-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/tsuguchi/kanji-builder/actions/workflows/ci.yml)

A puzzle game for Japanese learners — combine radicals (部首) to build kanji,
then combine kanji to build words. Cross-platform mobile app built with Expo
(React Native + TypeScript) targeting iOS and Android.

## Status

Early development. The Python data pipeline (KANJIDIC2, KRADFILE, JLPT N5–N1
mapping) and the Expo (React Native + TypeScript) app shell are in place.
The app boots into an **N5 stage selection list** (each row shows ✓ once
cleared and a "Due" badge when review is overdue); the header surfaces a
**"N reviews due →" call-to-action** that opens a dedicated **Reviews
screen** listing only the currently-overdue kanji (sorted most-overdue
first, empty state shows the next upcoming review time). Tapping any row
opens a **stage detail screen** showing the kanji glyph, meanings, on/kun
readings, stroke count, KRADFILE radical decomposition, an SRS progress
summary, and a **drag-and-drop build mini-game**: drag chips from an
available pool (correct radicals + 3 distractors) into a build zone — a
short tap still works as a fallback for accessibility / single-handed use,
since the Pan gesture needs ~10 px of movement to win over Tap in a
`Gesture.Race`. The game declares the kanji "correct" when the placed
multiset matches the target.
Each first solve in a detail-screen visit advances a WaniKani-inspired
8-stage SRS stored in a separate writable `progress.sqlite` (4h → 8h → 1d
→ 2d → 1w → 2w → 1mo → 4mo intervals). A **clean solve** (no distractor
ever placed during the attempt) advances the stage by 1; a **solve with at
least one distractor placed** drops the stage by 1 (floored at 1, no
penalty on first introduction). The success banner is green for clean
solves and orange for solves-with-mistake. Pressing Reset starts a fresh
attempt and clears the mistake flag. After solving, if other kanji are
still **due for review** the detail screen surfaces a green "Next due: X
→" button that navigates (via Stack `replace`, so back-navigation still
returns to Reviews or Stages, not through every previously-visited stage)
straight to the next overdue kanji — enabling a quick "session loop"
through the review queue. Once the user reaches Reviews with no remaining
due kanji and at least one solve was recorded in the current app session,
the Reviews screen swaps its "All caught up!" empty state for a
**"Session complete!"** summary panel (N reviewed · X% clean, broken
down into clean / with-mistake counts; in-memory only, dismissed via a
button).

## Getting started

```bash
# Install JS dependencies and start the Expo dev server
npm install
npm run start          # opens the Expo CLI; press a / i / w to launch
npm run android        # launch directly on an Android emulator / device
npm run ios            # launch on an iOS simulator (requires macOS)
npm run web            # run in a browser
```

The bundled kanji database (`assets/data/kanji.sqlite`, ~4 MB) is **tracked
in git** as a build-time prebuilt artifact so a fresh clone is immediately
runnable — no Python pipeline needed up front. The Python pipeline below
is only needed when you change the schema and want to regenerate the
bundle from raw KANJIDIC2 / KRADFILE / kanji-data:

```bash
python scripts/01_download_sources.py
python scripts/02_parse_kanjidic.py
python scripts/03_parse_kradfile.py
python scripts/04_apply_jlpt_new.py
# → data/bundle/kanji.sqlite (gitignored)
npm run prepare-db
# → copies data/bundle/kanji.sqlite to assets/data/kanji.sqlite (tracked)
```

`npm run start` (and the platform-specific variants) automatically runs
`prepare-db` first as a `prestart` hook. The script is idempotent: on a
fresh clone it skips the copy because there is no source bundle, and the
committed `assets/data/kanji.sqlite` is used as-is.

Quality gates (run before opening a PR):

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint (expo + prettier-compatible)
npm run format:check   # Prettier --check
```

These three gates are also enforced in CI by
[.github/workflows/ci.yml](.github/workflows/ci.yml) on every push to `main`
and every pull request. CI runs on `ubuntu-latest` with Node 20 LTS and
skips `npm run prepare-db` — the bundled `kanji.sqlite` is a runtime asset,
not a build-time TypeScript dependency.

The data layer is a thin wrapper over `expo-sqlite`:

- [`db/types.ts`](db/types.ts) — TypeScript types mirroring the SQLite schema
  (`Kanji`, `RadicalDecomposition`, JSON-decoding helpers).
- [`db/queries.ts`](db/queries.ts) — typed query helpers (`getKanjiByJlptNew`,
  `getRadicalsForKanji`).
- [`app/_layout.tsx`](app/_layout.tsx) — wraps the app in `<SQLiteProvider>`,
  loading the bundled asset via `assetSource={{ assetId: require(...) }}`.

## Building for store distribution (EAS Build)

`npx expo start` is sufficient for development against Expo Go, but iOS
.ipa and Android .aab artifacts (TestFlight / Play Store) are produced by
**EAS Build** (Expo's cloud build service). The Mac requirement for iOS
signing is offloaded to EAS's macOS runners, so the entire workflow stays
Windows-friendly.

Profiles are defined in [eas.json](eas.json):

| Profile       | Distribution | Android format                     | Use case                           |
| ------------- | ------------ | ---------------------------------- | ---------------------------------- |
| `development` | internal     | `.apk` (dev client)                | Native modules not in Expo Go      |
| `preview`     | internal     | `.apk`                             | Share with testers via direct link |
| `production`  | store        | `.aab` (Play) / `.ipa` (App Store) | Ship to TestFlight / Play          |

```bash
# One-time setup (per developer machine)
npm install -g eas-cli          # or use `npx eas-cli` per-invocation
npx eas login                   # Expo account (free)
npx eas init                    # creates an Expo project, writes projectId into app.json

# Run a build (cloud)
npx eas build --profile preview  --platform android   # → APK link to share
npx eas build --profile preview  --platform ios       # → ad-hoc IPA
npx eas build --profile production --platform all     # → store-ready bundles

# Submit to stores (after a production build completes)
npx eas submit --profile production --platform ios    # → TestFlight
npx eas submit --profile production --platform android # → Play Console
```

### Prerequisites for actual store submission

- **iOS**: Apple Developer Program membership (USD 99/year). `eas submit
--platform ios` will prompt for an Apple ID / app-specific password and
  the team ID; EAS handles certificate and provisioning profile generation
  if not already present.
- **Android**: Google Play Console one-time fee (USD 25). `eas submit
--platform android` requires a service account JSON for the Play API.

### Bundled SQLite in EAS

`assets/data/kanji.sqlite` (~4 MB) is **tracked in git** so EAS Build, which
runs in a clean environment without Python or the raw KANJIDIC2 / KRADFILE
sources, finds the asset and bundles it normally. Local dev still
regenerates the file from `data/bundle/kanji.sqlite` via `npm run
prepare-db` whenever the Python pipeline outputs a fresh bundle (e.g. on a
schema change); commit the resulting `assets/data/kanji.sqlite` diff
alongside the schema change so EAS picks it up on the next cloud build.

Alternatives that were rejected for the personal MVP stage (in case the
trade-off becomes interesting later):

- **EAS `pre-install` hook running the Python pipeline** — keeps the
  repository binary-free, but requires vendoring or fetching raw
  KANJIDIC2 / KRADFILE during each cloud build and adds 30-60 s per
  build for the regeneration.
- **[EAS file-based env vars](https://docs.expo.dev/eas/environment-variables/file-environment-variables/)
  uploading the prebuilt SQLite as a secret** — keeps it out of git, but
  shifts manual upload duty to each developer / each schema change.

## Concept

- **Audience**: Non-Japanese learners of Japanese (JLPT N5 → N1).
- **Core loop**: Drag radicals onto a board → form a target kanji → score combos
  → unlock the next stage. Higher chapters introduce word- and sentence-building.
- **Pacing**: 1–3 minute sessions. WaniKani-style discrete SRS for retention.
- **Monetization**: Free download. IAP for higher-level stage packs, hint coins,
  and ad removal.

## Tech stack (planned)

| Layer             | Choice                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| App framework     | Expo (React Native) + TypeScript                                           |
| UI                | React Native primitives + a styling solution (Tamagui / NativeWind, TBD)   |
| Game animation    | `react-native-svg` + `react-native-reanimated`                             |
| Local persistence | `expo-sqlite` (+ Drizzle ORM, TBD) for user progress                       |
| Static data       | Pre-built SQLite shipped in `assets/`, opened via `expo-sqlite`            |
| Data pipeline     | Python 3.12 (Windows-side) — see `scripts/`                                |
| Build             | EAS Build (cloud) — produces iOS .ipa and Android .aab without a local Mac |
| Submit            | EAS Submit — uploads directly to App Store Connect and Google Play         |
| CI                | GitHub Actions: `tsc --noEmit` + lint + jest on `ubuntu-latest` (cheap)    |
| Distribution      | Apple App Store ($99/year) + Google Play ($25 one-time)                    |

See [docs/data-model.md](docs/data-model.md) once written for schema details.

## Data sources & licensing

This project uses the following openly-licensed Japanese language data.
All are bundled at build time by the Python pipeline in `scripts/`; raw and
generated data files are excluded from the repository via `.gitignore`.

| Source                                                             | Content                                          | License              |
| ------------------------------------------------------------------ | ------------------------------------------------ | -------------------- |
| [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) | Kanji info (readings, meanings, old JLPT, grade) | CC BY-SA 4.0 (EDRDG) |
| [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html)               | Japanese–multilingual dictionary                 | CC BY-SA 4.0 (EDRDG) |
| [KRADFILE / RADKFILE](https://www.edrdg.org/krad/kradinf.html)     | Kanji ↔ radical decomposition                    | EDRDG License        |
| [KanjiVG](https://kanjivg.tagaini.net/)                            | Kanji stroke order SVG                           | CC BY-SA 3.0         |
| [Tatoeba](https://tatoeba.org/)                                    | Example sentence corpus                          | CC BY 2.0 FR         |
| [kanji-data](https://github.com/davidluzgouveia/kanji-data)        | Modern JLPT N5–N1 mapping per kanji (post-2010)  | MIT                  |

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
