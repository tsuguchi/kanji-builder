import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useProgressDb } from '@/db/progress-context';
import { getActivityStats, getAllProgress } from '@/db/progress-queries';
import type { ActivityStats, KanjiProgress } from '@/db/progress-types';
import { getKanjiByJlptNew } from '@/db/queries';
import type { Kanji } from '@/db/types';

export default function StageSelectionScreen() {
  const db = useSQLiteContext();
  const progressDb = useProgressDb();
  const [stages, setStages] = useState<Kanji[] | null>(null);
  const [progress, setProgress] = useState<Map<string, KanjiProgress>>(new Map());
  const [activity, setActivity] = useState<ActivityStats>({ todayCount: 0, streakDays: 0 });
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [n5, allProgress, stats] = await Promise.all([
            getKanjiByJlptNew(db, 5),
            getAllProgress(progressDb),
            getActivityStats(progressDb),
          ]);
          if (!cancelled) {
            setStages(n5);
            setProgress(new Map(allProgress.map((p) => [p.character, p])));
            setActivity(stats);
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

  const hasActivity = activity.todayCount > 0 || activity.streakDays > 0;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">N5 Stages</ThemedText>
        <ThemedText type="subtitle">
          {clearedCount}/{stages.length} cleared
        </ThemedText>
        {hasActivity && (
          <ThemedText style={styles.activityLine}>
            {activity.todayCount > 0 && `${activity.todayCount} today`}
            {activity.todayCount > 0 && activity.streakDays > 0 && ' · '}
            {activity.streakDays > 0 &&
              `${activity.streakDays}-day streak${activity.streakDays >= 7 ? ' 🔥' : ''}`}
          </ThemedText>
        )}
        <Link href="/reviews" asChild>
          <Pressable
            style={({ pressed }) => [styles.reviewsCtaOuter, pressed && styles.reviewsCtaPressed]}
          >
            {/* Inner View carries the visible button frame (background /
                border / padding) — same `<Link asChild><Pressable>` style
                forwarding caveat from PR #27 means the frame disappears if
                applied directly to Pressable. */}
            <View
              style={[
                styles.reviewsCta,
                dueCount > 0 ? styles.reviewsCtaDue : styles.reviewsCtaIdle,
              ]}
            >
              <ThemedText
                type="defaultSemiBold"
                style={dueCount > 0 ? styles.reviewsCtaTextDue : styles.reviewsCtaTextIdle}
              >
                {dueCount > 0 ? `${dueCount} review${dueCount > 1 ? 's' : ''} due →` : 'Reviews →'}
              </ThemedText>
            </View>
          </Pressable>
        </Link>
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
      <Pressable style={({ pressed }) => [styles.rowOuter, pressed && styles.rowPressed]}>
        {/* Inner view holds the horizontal layout: <Link asChild> + Pressable
            on the new RN architecture sometimes drops the function-style
            output's `flexDirection` for the touchable's underlying view,
            collapsing the row vertically. Anchoring layout to an explicit
            inner <View> sidesteps that. */}
        <View style={styles.row}>
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
        </View>
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
  activityLine: {
    fontSize: 13,
    opacity: 0.7,
  },
  reviewsCtaOuter: {
    // Pressable scope: positioning + pressed feedback only. The visible
    // frame moves to the inner View (styles.reviewsCta).
    marginTop: 8,
    // `alignSelf` deliberately not here — see PR #28: Pressable on the new
    // arch drops function-style properties. We move alignSelf to the inner
    // View instead so the visible button stays content-width. The Pressable
    // ends up full-width, which is actually fine: more touch area for the
    // same compact red button.
  },
  reviewsCta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reviewsCtaDue: {
    backgroundColor: '#c66',
  },
  reviewsCtaIdle: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    backgroundColor: 'transparent',
  },
  reviewsCtaPressed: {
    opacity: 0.6,
  },
  reviewsCtaTextDue: {
    color: '#fff',
    fontSize: 14,
  },
  reviewsCtaTextIdle: {
    fontSize: 14,
    opacity: 0.7,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  rowOuter: {
    // Border / padding stay on the outer Pressable so the tap area covers
    // the full row visually.
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
