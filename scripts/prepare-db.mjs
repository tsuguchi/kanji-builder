#!/usr/bin/env node
/**
 * Copies the pre-built kanji database from data/bundle/ into assets/data/ so
 * Metro can bundle it with the app.
 *
 * - data/bundle/kanji.sqlite is the Python pipeline output (gitignored,
 *   single source of truth).
 * - assets/data/kanji.sqlite is the bundled-with-the-app copy (gitignored
 *   too — re-generated from the bundle on demand). It MUST exist before
 *   `expo start` or `eas build`, otherwise the Asset.fromModule require()
 *   in the app will fail.
 *
 * Idempotent: skips the copy if the destination is newer than the source.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = resolve(ROOT, 'data', 'bundle', 'kanji.sqlite');
const DST = resolve(ROOT, 'assets', 'data', 'kanji.sqlite');

function fail(message) {
  console.error(`prepare-db: ${message}`);
  process.exit(1);
}

if (!existsSync(SRC)) {
  fail(
    `source missing: ${SRC}\n` +
      '  Run the Python data pipeline first:\n' +
      '    python scripts/01_download_sources.py\n' +
      '    python scripts/02_parse_kanjidic.py\n' +
      '    python scripts/03_parse_kradfile.py\n' +
      '    python scripts/04_apply_jlpt_new.py',
  );
}

mkdirSync(dirname(DST), { recursive: true });

if (existsSync(DST) && statSync(DST).mtimeMs >= statSync(SRC).mtimeMs) {
  console.log(`prepare-db: up-to-date (${DST})`);
  process.exit(0);
}

copyFileSync(SRC, DST);
const size = statSync(DST).size;
console.log(`prepare-db: copied ${SRC} -> ${DST} (${(size / 1024 / 1024).toFixed(2)} MB)`);
