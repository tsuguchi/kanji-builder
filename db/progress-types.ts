/**
 * User progress schema for `progress.sqlite` (writable, on-device).
 *
 * Kept separate from the bundled `kanji.sqlite` (read-only static data) so
 * that future updates to the kanji bundle do not risk wiping user progress.
 */

/**
 * WaniKani-inspired discrete SRS stages, 1-8 (with implicit "stage 0" =
 * not started, represented by the absence of a row).
 */
export type SrsStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Time intervals (ms) until the next review for each stage. Index = stage - 1. */
export const SRS_STAGE_INTERVALS_MS: readonly number[] = [
  4 * 60 * 60 * 1000, // Apprentice 1 — 4h
  8 * 60 * 60 * 1000, // Apprentice 2 — 8h
  1 * 24 * 60 * 60 * 1000, // Apprentice 3 — 1d
  2 * 24 * 60 * 60 * 1000, // Apprentice 4 — 2d
  7 * 24 * 60 * 60 * 1000, // Guru 1 — 1w
  14 * 24 * 60 * 60 * 1000, // Guru 2 — 2w
  30 * 24 * 60 * 60 * 1000, // Master — 1mo
  120 * 24 * 60 * 60 * 1000, // Enlightened — 4mo
];

export const SRS_STAGE_LABELS: Record<SrsStage, string> = {
  1: 'Apprentice 1',
  2: 'Apprentice 2',
  3: 'Apprentice 3',
  4: 'Apprentice 4',
  5: 'Guru 1',
  6: 'Guru 2',
  7: 'Master',
  8: 'Enlightened',
};

export interface KanjiProgress {
  character: string;
  srsStage: SrsStage;
  /** epoch ms — when the user first cleared this kanji */
  clearedAt: number;
  /** epoch ms — most recent successful solve */
  lastReviewedAt: number;
  /** epoch ms — when this kanji becomes eligible for review again */
  nextReviewAt: number;
}

/** Per-day activity statistics summarising the `activity_log` table. */
export interface ActivityStats {
  /** Distinct kanji solved at least once today (local day boundary). */
  todayCount: number;
  /**
   * Consecutive local-day count ending today, inclusive. 0 when today has
   * no activity. Skipping a day (or starting fresh) resets to 0 / 1.
   */
  streakDays: number;
}

/** Schema applied via `db.execAsync` on every open (idempotent IF NOT EXISTS). */
export const PROGRESS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS kanji_progress (
    character         TEXT PRIMARY KEY,
    srs_stage         INTEGER NOT NULL CHECK (srs_stage BETWEEN 1 AND 8),
    cleared_at        INTEGER NOT NULL,
    last_reviewed_at  INTEGER NOT NULL,
    next_review_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_progress_next_review ON kanji_progress(next_review_at);

  -- Per-event log so we can compute streaks and per-day counts independently
  -- of the kanji_progress upsert (which only retains the latest review per
  -- character). Existing DBs without this table will get it on next open.
  CREATE TABLE IF NOT EXISTS activity_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character    TEXT NOT NULL,
    had_mistake  INTEGER NOT NULL,
    at           INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_at ON activity_log(at);
  CREATE INDEX IF NOT EXISTS idx_activity_character ON activity_log(character);
`;
