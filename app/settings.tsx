import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useProgressDb } from '@/db/progress-context';
import { resetAllProgress } from '@/db/progress-queries';

export default function SettingsScreen() {
  const router = useRouter();
  const progressDb = useProgressDb();

  const handleReplayOnboarding = () => {
    // Push (not replace) so the user can back out of onboarding back to
    // Settings if they decide they didn't actually want to re-read it.
    router.push('/onboarding');
  };

  const handleResetProgress = () => {
    Alert.alert(
      'Reset all progress?',
      "This deletes every kanji and word you've cleared, your SRS schedule, and your activity history. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAllProgress(progressDb);
              // Bounce to Stages so its cached state reloads from the now-
              // empty progress DB via its useFocusEffect.
              router.replace('/');
            } catch (e) {
              Alert.alert('Reset failed', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  };

  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <SettingsRow label="Replay onboarding" onPress={handleReplayOnboarding} />
          <SettingsRow label="Reset all progress" onPress={handleResetProgress} destructive />
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.versionLabel}>Version</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.versionValue}>
            {version}
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function SettingsRow({
  label,
  onPress,
  destructive,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <ThemedText
        type="defaultSemiBold"
        style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}
      >
        {label}
      </ThemedText>
      <ThemedText style={styles.chevron}>›</ThemedText>
    </Pressable>
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
  section: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  rowPressed: {
    opacity: 0.5,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
  },
  rowLabelDestructive: {
    color: '#c66',
  },
  chevron: {
    fontSize: 22,
    opacity: 0.35,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 14,
  },
  versionLabel: {
    fontSize: 13,
    opacity: 0.6,
  },
  versionValue: {
    fontSize: 14,
  },
});
