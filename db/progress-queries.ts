import type { SQLiteDatabase } from 'expo-sqlite';

import {
  SRS_STAGE_INTERVALS_MS,
  type ActivityStats,
  type KanjiProgress,
  type SrsStage,
  type WordProgress,
} from '@/db/progress-types';

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

  // Also append to the per-event log so streak / daily-count stats survive
  // independently of the kanji_progress upsert. INSERT-only — never updated.
  await db.runAsync(`INSERT INTO activity_log (character, had_mistake, at) VALUES (?, ?, ?)`, [
    character,
    options.hadMistake ? 1 : 0,
    now,
  ]);

  return {
    character,
    srsStage: nextStage,
    clearedAt,
    lastReviewedAt: now,
    nextReviewAt,
  };
}

// === Word progress (PR #3a) ===
//
// Parallel to the kanji_progress helpers above, but indexed by `word_id`
// (the bundled DB's words.id) rather than character. Source guid is stored
// alongside as a forward-compat key for future bundle rebuilds. Reviews-
// screen and Activity-stats integration happen in PR #3b.

interface WordProgressRow {
  wordId: number;
  sourceGuid: string | null;
  srsStage: number;
  clearedAt: number;
  lastReviewedAt: number;
  nextReviewAt: number;
}

function decodeWordProgress(row: WordProgressRow): WordProgress {
  return {
    wordId: row.wordId,
    sourceGuid: row.sourceGuid,
    srsStage: row.srsStage as SrsStage,
    clearedAt: row.clearedAt,
    lastReviewedAt: row.lastReviewedAt,
    nextReviewAt: row.nextReviewAt,
  };
}

/** Single word lookup. Null if the user hasn't cleared this word yet. */
export async function getWordProgressFor(
  db: SQLiteDatabase,
  wordId: number,
): Promise<WordProgress | null> {
  const row = await db.getFirstAsync<WordProgressRow>(
    `SELECT word_id           AS wordId,
            source_guid       AS sourceGuid,
            srs_stage         AS srsStage,
            cleared_at        AS clearedAt,
            last_reviewed_at  AS lastReviewedAt,
            next_review_at    AS nextReviewAt
       FROM word_progress
      WHERE word_id = ?`,
    [wordId],
  );
  return row ? decodeWordProgress(row) : null;
}

/** All cleared words with their SRS state. Used to mark Stage detail Words rows. */
export async function getAllWordProgress(db: SQLiteDatabase): Promise<WordProgress[]> {
  const rows = await db.getAllAsync<WordProgressRow>(
    `SELECT word_id           AS wordId,
            source_guid       AS sourceGuid,
            srs_stage         AS srsStage,
            cleared_at        AS clearedAt,
            last_reviewed_at  AS lastReviewedAt,
            next_review_at    AS nextReviewAt
       FROM word_progress`,
  );
  return rows.map(decodeWordProgress);
}

/**
 * Record a solve attempt for a vocab word. Stage transition rules mirror
 * `recordSolve` for kanji (no penalty on first introduction, +1 on clean,
 * -1 on mistake, capped 1..8). Kept as a separate function instead of
 * generic to keep the column names (`word_id` vs `character`) and the
 * `source_guid` write explicit at the call site.
 */
export async function recordWordSolve(
  db: SQLiteDatabase,
  wordId: number,
  sourceGuid: string | null,
  options: { hadMistake: boolean },
  now: number = Date.now(),
): Promise<WordProgress> {
  const existing = await getWordProgressFor(db, wordId);
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
    `INSERT INTO word_progress
       (word_id, source_guid, srs_stage, cleared_at, last_reviewed_at, next_review_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(word_id) DO UPDATE SET
       source_guid       = excluded.source_guid,
       srs_stage         = excluded.srs_stage,
       last_reviewed_at  = excluded.last_reviewed_at,
       next_review_at    = excluded.next_review_at`,
    [wordId, sourceGuid, nextStage, clearedAt, now, nextReviewAt],
  );

  // Per-event log so daily counts / streak survive independently of the
  // word_progress upsert (which only retains the latest review per word).
  await db.runAsync(`INSERT INTO word_activity_log (word_id, had_mistake, at) VALUES (?, ?, ?)`, [
    wordId,
    options.hadMistake ? 1 : 0,
    now,
  ]);

  return {
    wordId,
    sourceGuid,
    srsStage: nextStage,
    clearedAt,
    lastReviewedAt: now,
    nextReviewAt,
  };
}

/** Word progress rows currently due (`next_review_at <= now`), most-overdue first. */
export async function getDueWordProgress(
  db: SQLiteDatabase,
  now: number = Date.now(),
): Promise<WordProgress[]> {
  const rows = await db.getAllAsync<WordProgressRow>(
    `SELECT word_id           AS wordId,
            source_guid       AS sourceGuid,
            srs_stage         AS srsStage,
            cleared_at        AS clearedAt,
            last_reviewed_at  AS lastReviewedAt,
            next_review_at    AS nextReviewAt
       FROM word_progress
      WHERE next_review_at <= ?
      ORDER BY next_review_at ASC`,
    [now],
  );
  return rows.map(decodeWordProgress);
}

/** Earliest future `next_review_at` for words, or null if none. */
export async function getNextUpcomingWordReviewAt(
  db: SQLiteDatabase,
  now: number = Date.now(),
): Promise<number | null> {
  const row = await db.getFirstAsync<{ nextReviewAt: number }>(
    `SELECT MIN(next_review_at) AS nextReviewAt
       FROM word_progress
      WHERE next_review_at > ?`,
    [now],
  );
  return row?.nextReviewAt ?? null;
}

/**
 * Aggregate activity log entries into per-day stats across both kinds:
 *
 * - `todayKanjiCount`: distinct kanji solved at least once today.
 * - `todayWordCount`: distinct words solved at least once today.
 * - `streakDays`: consecutive local days with at least one event of EITHER
 *   kind, walking back from today. A day with only words (or only kanji)
 *   keeps the streak alive — the goal is "touched the app meaningfully
 *   today", not "did the same kind of practice every day".
 *
 * Streak uses local time so a user's "day" matches the wall clock they live
 * in. Reading every distinct day key from both tables is fine even for
 * years of activity — a few thousand integers at most.
 */
export async function getActivityStats(
  db: SQLiteDatabase,
  now: number = Date.now(),
): Promise<ActivityStats> {
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;

  const todayKanjiRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT character) AS count
       FROM activity_log
      WHERE at >= ? AND at < ?`,
    [todayStart, tomorrowStart],
  );
  const todayKanjiCount = todayKanjiRow?.count ?? 0;

  const todayWordRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT word_id) AS count
       FROM word_activity_log
      WHERE at >= ? AND at < ?`,
    [todayStart, tomorrowStart],
  );
  const todayWordCount = todayWordRow?.count ?? 0;

  // Union day keys from both logs for the streak. We pull only timestamps,
  // so a single SQL UNION ALL is cheaper than two round-trips.
  const allRows = await db.getAllAsync<{ at: number }>(
    `SELECT at FROM activity_log
     UNION ALL
     SELECT at FROM word_activity_log`,
  );
  const dayKeys = new Set(allRows.map((r) => localDayKey(r.at)));
  const streakDays = computeStreakDays(dayKeys, now);

  return { todayKanjiCount, todayWordCount, streakDays };
}

/** Local-day boundary (00:00 local time of `now`'s day) in epoch ms. */
function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** `YYYY-MM-DD` in local time. Suitable as a Set key for day grouping. */
function localDayKey(at: number): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeStreakDays(dayKeys: Set<string>, now: number): number {
  let streak = 0;
  // Use Date arithmetic so DST transitions don't accidentally skip a day
  // (JST has no DST, but the app targets learners worldwide).
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  while (dayKeys.has(localDayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
