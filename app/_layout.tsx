import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

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
    <Suspense fallback={<LoadingFallback />}>
      <SQLiteProvider databaseName={DB_NAME} assetSource={{ assetId: DB_ASSET }} useSuspense>
        <ProgressDbProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="stage/[character]" options={{ title: '' }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </ProgressDbProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
