import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { RadicalDecomposition } from '@/db/types';

interface BuildChip {
  id: string;
  char: string;
  isCorrect: boolean;
}

interface BuildSectionProps {
  targetCharacter: string;
  correctRadicals: RadicalDecomposition[];
  distractorChars: string[];
}

/**
 * Tap-select radical-building mini-game. The user taps chips from the
 * Available pool to move them into the Build zone, and tapping a chip in the
 * Build zone returns it to the pool. Win is declared when the multiset of
 * placed radicals matches the target's KRADFILE decomposition.
 *
 * Stateless wrt routing — owns only ephemeral game state (which chips are
 * placed). SRS / progress persistence is intentionally out of scope here and
 * lives in a separate feature.
 */
export function BuildSection({
  targetCharacter,
  correctRadicals,
  distractorChars,
}: BuildSectionProps) {
  const allChips = useMemo(() => {
    const chips: BuildChip[] = [];
    for (const r of correctRadicals) {
      for (let i = 0; i < r.count; i++) {
        chips.push({ id: `${r.radicalChar}#${i}`, char: r.radicalChar, isCorrect: true });
      }
    }
    for (const d of distractorChars) {
      chips.push({ id: `${d}#distractor`, char: d, isCorrect: false });
    }
    return chips;
  }, [correctRadicals, distractorChars]);

  const [poolOrder, setPoolOrder] = useState<string[]>(() => shuffleIds(allChips));
  const [placedIds, setPlacedIds] = useState<string[]>([]);

  // If the target kanji changes (e.g. navigating to another stage), reset.
  useEffect(() => {
    setPoolOrder(shuffleIds(allChips));
    setPlacedIds([]);
  }, [allChips]);

  if (correctRadicals.length === 0) {
    return (
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.heading}>
          Build (組み立て)
        </ThemedText>
        <ThemedText>This kanji has no KRADFILE decomposition to build from.</ThemedText>
      </View>
    );
  }

  const placedSet = new Set(placedIds);
  const placedChips = placedIds
    .map((id) => allChips.find((c) => c.id === id))
    .filter((c): c is BuildChip => c !== undefined);
  const poolChips = poolOrder
    .filter((id) => !placedSet.has(id))
    .map((id) => allChips.find((c) => c.id === id))
    .filter((c): c is BuildChip => c !== undefined);

  const solved = isSolved(correctRadicals, placedChips);

  const add = (chipId: string) => {
    if (placedSet.has(chipId)) return;
    setPlacedIds((prev) => [...prev, chipId]);
  };
  const remove = (chipId: string) => {
    setPlacedIds((prev) => prev.filter((id) => id !== chipId));
  };
  const reset = () => {
    setPoolOrder(shuffleIds(allChips));
    setPlacedIds([]);
  };

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={styles.heading}>
        Build (組み立て)
      </ThemedText>
      <ThemedText style={styles.targetLine}>
        Target: <ThemedText style={styles.targetGlyph}>{targetCharacter}</ThemedText>
      </ThemedText>

      <View style={[styles.zone, solved && styles.zoneSolved]}>
        {placedChips.length === 0 ? (
          <ThemedText style={styles.zoneHint}>(tap radicals below to add)</ThemedText>
        ) : (
          <View style={styles.chipRow}>
            {placedChips.map((chip) => (
              <Chip key={chip.id} chip={chip} placed onPress={() => remove(chip.id)} />
            ))}
          </View>
        )}
        {solved && (
          <ThemedText type="defaultSemiBold" style={styles.solvedBanner}>
            ✓ Correct!
          </ThemedText>
        )}
      </View>

      <ThemedText style={styles.poolLabel}>Available radicals</ThemedText>
      <View style={styles.chipRow}>
        {poolChips.length === 0 ? (
          <ThemedText style={styles.zoneHint}>(all radicals placed)</ThemedText>
        ) : (
          poolChips.map((chip) => (
            <Chip key={chip.id} chip={chip} placed={false} onPress={() => add(chip.id)} />
          ))
        )}
      </View>

      <Pressable
        onPress={reset}
        style={({ pressed }) => [styles.resetButton, pressed && styles.resetButtonPressed]}
      >
        <ThemedText type="defaultSemiBold">Reset</ThemedText>
      </Pressable>
    </View>
  );
}

function Chip({
  chip,
  placed,
  onPress,
}: {
  chip: BuildChip;
  placed: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        placed && styles.chipPlaced,
        pressed && styles.chipPressed,
      ]}
    >
      <ThemedText style={styles.chipGlyph}>{chip.char}</ThemedText>
    </Pressable>
  );
}

function isSolved(target: RadicalDecomposition[], placed: BuildChip[]): boolean {
  const targetCounts = new Map<string, number>();
  for (const r of target) targetCounts.set(r.radicalChar, r.count);

  const placedCounts = new Map<string, number>();
  for (const c of placed) placedCounts.set(c.char, (placedCounts.get(c.char) ?? 0) + 1);

  if (targetCounts.size !== placedCounts.size) return false;
  for (const [char, expected] of targetCounts) {
    if (placedCounts.get(char) !== expected) return false;
  }
  return true;
}

function shuffleIds(chips: BuildChip[]): string[] {
  // Fisher–Yates on a copy. Game RNG only — not security-sensitive.
  const order = chips.map((c) => c.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  heading: {
    fontSize: 14,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  targetLine: {
    fontSize: 15,
  },
  targetGlyph: {
    fontSize: 28,
    lineHeight: 30,
  },
  zone: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    padding: 12,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneSolved: {
    borderColor: '#3a9d3a',
    backgroundColor: '#3a9d3a14',
  },
  zoneHint: {
    opacity: 0.4,
    fontSize: 13,
  },
  solvedBanner: {
    color: '#3a9d3a',
    fontSize: 16,
  },
  poolLabel: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    minWidth: 48,
    alignItems: 'center',
  },
  chipPlaced: {
    backgroundColor: '#8881',
  },
  chipPressed: {
    opacity: 0.5,
  },
  chipGlyph: {
    fontSize: 26,
    lineHeight: 30,
  },
  resetButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    marginTop: 6,
  },
  resetButtonPressed: {
    opacity: 0.5,
  },
});
