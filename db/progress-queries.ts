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
 * Record a solve attempt, taking mistake state into account.
 *
 * Stage transition rules:
 *   - New kanji (no existing row): always stage 1, regardless of mistakes.
 *     Learners should not be penalised on the first introduction.
 *   - Clean solve (`hadMistake = false`): stage advances by 1, capped at 8.
 *   - Solve with mistake (`hadMistake = true`): stage drops by 1, floored
 *     at 1. (WaniKani-style penalty, but softened — a single drop instead
 *     of the canonical two.)
 *
 * `next_review_at` is always recomputed from the new stage's interval, so
 * even a "no change" stage 1 + mistake still schedules a fresh review.
 */
export async function recordSolve(
  db: SQLiteDatabase,
  character: string,
  options: { hadMistake: boolean },
  now: number = Date.now(),
): Promise<KanjiProgress> {
  const existing = await getProgressFor(db, character);
  const currentStage = existing?.srsStage ?? 0;

  let nextStage: SrsStage;
  if (currentStage === 0) {
    nextStage = 1;
  } else if (options.hadMistake) {
    nextStage = Math.max(1, currentStage - 1) as SrsStage;
  } else {
    nextStage = Math.min(currentStage + 1, 8) as SrsStage;
  }

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
