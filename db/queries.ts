import type { SQLiteDatabase } from 'expo-sqlite';

import { decodeKanji, type Kanji, type KanjiRow, type RadicalDecomposition } from '@/db/types';

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
