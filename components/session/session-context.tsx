import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Ephemeral review-session log. Records each `onFirstSolve` event from a
 * stage detail screen so the Reviews screen can summarise the burst of
 * solves as a "Session complete!" panel.
 *
 * In-memory only — resets on app restart and on explicit dismiss. Not
 * persisted because:
 *   - SRS state on disk already captures the cumulative learning record.
 *   - The session summary is a UX flourish to mark the end of a review
 *     burst, not an analytics surface; rebuilding it across launches adds
 *     no learner value.
 *
 * Reset rule: callers should invoke `dismiss()` when the user has
 * acknowledged the summary (or when explicitly starting a fresh session).
 */

export interface SessionSolve {
  character: string;
  hadMistake: boolean;
  at: number;
}

interface SessionContextValue {
  solves: SessionSolve[];
  recordSolve: (character: string, hadMistake: boolean) => void;
  dismiss: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [solves, setSolves] = useState<SessionSolve[]>([]);

  const recordSolve = useCallback((character: string, hadMistake: boolean) => {
    setSolves((prev) => [...prev, { character, hadMistake, at: Date.now() }]);
  }, []);

  const dismiss = useCallback(() => {
    setSolves([]);
  }, []);

  const value = useMemo(() => ({ solves, recordSolve, dismiss }), [solves, recordSolve, dismiss]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useReviewSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useReviewSession must be used inside <SessionProvider>');
  }
  return ctx;
}
