import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PRIVACY_TEXT } from '@/lib/legal';

export default function PrivacyScreen() {
  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.body}>{PRIVACY_TEXT}</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
});
