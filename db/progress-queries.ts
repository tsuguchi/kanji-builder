import type { SQLiteDatabase } from 'expo-sqlite';

import { SRS_STAGE_INTERVALS_MS, type KanjiProgress, type SrsStage } from '@/db/progress-types';

interface ProgressRow {
  character: string;
  srsStage: number;
  clearedAt: number;
  lastReviewedAt: number;
  nextReviewAt: number;
}

function decode(row: ProgressRow): KanjiProgress {
  return {
    character: row.character,
    srsStage: row.srsStage as SrsStage,
    clearedAt: row.clearedAt,
    lastReviewedAt: row.lastReviewedAt,
    nextReviewAt: row.nextReviewAt,
  };
}

/**
 * Progress rows currently due for review (`next_review_at <= now`).
 * Ordered most-overdue first.
 */
export async function getDueProgress(
  db: SQLiteDatabase,
  now: number = Date.now(),
): Promise<KanjiProgress[]> {
  const rows = await db.getAllAsync<ProgressRow>(
    `SELECT character,
            srs_stage         AS srsStage,
            cleared_at        AS clearedAt,
            last_reviewed_at  AS lastReviewedAt,
            next_review_at    AS nextReviewAt
       FROM kanji_progress
      WHERE next_review_at <= ?
      ORDER BY next_review_at ASC`,
    [now],
  );
  return rows.map(decode);
}

/**
 * Earliest `next_review_at` in the future (i.e. closest upcoming review),
 * or `null` if there are no future reviews scheduled. Used by the Reviews
 * empty state to tell the user when to come back.
 */
export async function getNextUpcomingReviewAt(
  db: SQLiteDatabase,
  now: number = Date.now(),
): Promise<number | null> {
  const row = await db.getFirstAsync<{ nextReviewAt: number }>(
    `SELECT MIN(next_review_at) AS nextReviewAt
       FROM kanji_progress
      WHERE next_review_at > ?`,
    [now],
  );
  return row?.nextReviewAt ?? null;
}

/** All cleared kanji with their SRS state. Empty array = no clears yet. */
export async function getAllProgress(db: SQLiteDatabase): Promise<KanjiProgress[]> {
  const rows = await db.getAllAsync<ProgressRow>(
    `SELECT character,
            srs_stage         AS srsStage,
            cleared_at        AS clearedAt,
            last_reviewed_at  AS lastReviewedAt,
            next_review_at    AS nextReviewAt
       FROM kanji_progress`,
  );
  return rows.map(decode);
}

/** Single character lookup. Null if the user hasn't cleared this kanji yet. */
export async function getProgressFor(
  db: SQLiteDatabase,
  character: string,
): Promise<KanjiProgress | null> {
  const row = await db.getFirstAsync<ProgressRow>(
    `SELECT character,
            srs_stage         AS srsStage,
            cleared_at        AS clearedAt,
            last_reviewed_at  AS lastReviewedAt,
            next_review_at    AS nextReviewAt
       FROM kanji_progress
      WHERE character = ?`,
    [character],
  );
  return row ? decode(row) : null;
}

/**
 * Record a successful solve. Advances the SRS stage by 1 (capped at 8) and
 * schedules the next review according to `SRS_STAGE_INTERVALS_MS`. If the
 * kanji has never been cleared before, this inserts at stage 1.
 *
 * Returns the new progress row.
 */
export async function recordCorrect(
  db: SQLiteDatabase,
  character: string,
  now: number = Date.now(),
): Promise<KanjiProgress> {
  const existing = await getProgressFor(db, character);
  const nextStage = (Math.min((existing?.srsStage ?? 0) + 1, 8) || 1) as SrsStage;
  const interval = SRS_STAGE_INTERVALS_MS[nextStage - 1];
  const clearedAt = existing?.clearedAt ?? now;
  const nextReviewAt = now + interval;

  await db.runAsync(
    `INSERT INTO kanji_progress
       (character, srs_stage, cleared_at, last_reviewed_at, next_review_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(character) DO UPDATE SET
       srs_stage         = excluded.srs_stage,
       last_reviewed_at  = excluded.last_reviewed_at,
       next_review_at    = excluded.next_review_at`,
    [character, nextStage, clearedAt, now, nextReviewAt],
  );

  return {
    character,
    srsStage: nextStage,
    clearedAt,
    lastReviewedAt: now,
    nextReviewAt,
  };
}
