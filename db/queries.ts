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
