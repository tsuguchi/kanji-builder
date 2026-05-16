import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getKanjiByJlptNew, getRadicalsForKanji } from '@/db/queries';
import type { Kanji, RadicalDecomposition } from '@/db/types';

interface KanjiWithRadicals {
  kanji: Kanji;
  radicals: RadicalDecomposition[];
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<KanjiWithRadicals[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const n5 = await getKanjiByJlptNew(db, 5);
        const enriched = await Promise.all(
          n5.map(async (kanji) => ({
            kanji,
            radicals: await getRadicalsForKanji(db, kanji.character),
          })),
        );
        if (!cancelled) setItems(enriched);
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

  if (items === null) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">N5 Kanji</ThemedText>
        <ThemedText type="subtitle">{items.length} characters</ThemedText>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.kanji.character}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <KanjiRow item={item} />}
      />
    </ThemedView>
  );
}

function KanjiRow({ item }: { item: KanjiWithRadicals }) {
  const { kanji, radicals } = item;
  const radicalLabel = radicals.length
    ? radicals.map((r) => (r.count > 1 ? `${r.radicalChar}×${r.count}` : r.radicalChar)).join(' ')
    : '(no decomposition)';
  return (
    <View style={styles.row}>
      <ThemedText style={styles.glyph}>{kanji.character}</ThemedText>
      <View style={styles.rowBody}>
        <ThemedText type="defaultSemiBold">{kanji.meaningsEn.slice(0, 3).join(', ')}</ThemedText>
        <ThemedText style={styles.meta}>
          {kanji.strokeCount} strokes · radicals: {radicalLabel}
        </ThemedText>
      </View>
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
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
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
});
