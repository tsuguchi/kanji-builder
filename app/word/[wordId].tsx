import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { WordBuildSection } from '@/components/game/word-build-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
  const [data, setData] = useState<WordStageData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedId = wordId ? Number.parseInt(wordId, 10) : Number.NaN;

  useEffect(() => {
    if (!Number.isFinite(parsedId)) {
      setNotFound(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const word = await getWordById(db, parsedId);
        if (!word) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const kanjiSequence = await getKanjiSequenceForWord(db, word.id);
        const distractors = await getDistractorKanji(
          db,
          word.jlptNew,
          kanjiSequence,
          DISTRACTOR_COUNT,
        );
        if (!cancelled) {
          setData({ word, kanjiSequence, distractors });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, parsedId]);

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Word' }} />
        <ThemedText type="subtitle">DB error</ThemedText>
        <ThemedText>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (notFound) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <ThemedText type="subtitle">Word not found</ThemedText>
        <ThemedText>The word id &quot;{wordId}&quot; is not in the bundled database.</ThemedText>
      </ThemedView>
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

        <WordBuildSection word={word} kanjiSequence={kanjiSequence} distractorChars={distractors} />
      </ScrollView>
    </ThemedView>
  );
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
});
