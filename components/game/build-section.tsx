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
  /**
   * Fires the first time the user reaches the solved state in the current
   * mount / target. Subsequent re-solves in the same session do not refire.
   * Used by the stage detail screen to advance SRS once per visit.
   *
   * `hadMistake` is true if at least one distractor was placed in the build
   * zone during the current attempt (cleared by Reset and by target change).
   */
  onFirstSolve?: (result: { hadMistake: boolean }) => void;
}

/**
 * Drag-and-drop radical-building mini-game. Chips are draggable from the
 * Available pool into the Build zone (and back). A short tap on a chip also
 * still works as a single-touch toggle for accessibility / one-handed use —
 * Pan needs ~10 px of movement to activate, so a true tap falls through to
 * the Tap gesture.
 *
 * Win is declared when the multiset of placed radicals matches the target's
 * KRADFILE decomposition. The `hadMistake` flag fires `onFirstSolve` with
 * `true` if any distractor was placed during this attempt; Reset clears the
 * flag for a clean retry.
 *
 * Stateless wrt routing — owns only ephemeral game state. SRS / progress
 * persistence lives in the parent stage detail screen.
 */
export function BuildSection({
  targetCharacter,
  correctRadicals,
  distractorChars,
  onFirstSolve,
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
  const [hadMistake, setHadMistake] = useState(false);
  const firstSolveFiredRef = useRef(false);
  const buildZoneRef = useAnimatedRef<Animated.View>();

  // If the target kanji changes (e.g. navigating to another stage), reset
  // game state AND the "first solve fired" guard so the next stage can fire
  // onFirstSolve cleanly. Mistake flag also resets — a fresh stage starts
  // a fresh attempt.
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

  const hasBuild = correctRadicals.length > 0;
  const solved = hasBuild && isSolved(correctRadicals, placedChips);

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
    // Explicit "give me a fresh attempt" — clears the mistake flag so a
    // clean composition after reset can still earn a full clean solve.
    setHadMistake(false);
  };

  if (!hasBuild) {
    return (
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.heading}>
          Build (組み立て)
        </ThemedText>
        <ThemedText>This kanji has no KRADFILE decomposition to build from.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={styles.heading}>
        Build (組み立て)
      </ThemedText>
      <ThemedText style={styles.targetLine}>
        Target: <ThemedText style={styles.targetGlyph}>{targetCharacter}</ThemedText>
      </ThemedText>

      <Animated.View
        ref={buildZoneRef}
        style={[
          styles.zone,
          solved && !hadMistake && styles.zoneSolvedClean,
          solved && hadMistake && styles.zoneSolvedWithMistake,
        ]}
      >
        {placedChips.length === 0 ? (
          <ThemedText style={styles.zoneHint}>(drag or tap radicals below)</ThemedText>
        ) : (
          <View style={styles.chipRow}>
            {placedChips.map((chip) => (
              <DraggableChip
                key={chip.id}
                chip={chip}
                isPlaced
                buildZoneRef={buildZoneRef}
                onMoveToBuild={() => moveToBuild(chip.id)}
                onMoveToPool={() => moveToPool(chip.id)}
                onTap={() => toggle(chip.id)}
              />
            ))}
          </View>
        )}
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

      <ThemedText style={styles.poolLabel}>Available radicals</ThemedText>
      <View style={styles.chipRow}>
        {poolChips.length === 0 ? (
          <ThemedText style={styles.zoneHint}>(all radicals placed)</ThemedText>
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

  // Tap remains available so a quick single touch (no drag movement) toggles
  // the chip between zones — preserving the previous tap-select UX for
  // accessibility / single-handed use.
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
