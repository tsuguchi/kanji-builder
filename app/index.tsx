import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LevelSegment, type LevelCount } from '@/components/ui/level-segment';
import { LinkButton } from '@/components/ui/link-button';
import { useProgressDb } from '@/db/progress-context';
import { getActivityStats, getAllProgress, getAllWordProgress } from '@/db/progress-queries';
import type { ActivityStats, KanjiProgress, WordProgress } from '@/db/progress-types';
import { getKanjiByJlptNew } from '@/db/queries';
import type { Kanji } from '@/db/types';
import {
  ALL_LEVELS,
  DEFAULT_LEVEL,
  getSelectedLevel,
  setSelectedLevel as persistSelectedLevel,
} from '@/lib/preferences';

export default function StageSelectionScreen() {
  const db = useSQLiteContext();
  const progressDb = useProgressDb();
  // Map<level, kanji[]>. All 5 JLPT levels are pre-loaded once so switching
  // tabs is instantaneous and per-level badges can be computed without
  // additional queries. Total payload is ~2200 kanji which is small in
  // memory but big enough that we only fetch on focus, not on every render.
  const [kanjiByLevel, setKanjiByLevel] = useState<Map<number, Kanji[]> | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(DEFAULT_LEVEL);
  const [progress, setProgress] = useState<Map<string, KanjiProgress>>(new Map());
  const [wordProgress, setWordProgress] = useState<WordProgress[]>([]);
  const [activity, setActivity] = useState<ActivityStats>({
    todayKanjiCount: 0,
    todayWordCount: 0,
    streakDays: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getSelectedLevel();
      if (!cancelled) setSelectedLevel(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [perLevel, allProgress, allWordProg, stats] = await Promise.all([
            Promise.all(ALL_LEVELS.map((lv) => getKanjiByJlptNew(db, lv))),
            getAllProgress(progressDb),
            getAllWordProgress(progressDb),
            getActivityStats(progressDb),
          ]);
          if (!cancelled) {
            setKanjiByLevel(new Map(ALL_LEVELS.map((lv, i) => [lv, perLevel[i]])));
            setProgress(new Map(allProgress.map((p) => [p.character, p])));
            setWordProgress(allWordProg);
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

  const levelCounts = useMemo(() => {
    const map = new Map<number, LevelCount>();
    if (!kanjiByLevel) return map;
    for (const lv of ALL_LEVELS) {
      const list = kanjiByLevel.get(lv) ?? [];
      const cleared = list.reduce((n, k) => (progress.has(k.character) ? n + 1 : n), 0);
      map.set(lv, { cleared, total: list.length });
    }
    return map;
  }, [kanjiByLevel, progress]);

  const handleSelectLevel = useCallback((level: number) => {
    setSelectedLevel(level);
    void persistSelectedLevel(level);
  }, []);

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">DB error</ThemedText>
        <ThemedText>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (kanjiByLevel === null) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const stages = kanjiByLevel.get(selectedLevel) ?? [];
  const selectedCount = levelCounts.get(selectedLevel);
  const now = Date.now();
  // dueCount is intentionally global (not filtered to selectedLevel) — the
  // Reviews screen itself is level-agnostic, so the CTA should reflect every
  // pending review regardless of which tab the user is currently browsing.
  // Includes both kanji and word due — they show up in the same Reviews feed.
  const kanjiDueCount = Array.from(progress.values()).filter((p) => p.nextReviewAt <= now).length;
  const wordDueCount = wordProgress.filter((p) => p.nextReviewAt <= now).length;
  const dueCount = kanjiDueCount + wordDueCount;

  const activityLine = formatActivityLine(activity);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText type="title">N{selectedLevel} Stages</ThemedText>
          <LinkButton
            href="/settings"
            outerStyle={styles.settingsButtonOuter}
            innerStyle={styles.settingsButton}
          >
            <ThemedText style={styles.settingsIcon}>⚙</ThemedText>
          </LinkButton>
        </View>
        <ThemedText type="subtitle">
          {selectedCount?.cleared ?? 0}/{selectedCount?.total ?? stages.length} cleared
        </ThemedText>
        {activityLine && <ThemedText style={styles.activityLine}>{activityLine}</ThemedText>}
        <LevelSegment
          levels={ALL_LEVELS}
          selected={selectedLevel}
          onSelect={handleSelectLevel}
          counts={levelCounts}
        />
        <LinkButton
          href="/reviews"
          outerStyle={styles.reviewsCtaOuter}
          innerStyle={[
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
        </LinkButton>
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

/**
 * "5 kanji · 3 words today · 7-day streak" — only the present parts; returns
 * null if there's nothing to say (fresh install, no activity yet).
 */
function formatActivityLine(activity: ActivityStats): string | null {
  const parts: string[] = [];
  if (activity.todayKanjiCount > 0) {
    parts.push(`${activity.todayKanjiCount} kanji`);
  }
  if (activity.todayWordCount > 0) {
    parts.push(`${activity.todayWordCount} word${activity.todayWordCount === 1 ? '' : 's'}`);
  }
  let line = parts.length > 0 ? `${parts.join(' · ')} today` : '';
  if (activity.streakDays > 0) {
    const fire = activity.streakDays >= 7 ? ' 🔥' : '';
    const streak = `${activity.streakDays}-day streak${fire}`;
    line = line ? `${line} · ${streak}` : streak;
  }
  return line || null;
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
    <LinkButton
      href={`/stage/${stage.character}`}
      outerStyle={styles.rowOuter}
      innerStyle={styles.row}
    >
      <ThemedText style={styles.order} numberOfLines={1}>
        {String(order).padStart(2, '0')}
      </ThemedText>
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
    </LinkButton>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsButtonOuter: {
    // Pressable scope only — visible frame is on the inner View.
  },
  settingsButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  settingsIcon: {
    fontSize: 22,
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
  order: {
    // N1 has 1232 stages → 4 digits. Width covers that case so the column
    // never wraps onto a second line (kept right-aligned so the trailing
    // digit lines up across short and long numbers).
    width: 40,
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
