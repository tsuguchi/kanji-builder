import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { WordBuildSection } from '@/components/game/word-build-section';
import { useReviewSession } from '@/components/session/session-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorView } from '@/components/ui/error-view';
import { useProgressDb } from '@/db/progress-context';
import { getWordProgressFor, recordWordSolve } from '@/db/progress-queries';
import { SRS_STAGE_LABELS, type WordProgress } from '@/db/progress-types';
import { getDistractorKanji, getKanjiSequenceForWord, getWordById } from '@/db/queries';
import type { Word } from '@/db/types';

const DISTRACTOR_COUNT = 3;

interface WordStageData {
  word: Word;
  kanjiSequence: string[];
  distractors: string[];
}

export default function WordStageScreen() {
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  const db = useSQLiteContext();
  const progressDb = useProgressDb();
  const session = useReviewSession();
  const [data, setData] = useState<WordStageData | null>(null);
  const [progress, setProgress] = useState<WordProgress | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedId = wordId ? Number.parseInt(wordId, 10) : Number.NaN;

  const loadWord = useCallback(
    async (signal: { cancelled: boolean }) => {
      if (!Number.isFinite(parsedId)) {
        setNotFound(true);
        return;
      }
      setError(null);
      setNotFound(false);
      try {
        const word = await getWordById(db, parsedId);
        if (!word) {
          if (!signal.cancelled) setNotFound(true);
          return;
        }
        const kanjiSequence = await getKanjiSequenceForWord(db, word.id);
        const [distractors, existingProgress] = await Promise.all([
          getDistractorKanji(db, word.jlptNew, kanjiSequence, DISTRACTOR_COUNT),
          getWordProgressFor(progressDb, word.id),
        ]);
        if (!signal.cancelled) {
          setData({ word, kanjiSequence, distractors });
          setProgress(existingProgress);
        }
      } catch (e) {
        if (!signal.cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    },
    [db, progressDb, parsedId],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    void loadWord(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadWord]);

  const retryLoad = useCallback(() => {
    setData(null);
    void loadWord({ cancelled: false });
  }, [loadWord]);

  const handleFirstSolve = async (result: { hadMistake: boolean }) => {
    if (!data) return;
    // Mirror the kanji-side pattern: record into the ephemeral session log
    // before/in-parallel with persistence, so the Reviews summary surfaces
    // even if the SRS write somehow errors.
    session.recordWordSolve(data.word.id, result.hadMistake);
    try {
      const newProgress = await recordWordSolve(
        progressDb,
        data.word.id,
        data.word.sourceGuid,
        result,
      );
      setProgress(newProgress);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Word' }} />
        <ErrorView
          title="Something went wrong"
          message="We couldn't load this word. The bundled database may be in an unexpected state."
          rawError={error}
          onRetry={retryLoad}
        />
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <ErrorView
          title="Word not found"
          message={`The word id "${wordId ?? ''}" isn't in the bundled database.`}
          glyph="✕"
        />
      </>
    );
  }

  if (data === null) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Word' }} />
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const { word, kanjiSequence, distractors } = data;

  return (
    <ThemedView style={styles.container}>
      {/* Header title intentionally omits the kanji — the puzzle would
          otherwise reveal the answer at the top of the screen. Showing the
          reading instead gives the user enough context to navigate. */}
      <Stack.Screen options={{ title: word.reading }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metaBox}>
          <ThemedText style={styles.metaLevel}>N{word.jlptNew} word</ThemedText>
          <ThemedText style={styles.metaAll}>
            All meanings: {word.meaningsEn.join('; ') || '—'}
          </ThemedText>
        </View>

        {progress && <WordProgressSummary progress={progress} />}

        <WordBuildSection
          word={word}
          kanjiSequence={kanjiSequence}
          distractorChars={distractors}
          onFirstSolve={handleFirstSolve}
        />
      </ScrollView>
    </ThemedView>
  );
}

function WordProgressSummary({ progress }: { progress: WordProgress }) {
  const now = Date.now();
  const isDue = progress.nextReviewAt <= now;
  const dueIn = formatRelative(progress.nextReviewAt - now);
  return (
    <View style={styles.progressBox}>
      <ThemedText type="defaultSemiBold" style={styles.progressStage}>
        {SRS_STAGE_LABELS[progress.srsStage]} (stage {progress.srsStage}/8)
      </ThemedText>
      <ThemedText style={styles.progressMeta}>
        {isDue ? `Review due (was scheduled ${dueIn})` : `Next review in ${dueIn}`}
      </ThemedText>
    </View>
  );
}

function formatRelative(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (abs < hour) return `${Math.max(1, Math.round(abs / (60 * 1000)))}m`;
  if (abs < day) return `${Math.round(abs / hour)}h`;
  return `${Math.round(abs / day)}d`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  metaBox: {
    gap: 4,
  },
  metaLevel: {
    fontSize: 12,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaAll: {
    fontSize: 13,
    opacity: 0.7,
  },
  progressBox: {
    gap: 4,
  },
  progressStage: {
    fontSize: 16,
  },
  progressMeta: {
    opacity: 0.6,
    fontSize: 13,
  },
});
