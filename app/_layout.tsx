import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { SessionProvider } from '@/components/session/session-context';
import { ProgressDbProvider } from '@/db/progress-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { hasSeenOnboarding } from '@/lib/preferences';

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
                <OnboardingGate />
                <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="reviews" options={{ title: 'Reviews' }} />
                  <Stack.Screen name="stage/[character]" options={{ title: '' }} />
                  <Stack.Screen name="word/[wordId]" options={{ title: '' }} />
                  <Stack.Screen name="onboarding" options={{ headerShown: false }} />
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

/**
 * First-launch onboarding redirect.
 *
 * Mounts inside the navigation tree (so `useRouter` / `useSegments` work)
 * and runs once per session: if the user hasn't seen onboarding yet, it
 * replaces the current route with `/onboarding`. The check is gated on
 * `useSegments` being non-empty so we don't fire the redirect before the
 * router has settled on an initial route — that race would otherwise
 * push us into a redirect-loop on warm starts.
 *
 * Renders nothing. Always rendered (no `__DEV__` carve-out) — the
 * `hasSeenOnboarding()` helper is the only switch.
 */
function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    let cancelled = false;
    (async () => {
      const seen = await hasSeenOnboarding();
      if (cancelled) return;
      setChecked(true);
      // Compare via String() so this stays correct if typedRoutes ever
      // changes the segment union type.
      if (!seen && String(segments[0] ?? '') !== 'onboarding') {
        router.replace('/onboarding');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checked, segments, router]);

  return null;
}
