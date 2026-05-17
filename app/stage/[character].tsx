import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { BuildSection } from '@/components/game/build-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useProgressDb } from '@/db/progress-context';
import { getProgressFor, recordCorrect } from '@/db/progress-queries';
import { SRS_STAGE_LABELS, type KanjiProgress } from '@/db/progress-types';
import { getDistractorRadicals, getKanjiByCharacter, getRadicalsForKanji } from '@/db/queries';
import type { Kanji, RadicalDecomposition } from '@/db/types';

const DISTRACTOR_COUNT = 3;

interface StageData {
  kanji: Kanji;
  radicals: RadicalDecomposition[];
  distractors: string[];
}

export default function StageDetailScreen() {
  const { character } = useLocalSearchParams<{ character: string }>();
  const db = useSQLiteContext();
  const progressDb = useProgressDb();
  const [data, setData] = useState<StageData | null>(null);
  const [progress, setProgress] = useState<KanjiProgress | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!character) return;
    let cancelled = false;
    (async () => {
      try {
        const kanji = await getKanjiByCharacter(db, character);
        if (!kanji) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const radicals = await getRadicalsForKanji(db, character);
        const level = kanji.jlptNew ?? 5;
        const distractors = await getDistractorRadicals(
          db,
          level,
          radicals.map((r) => r.radicalChar),
          DISTRACTOR_COUNT,
        );
        const existingProgress = await getProgressFor(progressDb, character);
        if (!cancelled) {
          setData({ kanji, radicals, distractors });
          setProgress(existingProgress);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, progressDb, character]);

  const handleFirstSolve = () => {
    if (!character) return;
    recordCorrect(progressDb, character)
      .then(setProgress)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: character ?? 'Stage' }} />
        <ThemedText type="subtitle">DB error</ThemedText>
        <ThemedText>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (notFound) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <ThemedText type="subtitle">Stage not found</ThemedText>
        <ThemedText>The kanji &quot;{character}&quot; is not in the bundled database.</ThemedText>
      </ThemedView>
    );
  }

  if (data === null) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: character ?? 'Stage' }} />
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const { kanji, radicals, distractors } = data;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: kanji.character }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroBox}>
          <ThemedText style={styles.hero}>{kanji.character}</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.heroMeaning}>
            {kanji.meaningsEn.slice(0, 3).join(', ') || '—'}
          </ThemedText>
          <ThemedText style={styles.heroMeta}>
            {kanji.strokeCount} strokes
            {kanji.frequencyRank ? ` · freq #${kanji.frequencyRank}` : ''}
          </ThemedText>
        </View>

        <Section title="All meanings">
          <ThemedText>{kanji.meaningsEn.join(', ') || '—'}</ThemedText>
        </Section>

        <Section title="Onyomi (音読み)">
          <ThemedText style={styles.readings}>
            {kanji.onyomi.length ? kanji.onyomi.join(' · ') : '—'}
          </ThemedText>
        </Section>

        <Section title="Kunyomi (訓読み)">
          <ThemedText style={styles.readings}>
            {kanji.kunyomi.length ? kanji.kunyomi.join(' · ') : '—'}
          </ThemedText>
        </Section>

        <Section title="Radicals (部首)">
          {radicals.length === 0 ? (
            <ThemedText>(no decomposition in KRADFILE)</ThemedText>
          ) : (
            <View style={styles.chipRow}>
              {radicals.map((r) => (
                <RadicalChip key={r.radicalChar} radical={r} />
              ))}
            </View>
          )}
        </Section>

        <Section title="Progress">
          {progress ? (
            <ProgressSummary progress={progress} />
          ) : (
            <ThemedText style={styles.notCleared}>Not cleared yet.</ThemedText>
          )}
        </Section>

        <BuildSection
          targetCharacter={kanji.character}
          correctRadicals={radicals}
          distractorChars={distractors}
          onFirstSolve={handleFirstSolve}
        />
      </ScrollView>
    </ThemedView>
  );
}

function ProgressSummary({ progress }: { progress: KanjiProgress }) {
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function RadicalChip({ radical }: { radical: RadicalDecomposition }) {
  return (
    <View style={styles.chip}>
      <ThemedText style={styles.chipGlyph}>{radical.radicalChar}</ThemedText>
      {radical.count > 1 && <ThemedText style={styles.chipCount}>×{radical.count}</ThemedText>}
    </View>
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
    gap: 24,
  },
  heroBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  hero: {
    fontSize: 140,
    lineHeight: 160,
  },
  heroMeaning: {
    fontSize: 18,
    textAlign: 'center',
  },
  notCleared: {
    opacity: 0.5,
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
  heroMeta: {
    opacity: 0.6,
    fontSize: 13,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  readings: {
    fontSize: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
  },
  chipGlyph: {
    fontSize: 24,
    lineHeight: 28,
  },
  chipCount: {
    fontSize: 12,
    opacity: 0.6,
  },
});
