import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { setSeenOnboarding } from '@/lib/preferences';

interface Slide {
  title: string;
  body: string;
  /** Visual line shown above the body. Rendered with large kanji chips. */
  visualLeft: string[];
  visualOp: string;
  visualRight: string;
}

const SLIDES: Slide[] = [
  {
    title: 'Build kanji from radicals',
    body: 'Each kanji is made of smaller parts called radicals. Drag them into place to build the answer.',
    visualLeft: ['木', '木'],
    visualOp: '→',
    visualRight: '林',
  },
  {
    title: 'Then kanji into words',
    body: 'Once a kanji is yours, the same drag-and-drop puzzle builds the words it forms.',
    visualLeft: ['学', '生'],
    visualOp: '→',
    visualRight: '学生',
  },
  {
    title: 'We bring it back when you’ll forget',
    body: 'Every solve schedules the next review at the right interval — hours, days, weeks. Your streak grows with you.',
    visualLeft: ['1', '2', '3', '4', '5', '6', '7', '8'],
    visualOp: '',
    visualRight: '',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const { width: screenWidth } = Dimensions.get('window');

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (next !== page) setPage(next);
  };

  const goToPage = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * screenWidth, animated: true });
  };

  const finish = async () => {
    await setSeenOnboarding();
    router.replace('/');
  };

  const onNext = () => {
    if (page < SLIDES.length - 1) {
      goToPage(page + 1);
    } else {
      void finish();
    }
  };

  const isLast = page === SLIDES.length - 1;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => void finish()}
          style={({ pressed }) => [styles.topButton, pressed && styles.topButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <ThemedText style={styles.skipText}>Skip</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width: screenWidth }]}>
            <View style={styles.visualRow}>
              <View style={styles.chipRow}>
                {slide.visualLeft.map((token, idx) => (
                  <View key={`${i}-l-${idx}`} style={styles.chip}>
                    <ThemedText style={styles.chipGlyph}>{token}</ThemedText>
                  </View>
                ))}
              </View>
              {slide.visualOp ? (
                <ThemedText style={styles.opGlyph}>{slide.visualOp}</ThemedText>
              ) : null}
              {slide.visualRight ? (
                <View style={styles.resultBox}>
                  <ThemedText style={styles.resultGlyph}>{slide.visualRight}</ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText type="title" style={styles.slideTitle}>
              {slide.title}
            </ThemedText>
            <ThemedText style={styles.slideBody}>{slide.body}</ThemedText>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          onPress={onNext}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
        >
          <ThemedText type="defaultSemiBold" style={styles.ctaText}>
            {isLast ? 'Get started' : 'Next'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  topButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  topButtonPressed: {
    opacity: 0.5,
  },
  skipText: {
    fontSize: 15,
    opacity: 0.6,
  },
  scroll: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  visualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    minHeight: 120,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    minWidth: 48,
    alignItems: 'center',
    backgroundColor: '#8881',
  },
  chipGlyph: {
    fontSize: 36,
    lineHeight: 44,
  },
  opGlyph: {
    fontSize: 28,
    opacity: 0.5,
  },
  resultBox: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#c66',
  },
  resultGlyph: {
    fontSize: 36,
    lineHeight: 44,
    color: '#fff',
  },
  slideTitle: {
    fontSize: 24,
    textAlign: 'center',
  },
  slideBody: {
    fontSize: 15,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8884',
  },
  dotActive: {
    backgroundColor: '#c66',
    width: 24,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
  },
  cta: {
    backgroundColor: '#c66',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
  },
});
