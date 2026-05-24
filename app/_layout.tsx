import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { SessionProvider } from '@/components/session/session-context';
import { ProgressDbProvider } from '@/db/progress-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const DB_NAME = 'kanji.sqlite';
// React Native's asset bundler resolves binary assets via require(); ESM
// import would not give Metro a moduleId to bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DB_ASSET = require('@/assets/data/kanji.sqlite');

function LoadingFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense fallback={<LoadingFallback />}>
        <SQLiteProvider
          databaseName={DB_NAME}
          // `forceOverwrite: __DEV__` re-copies the bundled asset on every
          // dev launch so schema changes in scripts/05 (and future pipeline
          // updates) take effect without manually wiping app data. In
          // production it's `false` — the bundled DB is copied once on
          // first launch and never re-copied. Production schema migrations
          // will need explicit version handling when we get there.
          assetSource={{ assetId: DB_ASSET, forceOverwrite: __DEV__ }}
          useSuspense
        >
          <ProgressDbProvider>
            <SessionProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="reviews" options={{ title: 'Reviews' }} />
                  <Stack.Screen name="stage/[character]" options={{ title: '' }} />
                  <Stack.Screen name="word/[wordId]" options={{ title: '' }} />
                </Stack>
                <StatusBar style="auto" />
              </ThemeProvider>
            </SessionProvider>
          </ProgressDbProvider>
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}
