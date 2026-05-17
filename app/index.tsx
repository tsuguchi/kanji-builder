import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useProgressDb } from '@/db/progress-context';
import { getAllProgress } from '@/db/progress-queries';
import type { KanjiProgress } from '@/db/progress-types';
import { getKanjiByJlptNew } from '@/db/queries';
import type { Kanji } from '@/db/types';

export default function StageSelectionScreen() {
  const db = useSQLiteContext();
  const progressDb = useProgressDb();
  const [stages, setStages] = useState<Kanji[] | null>(null);
  const [progress, setProgress] = useState<Map<string, KanjiProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [n5, allProgress] = await Promise.all([
            getKanjiByJlptNew(db, 5),
            getAllProgress(progressDb),
          ]);
          if (!cancelled) {
            setStages(n5);
            setProgress(new Map(allProgress.map((p) => [p.character, p])));
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [db, progressDb]),
  );

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">DB error</ThemedText>
        <ThemedText>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (stages === null) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const clearedCount = progress.size;
  const now = Date.now();
  const dueCount = Array.from(progress.values()).filter((p) => p.nextReviewAt <= now).length;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">N5 Stages</ThemedText>
        <ThemedText type="subtitle">
          {clearedCount}/{stages.length} cleared
        </ThemedText>
        {dueCount > 0 && (
          <Link href="/reviews" asChild>
            <Pressable
              style={({ pressed }) => [styles.reviewsCta, pressed && styles.reviewsCtaPressed]}
            >
              <ThemedText type="defaultSemiBold" style={styles.reviewsCtaText}>
                {dueCount} review{dueCount > 1 ? 's' : ''} due →
              </ThemedText>
            </Pressable>
          </Link>
        )}
      </View>
      <FlatList
        data={stages}
        keyExtractor={(item) => item.character}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <StageRow stage={item} order={index + 1} progress={progress.get(item.character)} />
        )}
      />
    </ThemedView>
  );
}

function StageRow({
  stage,
  order,
  progress,
}: {
  stage: Kanji;
  order: number;
  progress?: KanjiProgress;
}) {
  const now = Date.now();
  const isDue = progress !== undefined && progress.nextReviewAt <= now;
  const isCleared = progress !== undefined;
  return (
    <Link href={`/stage/${stage.character}`} asChild>
      <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <ThemedText style={styles.order}>{String(order).padStart(2, '0')}</ThemedText>
        <ThemedText style={styles.glyph}>{stage.character}</ThemedText>
        <View style={styles.rowBody}>
          <ThemedText type="defaultSemiBold">
            {stage.meaningsEn.slice(0, 3).join(', ') || '—'}
          </ThemedText>
          <ThemedText style={styles.meta}>{stage.strokeCount} strokes</ThemedText>
        </View>
        <View style={styles.badges}>
          {isDue && (
            <View style={styles.dueBadge}>
              <ThemedText style={styles.dueBadgeText}>Due</ThemedText>
            </View>
          )}
          {isCleared && <ThemedText style={styles.checkMark}>✓</ThemedText>}
        </View>
        <ThemedText style={styles.chevron}>›</ThemedText>
      </Pressable>
    </Link>
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
    paddingHorizontal: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 12,
    gap: 4,
  },
  reviewsCta: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#c66',
    alignSelf: 'flex-start',
  },
  reviewsCtaPressed: {
    opacity: 0.6,
  },
  reviewsCtaText: {
    color: '#fff',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  rowPressed: {
    opacity: 0.6,
  },
  order: {
    width: 28,
    fontSize: 13,
    opacity: 0.5,
    textAlign: 'right',
  },
  glyph: {
    fontSize: 40,
    lineHeight: 48,
    width: 48,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  meta: {
    opacity: 0.7,
    fontSize: 13,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#c66',
  },
  dueBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  checkMark: {
    fontSize: 20,
    color: '#3a9d3a',
  },
  chevron: {
    fontSize: 26,
    opacity: 0.35,
    paddingHorizontal: 4,
  },
});
