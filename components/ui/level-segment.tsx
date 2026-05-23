import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export interface LevelCount {
  cleared: number;
  total: number;
}

interface LevelSegmentProps {
  /** Display order, e.g. [5, 4, 3, 2, 1]. */
  levels: readonly number[];
  selected: number;
  onSelect: (level: number) => void;
  /** Per-level progress to render under the label. Missing entries show no badge. */
  counts: Map<number, LevelCount>;
}

/**
 * Horizontal JLPT level picker (N5 / N4 / N3 / N2 / N1) with progress badges.
 *
 * Used by the Stages screen header to switch which JLPT-new level the kanji
 * list is filtered to. The selected tab is highlighted; each tab also shows
 * `cleared/total` so the user can see relative progress across levels at a
 * glance without changing selection.
 */
export function LevelSegment({ levels, selected, onSelect, counts }: LevelSegmentProps) {
  return (
    <View style={styles.row}>
      {levels.map((level) => {
        const count = counts.get(level);
        const isSelected = level === selected;
        return (
          <Pressable
            key={level}
            onPress={() => onSelect(level)}
            style={({ pressed }) => [
              styles.tab,
              isSelected ? styles.tabSelected : styles.tabIdle,
              pressed && styles.tabPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={
              count
                ? `JLPT N${level}, ${count.cleared} of ${count.total} cleared`
                : `JLPT N${level}`
            }
          >
            <ThemedText
              type="defaultSemiBold"
              style={isSelected ? styles.labelSelected : styles.labelIdle}
            >
              N{level}
            </ThemedText>
            {count !== undefined && (
              <ThemedText style={isSelected ? styles.badgeSelected : styles.badgeIdle}>
                {count.cleared}/{count.total}
              </ThemedText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    gap: 2,
  },
  tabIdle: {
    backgroundColor: 'transparent',
  },
  tabSelected: {
    backgroundColor: '#3a9d3a',
    borderColor: '#3a9d3a',
  },
  tabPressed: {
    opacity: 0.6,
  },
  labelIdle: {
    fontSize: 14,
  },
  labelSelected: {
    fontSize: 14,
    color: '#fff',
  },
  badgeIdle: {
    fontSize: 11,
    opacity: 0.6,
  },
  badgeSelected: {
    fontSize: 11,
    color: '#fff',
  },
});
