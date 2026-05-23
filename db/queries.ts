import type { SQLiteDatabase } from 'expo-sqlite';

import {
  decodeKanji,
  decodeWord,
  type Kanji,
  type KanjiRow,
  type RadicalDecomposition,
  type Word,
  type WordRow,
} from '@/db/types';

/**
 * Kanji at the given modern JLPT level, ordered by newspaper frequency
 * (most-frequent first, NULL frequencies last so well-known characters
 * surface before obscure ones).
 */
export async function getKanjiByJlptNew(db: SQLiteDatabase, level: number): Promise<Kanji[]> {
  const rows = await db.getAllAsync<KanjiRow>(
    `SELECT character, stroke_count, jlpt_old, jouyou_grade, frequency_rank,
            meanings_en, onyomi, kunyomi, radical_classical, jlpt_new
       FROM kanji
      WHERE jlpt_new = ?
      ORDER BY frequency_rank IS NULL, frequency_rank`,
    [level],
  );
  return rows.map(decodeKanji);
}

/**
 * Bulk kanji lookup. Returned order matches `characters`; characters not in
 * the DB are silently dropped. Used by the Reviews screen, which has a list
 * of characters from `progress.sqlite` and needs the matching kanji metadata
 * from the bundled DB (cross-DB JOIN is not possible).
 */
export async function getKanjiByCharacters(
  db: SQLiteDatabase,
  characters: readonly string[],
): Promise<Kanji[]> {
  if (characters.length === 0) return [];
  const placeholders = characters.map(() => '?').join(', ');
  const rows = await db.getAllAsync<KanjiRow>(
    `SELECT character, stroke_count, jlpt_old, jouyou_grade, frequency_rank,
            meanings_en, onyomi, kunyomi, radical_classical, jlpt_new
       FROM kanji
      WHERE character IN (${placeholders})`,
    [...characters],
  );
  const byChar = new Map(rows.map((r) => [r.character, decodeKanji(r)]));
  return characters.flatMap((c) => {
    const k = byChar.get(c);
    return k ? [k] : [];
  });
}

/** Single kanji lookup by character. Returns null if absent (e.g. malformed route param). */
export async function getKanjiByCharacter(
  db: SQLiteDatabase,
  character: string,
): Promise<Kanji | null> {
  const row = await db.getFirstAsync<KanjiRow>(
    `SELECT character, stroke_count, jlpt_old, jouyou_grade, frequency_rank,
            meanings_en, onyomi, kunyomi, radical_classical, jlpt_new
       FROM kanji
      WHERE character = ?`,
    [character],
  );
  return row ? decodeKanji(row) : null;
}

/**
 * KRADFILE-derived radical decomposition for a single kanji. Ordered by
 * radical character for stable display.
 */
export async function getRadicalsForKanji(
  db: SQLiteDatabase,
  kanjiChar: string,
): Promise<RadicalDecomposition[]> {
  return db.getAllAsync<RadicalDecomposition>(
    `SELECT radical_char AS radicalChar, count
       FROM kanji_radicals
      WHERE kanji_char = ?
      ORDER BY radical_char`,
    [kanjiChar],
  );
}

/**
 * JLPT vocab words that contain the given kanji, ordered easiest-first
 * (highest jlpt_new) then by expression length so short, common words
 * surface above longer compounds. Used by the Stage detail screen to show
 * "this kanji is used in these words" alongside the radical decomposition.
 *
 * The `words` / `word_kanji` tables come from the jamsinclair vocab list
 * (see scripts/05_parse_jlpt_vocab.py). DISTINCT is needed because a
 * single kanji can appear multiple times in a word (e.g. 日日 — though
 * with position the JOIN can return one row per occurrence).
 */
export async function getWordsForKanji(db: SQLiteDatabase, kanjiChar: string): Promise<Word[]> {
  const rows = await db.getAllAsync<WordRow>(
    `SELECT DISTINCT w.id, w.expression, w.reading, w.meanings_en, w.jlpt_new, w.source_guid
       FROM words w
       JOIN word_kanji wk ON wk.word_id = w.id
      WHERE wk.kanji_char = ?
      ORDER BY w.jlpt_new DESC, length(w.expression), w.expression`,
    [kanjiChar],
  );
  return rows.map(decodeWord);
}

/**
 * Radical characters used by other kanji at the given JLPT-new level, excluding
 * any radical that already appears in `excludeRadicals`. Returns up to `count`
 * characters in random order. Used to populate "distractor" chips for the
 * radical-building game so the user has to discriminate, not just dump every
 * chip into the build zone.
 */
export async function getDistractorRadicals(
  db: SQLiteDatabase,
  jlptNewLevel: number,
  excludeRadicals: readonly string[],
  count: number,
): Promise<string[]> {
  const placeholders = excludeRadicals.map(() => '?').join(', ');
  const exclusionClause = excludeRadicals.length
    ? `AND kr.radical_char NOT IN (${placeholders})`
    : '';
  const rows = await db.getAllAsync<{ radicalChar: string }>(
    `SELECT DISTINCT kr.radical_char AS radicalChar
       FROM kanji_radicals kr
       JOIN kanji k ON k.character = kr.kanji_char
      WHERE k.jlpt_new = ?
        ${exclusionClause}
      ORDER BY RANDOM()
      LIMIT ?`,
    [jlptNewLevel, ...excludeRadicals, count],
  );
  return rows.map((r) => r.radicalChar);
}
