import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useReviewSession } from '@/components/session/session-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorView } from '@/components/ui/error-view';
import { LinkButton } from '@/components/ui/link-button';
import { useProgressDb } from '@/db/progress-context';
import {
  getDueProgress,
  getDueWordProgress,
  getNextUpcomingReviewAt,
  getNextUpcomingWordReviewAt,
} from '@/db/progress-queries';
import { SRS_STAGE_LABELS, type KanjiProgress, type WordProgress } from '@/db/progress-types';
import { getKanjiByCharacters, getWordById } from '@/db/queries';
import type { Kanji, Word } from '@/db/types';

type ReviewItem =
  | { type: 'kanji'; kanji: Kanji; progress: KanjiProgress; nextReviewAt: number }
  | { type: 'word'; word: Word; progress: WordProgress; nextReviewAt: number };

function itemKey(item: ReviewItem): string {
  return item.type === 'kanji' ? `k:${item.kanji.character}` : `w:${item.word.id}`;
}

export default function ReviewsScreen() {
  const kanjiDb = useSQLiteContext();
  const progressDb = useProgressDb();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [nextUpcoming, setNextUpcoming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(
    async (signal: { cancelled: boolean }) => {
      setError(null);
      try {
        const [dueKanji, dueWords, upcomingKanji, upcomingWord] = await Promise.all([
          getDueProgress(progressDb),
          getDueWordProgress(progressDb),
          getNextUpcomingReviewAt(progressDb),
          getNextUpcomingWordReviewAt(progressDb),
        ]);

        const [kanjiRows, wordRows] = await Promise.all([
          getKanjiByCharacters(
            kanjiDb,
            dueKanji.map((p) => p.character),
          ),
          Promise.all(dueWords.map((p) => getWordById(kanjiDb, p.wordId))),
        ]);

        const kanjiByChar = new Map(kanjiRows.map((k) => [k.character, k]));
        const wordById = new Map(
          wordRows.filter((w): w is Word => w !== null).map((w) => [w.id, w]),
        );

        const kanjiItems: ReviewItem[] = dueKanji.flatMap((p) => {
          const kanji = kanjiByChar.get(p.character);
          return kanji ? [{ type: 'kanji', kanji, progress: p, nextReviewAt: p.nextReviewAt }] : [];
        });
        const wordItems: ReviewItem[] = dueWords.flatMap((p) => {
          const word = wordById.get(p.wordId);
          return word ? [{ type: 'word', word, progress: p, nextReviewAt: p.nextReviewAt }] : [];
        });
        const merged = [...kanjiItems, ...wordItems].sort(
          (a, b) => a.nextReviewAt - b.nextReviewAt,
        );

        const upcoming =
          upcomingKanji !== null && upcomingWord !== null
            ? Math.min(upcomingKanji, upcomingWord)
            : (upcomingKanji ?? upcomingWord);

        if (!signal.cancelled) {
          setItems(merged);
          setNextUpcoming(upcoming);
        }
      } catch (e) {
        if (!signal.cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    },
    [kanjiDb, progressDb],
  );

  useFocusEffect(
    useCallback(() => {
      const signal = { cancelled: false };
      void loadReviews(signal);
      return () => {
        signal.cancelled = true;
      };
    }, [loadReviews]),
  );

  const retryLoad = useCallback(() => {
    setItems(null);
    void loadReviews({ cancelled: false });
  }, [loadReviews]);

  if (error) {
    return (
      <ErrorView
        title="Something went wrong"
        message="We couldn't load your reviews. Tap Try again or head back to the stages."
        rawError={error}
        onRetry={retryLoad}
      />
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
        keyExtractor={itemKey}
        contentContainerStyle={styles.list}
        renderItem={({ item }) =>
          item.type === 'kanji' ? (
            <KanjiReviewRow kanji={item.kanji} progress={item.progress} />
          ) : (
            <WordReviewRow word={item.word} progress={item.progress} />
          )
        }
      />
    </ThemedView>
  );
}

function KanjiReviewRow({ kanji, progress }: { kanji: Kanji; progress: KanjiProgress }) {
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

function WordReviewRow({ word, progress }: { word: Word; progress: WordProgress }) {
  const overdueMs = Date.now() - progress.nextReviewAt;
  return (
    <LinkButton href={`/word/${word.id}`} outerStyle={styles.rowOuter} innerStyle={styles.row}>
      <View style={styles.wordExprBox}>
        <ThemedText style={styles.wordExpr}>{word.expression}</ThemedText>
        <ThemedText style={styles.wordReading}>{word.reading}</ThemedText>
      </View>
      <View style={styles.rowBody}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {word.meaningsEn.slice(0, 2).join('; ') || '—'}
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
  wordExprBox: {
    width: 80,
    gap: 1,
  },
  wordExpr: {
    fontSize: 20,
    lineHeight: 24,
  },
  wordReading: {
    fontSize: 11,
    opacity: 0.6,
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
