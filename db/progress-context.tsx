import * as SQLite from 'expo-sqlite';
import { createContext, use, useContext, type ReactNode } from 'react';

import { PROGRESS_SCHEMA } from '@/db/progress-types';

const PROGRESS_DB_FILE = 'progress.sqlite';

const ProgressDbContext = createContext<SQLite.SQLiteDatabase | null>(null);

// Module-level singleton so React 19's `use(promise)` returns a stable
// reference across renders. Opening the DB and applying the schema only
// happens once per app session.
let progressDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function loadProgressDb(): Promise<SQLite.SQLiteDatabase> {
  if (!progressDbPromise) {
    progressDbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(PROGRESS_DB_FILE);
      await db.execAsync(PROGRESS_SCHEMA);
      return db;
    })();
  }
  return progressDbPromise;
}

/**
 * Opens `progress.sqlite` (writable, on-device) once and exposes it via
 * React Context. Wrap inside a `<Suspense>` boundary — the initial open
 * suspends via the React 19 `use(promise)` API.
 */
export function ProgressDbProvider({ children }: { children: ReactNode }) {
  const db = use(loadProgressDb());
  return <ProgressDbContext.Provider value={db}>{children}</ProgressDbContext.Provider>;
}

/** Get the writable progress database. Throws if used outside the provider. */
export function useProgressDb(): SQLite.SQLiteDatabase {
  const db = useContext(ProgressDbContext);
  if (!db) {
    throw new Error('useProgressDb must be used inside <ProgressDbProvider>');
  }
  return db;
}
