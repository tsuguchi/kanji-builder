import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  measure,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type AnimatedRef,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import type { Word } from '@/db/types';

interface BuildChip {
  id: string;
  char: string;
  isCorrect: boolean;
}

interface WordBuildSectionProps {
  word: Word;
  /** Constituent kanji of `word` in position order (length = number of slots). */
  kanjiSequence: string[];
  /** Same-level kanji that don't belong in this word. */
  distractorChars: string[];
  /**
   * Fires the first time the user reaches the solved state in the current
   * mount / target. Mirrors BuildSection's API so callers can swap which
   * mini-game they wire up to SRS later (see PR #3 plan).
   */
  onFirstSolve?: (result: { hadMistake: boolean }) => void;
}

// Kanji-only regex; mirrors the filter used at data-build time in
// scripts/05_parse_jlpt_vocab.py so the kanji/okurigana split agrees.
const KANJI_RE = /[一-鿿]/;

type DisplayItem =
  | { kind: 'kanji-slot'; kanjiPosition: number }
  | { kind: 'okurigana'; char: string };

function parseExpression(expression: string): DisplayItem[] {
  const items: DisplayItem[] = [];
  let kanjiPos = 0;
  for (const ch of expression) {
    if (KANJI_RE.test(ch)) {
      items.push({ kind: 'kanji-slot', kanjiPosition: kanjiPos });
      kanjiPos += 1;
    } else {
      items.push({ kind: 'okurigana', char: ch });
    }
  }
  return items;
}

/**
 * Drag-and-drop word-building mini-game. Sibling of [[BuildSection]] but
 * with two key differences:
 *
 *   - Solve check is order-sensitive: placedChips must match the kanji
 *     sequence position by position, not just as a multiset.
 *   - Okurigana / kana between kanji are rendered as FIXED text inline
 *     with the kanji slots (e.g. "明" [_] "る" "い"), so the puzzle only
 *     asks the user to fill the kanji positions. This keeps chip count
 *     low and matches how the user would think about it ("the kanji is
 *     〇〇").
 *
 * Deliberately kept as a separate file from BuildSection for now — see
 * memory [[project-word-puzzles-plan]] PR #2 decision. Common shape
 * (DraggableChip etc.) may be extracted in a follow-up refactor once both
 * games have settled.
 */
export function WordBuildSection({
  word,
  kanjiSequence,
  distractorChars,
  onFirstSolve,
}: WordBuildSectionProps) {
  const allChips = useMemo(() => {
    const chips: BuildChip[] = [];
    // One chip per kanji occurrence in the sequence (so "日日" gets two
    // separate chips, mirroring BuildSection's per-occurrence model).
    for (let i = 0; i < kanjiSequence.length; i += 1) {
      chips.push({ id: `${kanjiSequence[i]}#k${i}`, char: kanjiSequence[i], isCorrect: true });
    }
    for (const d of distractorChars) {
      chips.push({ id: `${d}#distractor`, char: d, isCorrect: false });
    }
    return chips;
  }, [kanjiSequence, distractorChars]);

  const [poolOrder, setPoolOrder] = useState<string[]>(() => shuffleIds(allChips));
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [hadMistake, setHadMistake] = useState(false);
  const firstSolveFiredRef = useRef(false);
  const buildZoneRef = useAnimatedRef<Animated.View>();

  useEffect(() => {
    setPoolOrder(shuffleIds(allChips));
    setPlacedIds([]);
    setHadMistake(false);
    firstSolveFiredRef.current = false;
  }, [allChips]);

  const placedSet = new Set(placedIds);
  const placedChips = placedIds
    .map((id) => allChips.find((c) => c.id === id))
    .filter((c): c is BuildChip => c !== undefined);
  const poolChips = poolOrder
    .filter((id) => !placedSet.has(id))
    .map((id) => allChips.find((c) => c.id === id))
    .filter((c): c is BuildChip => c !== undefined);

  const displayItems = useMemo(() => parseExpression(word.expression), [word.expression]);

  const solved =
    kanjiSequence.length > 0 &&
    placedChips.length === kanjiSequence.length &&
    placedChips.every((c, i) => c.char === kanjiSequence[i]);

  useEffect(() => {
    if (solved && !firstSolveFiredRef.current) {
      firstSolveFiredRef.current = true;
      onFirstSolve?.({ hadMistake });
    }
  }, [solved, hadMistake, onFirstSolve]);

  const moveToBuild = (chipId: string) => {
    if (placedSet.has(chipId)) return;
    setPlacedIds((prev) => [...prev, chipId]);
    const chip = allChips.find((c) => c.id === chipId);
    if (chip && !chip.isCorrect) {
      setHadMistake(true);
    }
  };
  const moveToPool = (chipId: string) => {
    setPlacedIds((prev) => prev.filter((id) => id !== chipId));
  };
  const toggle = (chipId: string) => {
    if (placedSet.has(chipId)) {
      moveToPool(chipId);
    } else {
      moveToBuild(chipId);
    }
  };
  const reset = () => {
    setPoolOrder(shuffleIds(allChips));
    setPlacedIds([]);
    setHadMistake(false);
  };

  const meaning = word.meaningsEn.slice(0, 2).join('; ') || '—';

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={styles.heading}>
        Build the word (単語を組み立てる)
      </ThemedText>

      <View style={styles.promptBox}>
        <ThemedText style={styles.reading}>{word.reading}</ThemedText>
        <ThemedText style={styles.meaning}>{meaning}</ThemedText>
      </View>

      <Animated.View
        ref={buildZoneRef}
        style={[
          styles.zone,
          solved && !hadMistake && styles.zoneSolvedClean,
          solved && hadMistake && styles.zoneSolvedWithMistake,
        ]}
      >
        <View style={styles.slotRow}>
          {displayItems.map((item, idx) => {
            if (item.kind === 'okurigana') {
              return (
                <ThemedText key={`okuri-${idx}`} style={styles.okurigana}>
                  {item.char}
                </ThemedText>
              );
            }
            const chip = placedChips[item.kanjiPosition] ?? null;
            return chip ? (
              <View key={`slot-${idx}`} style={styles.slot}>
                <DraggableChip
                  chip={chip}
                  isPlaced
                  buildZoneRef={buildZoneRef}
                  onMoveToBuild={() => moveToBuild(chip.id)}
                  onMoveToPool={() => moveToPool(chip.id)}
                  onTap={() => toggle(chip.id)}
                />
              </View>
            ) : (
              <View key={`slot-${idx}`} style={[styles.slot, styles.slotEmpty]} />
            );
          })}
        </View>
        {solved && !hadMistake && (
          <ThemedText type="defaultSemiBold" style={styles.solvedBannerClean}>
            ✓ Correct!
          </ThemedText>
        )}
        {solved && hadMistake && (
          <ThemedText type="defaultSemiBold" style={styles.solvedBannerMistake}>
            ✓ Solved (with mistake)
          </ThemedText>
        )}
      </Animated.View>

      <ThemedText style={styles.poolLabel}>Available kanji</ThemedText>
      <View style={styles.chipRow}>
        {poolChips.length === 0 ? (
          <ThemedText style={styles.zoneHint}>(all kanji placed)</ThemedText>
        ) : (
          poolChips.map((chip) => (
            <DraggableChip
              key={chip.id}
              chip={chip}
              isPlaced={false}
              buildZoneRef={buildZoneRef}
              onMoveToBuild={() => moveToBuild(chip.id)}
              onMoveToPool={() => moveToPool(chip.id)}
              onTap={() => toggle(chip.id)}
            />
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

interface DraggableChipProps {
  chip: BuildChip;
  isPlaced: boolean;
  buildZoneRef: AnimatedRef<Animated.View>;
  onMoveToBuild: () => void;
  onMoveToPool: () => void;
  onTap: () => void;
}

function DraggableChip({
  chip,
  isPlaced,
  buildZoneRef,
  onMoveToBuild,
  onMoveToPool,
  onTap,
}: DraggableChipProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const dragging = useSharedValue(false);

  const pan = Gesture.Pan()
    .onStart(() => {
      dragging.value = true;
      scale.value = withSpring(1.2);
    })
    .onChange((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const measured = measure(buildZoneRef);
      let inBuildZone = false;
      if (measured) {
        inBuildZone =
          e.absoluteX >= measured.pageX &&
          e.absoluteX <= measured.pageX + measured.width &&
          e.absoluteY >= measured.pageY &&
          e.absoluteY <= measured.pageY + measured.height;
      }
      if (inBuildZone && !isPlaced) {
        runOnJS(onMoveToBuild)();
      } else if (!inBuildZone && isPlaced) {
        runOnJS(onMoveToPool)();
      }
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      dragging.value = false;
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onTap)();
  });

  const combined = Gesture.Race(tap, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: dragging.value ? 100 : 1,
    elevation: dragging.value ? 8 : 0,
  }));

  return (
    <GestureDetector gesture={combined}>
      <Animated.View style={[styles.chip, isPlaced && styles.chipPlaced, animatedStyle]}>
        <ThemedText style={styles.chipGlyph}>{chip.char}</ThemedText>
      </Animated.View>
    </GestureDetector>
  );
}

function shuffleIds(chips: BuildChip[]): string[] {
  const order = chips.map((c) => c.id);
  for (let i = order.length - 1; i > 0; i -= 1) {
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
  promptBox: {
    gap: 2,
  },
  reading: {
    fontSize: 22,
    lineHeight: 28,
  },
  meaning: {
    fontSize: 14,
    opacity: 0.7,
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slot: {
    width: 56,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotEmpty: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#8888',
    backgroundColor: '#8882',
  },
  okurigana: {
    fontSize: 26,
    lineHeight: 30,
    opacity: 0.55,
    paddingHorizontal: 2,
  },
  zone: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    padding: 12,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  zoneSolvedClean: {
    borderColor: '#3a9d3a',
    backgroundColor: '#3a9d3a14',
  },
  zoneSolvedWithMistake: {
    borderColor: '#d18a2a',
    backgroundColor: '#d18a2a14',
  },
  zoneHint: {
    opacity: 0.4,
    fontSize: 13,
  },
  solvedBannerClean: {
    color: '#3a9d3a',
    fontSize: 16,
  },
  solvedBannerMistake: {
    color: '#d18a2a',
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
    backgroundColor: 'transparent',
  },
  chipPlaced: {
    backgroundColor: '#8881',
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
