import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useReviewSession } from '@/components/session/session-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LinkButton } from '@/components/ui/link-button';
import { useProgressDb } from '@/db/progress-context';
import { getDueProgress, getNextUpcomingReviewAt } from '@/db/progress-queries';
import { SRS_STAGE_LABELS, type KanjiProgress } from '@/db/progress-types';
import { getKanjiByCharacters } from '@/db/queries';
import type { Kanji } from '@/db/types';

interface ReviewItem {
  kanji: Kanji;
  progress: KanjiProgress;
}

export default function ReviewsScreen() {
  const kanjiDb = useSQLiteContext();
  const progressDb = useProgressDb();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [nextUpcoming, setNextUpcoming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const due = await getDueProgress(progressDb);
          const kanji = await getKanjiByCharacters(
            kanjiDb,
            due.map((p) => p.character),
          );
          const progressByChar = new Map(due.map((p) => [p.character, p]));
          const merged: ReviewItem[] = kanji.map((k) => ({
            kanji: k,
            // Always defined because we fetched by these exact characters.
            progress: progressByChar.get(k.character)!,
          }));
          const upcoming = await getNextUpcomingReviewAt(progressDb);
          if (!cancelled) {
            setItems(merged);
            setNextUpcoming(upcoming);
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [kanjiDb, progressDb]),
  );

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">DB error</ThemedText>
        <ThemedText>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (items === null) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (items.length === 0) {
    return <EmptyState nextUpcoming={nextUpcoming} />;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Reviews</ThemedText>
        <ThemedText type="subtitle">{items.length} due</ThemedText>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.kanji.character}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ReviewRow item={item} />}
      />
    </ThemedView>
  );
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const { kanji, progress } = item;
  const overdueMs = Date.now() - progress.nextReviewAt;
  return (
    <LinkButton
      href={`/stage/${kanji.character}`}
      outerStyle={styles.rowOuter}
      innerStyle={styles.row}
    >
      <ThemedText style={styles.glyph}>{kanji.character}</ThemedText>
      <View style={styles.rowBody}>
        <ThemedText type="defaultSemiBold">
          {kanji.meaningsEn.slice(0, 3).join(', ') || '—'}
        </ThemedText>
        <ThemedText style={styles.meta}>
          {SRS_STAGE_LABELS[progress.srsStage]} · due {formatDelta(overdueMs)} ago
        </ThemedText>
      </View>
      <ThemedText style={styles.chevron}>›</ThemedText>
    </LinkButton>
  );
}

function EmptyState({ nextUpcoming }: { nextUpcoming: number | null }) {
  const { solves, dismiss } = useReviewSession();
  const deltaMs = nextUpcoming === null ? null : nextUpcoming - Date.now();

  if (solves.length > 0) {
    return <SessionSummary onDismiss={dismiss} nextUpcoming={nextUpcoming} />;
  }

  return (
    <ThemedView style={styles.centered}>
      <ThemedText style={styles.emptyGlyph}>✓</ThemedText>
      <ThemedText type="title">All caught up!</ThemedText>
      {deltaMs !== null && deltaMs > 0 ? (
        <ThemedText style={styles.emptyHint}>Next review in {formatDelta(deltaMs)}</ThemedText>
      ) : (
        <ThemedText style={styles.emptyHint}>Start clearing stages to schedule reviews.</ThemedText>
      )}
    </ThemedView>
  );
}

function SessionSummary({
  onDismiss,
  nextUpcoming,
}: {
  onDismiss: () => void;
  nextUpcoming: number | null;
}) {
  const { solves } = useReviewSession();
  const total = solves.length;
  const clean = solves.filter((s) => !s.hadMistake).length;
  const withMistake = total - clean;
  const cleanPct = Math.round((clean / total) * 100);
  const deltaMs = nextUpcoming === null ? null : nextUpcoming - Date.now();

  return (
    <ThemedView style={styles.centered}>
      <ThemedText style={styles.emptyGlyph}>✓</ThemedText>
      <ThemedText type="title">Session complete!</ThemedText>
      <ThemedText style={styles.summaryHeadline}>
        {total} reviewed · {cleanPct}% clean
      </ThemedText>
      <View style={styles.summaryBreakdown}>
        <ThemedText style={styles.summaryCountClean}>{clean} clean</ThemedText>
        {withMistake > 0 && (
          <>
            <ThemedText style={styles.summaryDivider}>·</ThemedText>
            <ThemedText style={styles.summaryCountMistake}>{withMistake} with mistake</ThemedText>
          </>
        )}
      </View>
      {deltaMs !== null && deltaMs > 0 && (
        <ThemedText style={styles.emptyHint}>Next review in {formatDelta(deltaMs)}</ThemedText>
      )}
      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [styles.dismissButton, pressed && styles.dismissButtonPressed]}
      >
        <ThemedText type="defaultSemiBold">Dismiss</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function formatDelta(ms: number): string {
  const abs = Math.abs(ms);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) return `${Math.max(1, Math.round(abs / minute))}m`;
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  rowOuter: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  glyph: {
    fontSize: 40,
    lineHeight: 48,
    width: 56,
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
  chevron: {
    fontSize: 26,
    opacity: 0.35,
    paddingHorizontal: 4,
  },
  emptyGlyph: {
    fontSize: 64,
    color: '#3a9d3a',
    lineHeight: 72,
  },
  emptyHint: {
    opacity: 0.6,
    fontSize: 14,
    textAlign: 'center',
  },
  summaryHeadline: {
    fontSize: 16,
    textAlign: 'center',
  },
  summaryBreakdown: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  summaryCountClean: {
    color: '#3a9d3a',
    fontWeight: '600',
  },
  summaryCountMistake: {
    color: '#d18a2a',
    fontWeight: '600',
  },
  summaryDivider: {
    opacity: 0.4,
  },
  dismissButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
  },
  dismissButtonPressed: {
    opacity: 0.5,
  },
});
