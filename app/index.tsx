import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getKanjiByJlptNew } from '@/db/queries';
import type { Kanji } from '@/db/types';

export default function StageSelectionScreen() {
  const db = useSQLiteContext();
  const [stages, setStages] = useState<Kanji[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const n5 = await getKanjiByJlptNew(db, 5);
        if (!cancelled) setStages(n5);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

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

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">N5 Stages</ThemedText>
        <ThemedText type="subtitle">{stages.length} kanji to build</ThemedText>
      </View>
      <FlatList
        data={stages}
        keyExtractor={(item) => item.character}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => <StageRow stage={item} order={index + 1} />}
      />
    </ThemedView>
  );
}

function StageRow({ stage, order }: { stage: Kanji; order: number }) {
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
  chevron: {
    fontSize: 26,
    opacity: 0.35,
    paddingHorizontal: 4,
  },
});
