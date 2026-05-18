#!/usr/bin/env node
/**
 * Copies the pre-built kanji database from data/bundle/ into assets/data/ so
 * Metro can bundle it with the app.
 *
 * - data/bundle/kanji.sqlite is the Python pipeline output (gitignored,
 *   regenerated when the schema changes).
 * - assets/data/kanji.sqlite is the bundled-with-the-app copy. It IS
 *   tracked in git as a build-time prebuilt artifact, so EAS Build (which
 *   has no Python + no raw KANJIDIC2/KRADFILE sources) can find it. Fresh
 *   clones therefore already have the asset and do not need to run the
 *   Python pipeline before `npm run start`.
 *
 * Decision tree for the copy step:
 *   1. Source exists and destination missing or older  → copy
 *   2. Source exists and destination newer/equal       → no-op (idempotent)
 *   3. Source missing but destination exists           → no-op
 *      (fresh clone case — the committed asset is the source of truth here)
 *   4. Both missing                                    → fail with guidance
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

mkdirSync(dirname(DST), { recursive: true });

const srcExists = existsSync(SRC);
const dstExists = existsSync(DST);

if (!srcExists && !dstExists) {
  fail(
    `both source (${SRC}) and destination (${DST}) are missing.\n` +
      '  Run the Python data pipeline to generate the source:\n' +
      '    python scripts/01_download_sources.py\n' +
      '    python scripts/02_parse_kanjidic.py\n' +
      '    python scripts/03_parse_kradfile.py\n' +
      '    python scripts/04_apply_jlpt_new.py',
  );
}

if (!srcExists) {
  // Fresh clone, committed `assets/data/kanji.sqlite` is the source of
  // truth here. No copy needed.
  console.log(`prepare-db: using committed asset (no source bundle to copy from)`);
  process.exit(0);
}

if (dstExists && statSync(DST).mtimeMs >= statSync(SRC).mtimeMs) {
  console.log(`prepare-db: up-to-date (${DST})`);
  process.exit(0);
}

copyFileSync(SRC, DST);
const size = statSync(DST).size;
console.log(`prepare-db: copied ${SRC} -> ${DST} (${(size / 1024 / 1024).toFixed(2)} MB)`);
