#!/usr/bin/env node
/**
 * Build the Expo web bundle and stage it under `docs/app/` so GitHub Pages
 * can serve it at `https://tsuguchi.github.io/kanji-builder/app/`.
 *
 * Workflow:
 *   1. `expo export --platform web --output-dir dist-web` (uses
 *      app.json's `experiments.baseUrl: "/kanji-builder/app"` so all
 *      asset URLs are prefixed correctly for the subdirectory hosting).
 *   2. Wipe `docs/app/` and copy `dist-web/*` into it.
 *   3. Drop a `.nojekyll` marker so Jekyll doesn't touch the build
 *      output (it has `_expo/` directories which Jekyll would otherwise
 *      ignore by default).
 *
 * Run:
 *   npm run web:deploy
 *
 * Then commit the resulting docs/app/ changes and push. GitHub Pages
 * picks up the new build on the next deploy (usually <1 minute).
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const STAGE = resolve(ROOT, 'dist-web');
const DEST = resolve(ROOT, 'docs', 'app');

function run(label, cmd) {
  console.log(`build-web: ${label}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

run('export', 'npx expo export --platform web --output-dir dist-web');

if (!existsSync(STAGE)) {
  console.error('build-web: ERROR — expected dist-web/ to exist after export');
  process.exit(1);
}

console.log(`build-web: refreshing ${DEST}`);
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(STAGE, DEST, { recursive: true });

// `.nojekyll` lives in the docs/ root (the GitHub Pages site root for this
// repo), NOT in docs/app/. GitHub Pages only honors `.nojekyll` at the
// site root — placing it deeper has no effect, and Jekyll then drops
// every `_expo/` directory under the build output (entry .js 404s).
const NOJEKYLL = resolve(ROOT, 'docs', '.nojekyll');
if (!existsSync(NOJEKYLL)) {
  writeFileSync(NOJEKYLL, '');
}

console.log('build-web: done. Commit docs/app/ and push.');
