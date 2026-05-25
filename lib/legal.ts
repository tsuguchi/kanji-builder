/**
 * Legal text bundled with the app.
 *
 * Mirrored verbatim into `docs/terms.md` and `docs/privacy.md` so the
 * same content can be hosted publicly (GitHub Pages) for store-submission
 * URLs without diverging from the in-app copy.
 *
 * Plain text only — no Markdown rendering in the app. The in-app screens
 * use whitespace and `\n\n` paragraph breaks; rendering happens via
 * `<ThemedText>` line-by-line.
 *
 * English-only because the target audience (foreign Japanese learners)
 * already operates in English throughout the app UI.
 */

const APP_NAME = 'Kanji Builder';
const PUBLISHED_AT = '2026-05-25';

export const TERMS_TEXT = `Terms of Service

Last updated: ${PUBLISHED_AT}

By installing or using ${APP_NAME} ("the app"), you agree to these terms. If you don't, please don't use the app.

1. Use of the app

${APP_NAME} is provided as-is for personal, non-commercial study of the Japanese language. You may use it freely on devices you own or control. You may not redistribute the app's binary or assets without permission.

2. User content

The app stores your learning progress locally on your device. You are responsible for backing it up if you care about it — uninstalling the app or clearing its storage will erase your progress permanently.

3. No warranty

The app is provided without any warranty of any kind, express or implied. The JLPT vocabulary and kanji data come from community-curated sources (see Acknowledgements in the About screen); accuracy is not guaranteed.

4. Limitation of liability

To the extent permitted by law, the developer is not liable for any indirect, incidental, or consequential damages arising from your use of the app.

5. Changes

These terms may change as the app evolves. The "Last updated" date at the top reflects the most recent revision.

6. Contact

Questions can be sent through the support address shown on the app's store listing.`;

export const PRIVACY_TEXT = `Privacy Policy

Last updated: ${PUBLISHED_AT}

${APP_NAME} is designed to need as little of your data as possible.

What we collect

Nothing. The app does not collect, transmit, or share any personal data with the developer or any third party.

What stays on your device

Your learning progress (which kanji and words you've cleared, your SRS schedule, your activity log) is stored locally in an SQLite database on your device. It never leaves the device through this app.

Your preferences (e.g. selected JLPT level, "has seen onboarding") are stored in AsyncStorage on your device.

Permissions

The app does not request network, location, camera, microphone, contacts, or any other sensitive permission. It works fully offline.

Children

The app contains no advertising, no in-app social features, and no data collection. It is suitable for use by children.

Changes

This policy may change if the app's behavior changes. The "Last updated" date at the top reflects the most recent revision. Any change that introduces data collection would be highlighted in release notes before it ships.

Contact

Questions can be sent through the support address shown on the app's store listing.`;

export const ACKNOWLEDGEMENTS_TEXT = `Acknowledgements

${APP_NAME} is built on top of openly licensed Japanese language data from the following projects. We're grateful to their maintainers.

KANJIDIC2 — kanji metadata (readings, meanings, stroke counts, grades, frequencies).
  License: CC BY-SA 4.0 (Electronic Dictionary Research and Development Group)
  https://www.edrdg.org/kanjidic/kanjidic2.html

KRADFILE — kanji ↔ radical decomposition.
  License: EDRDG License
  http://ftp.edrdg.org/pub/Nihongo/kradzip.zip

davidluzgouveia/kanji-data — modern JLPT N5-N1 kanji mapping.
  License: MIT
  https://github.com/davidluzgouveia/kanji-data

jamsinclair/open-anki-jlpt-decks — JLPT N5-N1 vocabulary lists (Tanos-derived).
  License: MIT
  https://github.com/jamsinclair/open-anki-jlpt-decks

The app uses Expo, React Native, expo-router, expo-sqlite, react-native-reanimated, react-native-gesture-handler, and other open-source libraries. See the project source for the full dependency list and their licenses.`;
