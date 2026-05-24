import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { BuildSection } from '@/components/game/build-section';
import { useReviewSession } from '@/components/session/session-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LinkButton } from '@/components/ui/link-button';
import { useProgressDb } from '@/db/progress-context';
import { getDueProgress, getProgressFor, recordSolve } from '@/db/progress-queries';
import { SRS_STAGE_LABELS, type KanjiProgress } from '@/db/progress-types';
import {
  getDistractorRadicals,
  getKanjiByCharacter,
  getRadicalsForKanji,
  getWordsForKanji,
} from '@/db/queries';
import type { Kanji, RadicalDecomposition, Word } from '@/db/types';

const DISTRACTOR_COUNT = 3;

interface StageData {
  kanji: Kanji;
  radicals: RadicalDecomposition[];
  distractors: string[];
  words: Word[];
}

export default function StageDetailScreen() {
  const { character } = useLocalSearchParams<{ character: string }>();
  const db = useSQLiteContext();
  const progressDb = useProgressDb();
  const session = useReviewSession();
  const [data, setData] = useState<StageData | null>(null);
  const [progress, setProgress] = useState<KanjiProgress | null>(null);
  const [nextDueCharacter, setNextDueCharacter] = useState<string | null>(null);
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
        const [distractors, words, existingProgress] = await Promise.all([
          getDistractorRadicals(
            db,
            level,
            radicals.map((r) => r.radicalChar),
            DISTRACTOR_COUNT,
          ),
          getWordsForKanji(db, character),
          getProgressFor(progressDb, character),
        ]);
        if (!cancelled) {
          setData({ kanji, radicals, distractors, words });
          setProgress(existingProgress);
          // Clear stale next-due nudge from the previous stage; it will be
          // recomputed when the user solves this one.
          setNextDueCharacter(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, progressDb, character]);

  const handleFirstSolve = async (result: { hadMistake: boolean }) => {
    if (!character) return;
    // Record into the ephemeral session log so the Reviews screen can
    // summarise the burst as a "Session complete!" panel. Runs even when
    // the user reached this stage via Stages (not Reviews) — they still
    // earned a solve and the summary will surface if they happen to land
    // on Reviews afterwards with no remaining Due.
    session.recordSolve(character, result.hadMistake);
    try {
      const newProgress = await recordSolve(progressDb, character, result);
      setProgress(newProgress);
      // Surface a "Next due →" call-to-action so the user can chain review
      // sessions without bouncing back to the Reviews list. The just-solved
      // kanji has its `next_review_at` pushed into the future by recordSolve,
      // so it will not appear in `getDueProgress` again — but we still skip
      // it defensively in case the SRS interval is shorter than the query
      // round-trip.
      const due = await getDueProgress(progressDb);
      const next = due.find((p) => p.character !== character)?.character ?? null;
      setNextDueCharacter(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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

  const { kanji, radicals, distractors, words } = data;

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

        <Section title={`Words using this kanji (${words.length})`}>
          {words.length === 0 ? (
            <ThemedText style={styles.notCleared}>
              (no N5-N1 vocab list entry uses this kanji)
            </ThemedText>
          ) : (
            <View style={styles.wordList}>
              {words.map((w) => (
                <WordRow key={w.id} word={w} />
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

        {nextDueCharacter && (
          <LinkButton
            href={`/stage/${nextDueCharacter}`}
            replace
            outerStyle={styles.nextDueButtonOuter}
            innerStyle={styles.nextDueButton}
          >
            <ThemedText type="defaultSemiBold" style={styles.nextDueButtonText}>
              Next due: {nextDueCharacter} →
            </ThemedText>
          </LinkButton>
        )}
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

function WordRow({ word }: { word: Word }) {
  // Cap meaning preview to keep rows compact; full meaning list is shown
  // on the word puzzle screen itself.
  const meaning = word.meaningsEn.slice(0, 2).join('; ') || '—';
  return (
    <LinkButton
      href={`/word/${word.id}`}
      outerStyle={styles.wordRowOuter}
      innerStyle={styles.wordRow}
    >
      <View style={styles.wordExprBox}>
        <ThemedText style={styles.wordExpr}>{word.expression}</ThemedText>
        <ThemedText style={styles.wordReading}>{word.reading}</ThemedText>
      </View>
      <ThemedText style={styles.wordMeaning} numberOfLines={2}>
        {meaning}
      </ThemedText>
      <View style={styles.wordLevelBadge}>
        <ThemedText style={styles.wordLevelText}>N{word.jlptNew}</ThemedText>
      </View>
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
  nextDueButtonOuter: {
    // Pressable scope only. `alignSelf` moved to the inner View — same
    // reason as Reviews CTA (Pressable on new arch drops the property).
  },
  nextDueButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#3a9d3a',
  },
  nextDueButtonText: {
    color: '#fff',
    fontSize: 15,
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
  wordList: {
    gap: 8,
  },
  wordRowOuter: {
    // Border-bottom stays on the outer Pressable so the tap target covers
    // the full row; padding moves to the inner View per [[feedback-link-aschild-pressable]].
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  wordExprBox: {
    minWidth: 88,
    gap: 1,
  },
  wordExpr: {
    fontSize: 20,
    lineHeight: 24,
  },
  wordReading: {
    fontSize: 12,
    opacity: 0.6,
  },
  wordMeaning: {
    flex: 1,
    fontSize: 13,
    opacity: 0.75,
  },
  wordLevelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
  },
  wordLevelText: {
    fontSize: 11,
    opacity: 0.6,
  },
});
