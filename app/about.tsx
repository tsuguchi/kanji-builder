import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LinkButton } from '@/components/ui/link-button';
import { ACKNOWLEDGEMENTS_TEXT } from '@/lib/legal';

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'About' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBox}>
          <ThemedText type="title" style={styles.appName}>
            Kanji Builder
          </ThemedText>
          <ThemedText style={styles.version}>Version {version}</ThemedText>
          <ThemedText style={styles.tagline}>
            A kanji puzzle app for foreign Japanese learners. Build kanji from radicals, then words
            from kanji.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <LinkRow href="/about/terms" label="Terms of Service" />
          <LinkRow href="/about/privacy" label="Privacy Policy" />
        </View>

        <View style={styles.acknowledgements}>
          <ThemedText style={styles.bodyText}>{ACKNOWLEDGEMENTS_TEXT}</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function LinkRow({ href, label }: { href: '/about/terms' | '/about/privacy'; label: string }) {
  return (
    <LinkButton href={href} outerStyle={styles.rowOuter} innerStyle={styles.row}>
      <ThemedText type="defaultSemiBold" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <ThemedText style={styles.chevron}>›</ThemedText>
    </LinkButton>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  headerBox: {
    gap: 6,
    paddingHorizontal: 4,
  },
  appName: {
    fontSize: 24,
  },
  version: {
    fontSize: 13,
    opacity: 0.6,
  },
  tagline: {
    fontSize: 14,
    opacity: 0.75,
    lineHeight: 20,
    marginTop: 4,
  },
  section: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    overflow: 'hidden',
  },
  rowOuter: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
  },
  chevron: {
    fontSize: 22,
    opacity: 0.35,
  },
  acknowledgements: {
    paddingHorizontal: 4,
  },
  bodyText: {
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 20,
  },
});
