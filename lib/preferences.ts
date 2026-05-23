import AsyncStorage from '@react-native-async-storage/async-storage';

const LEVEL_KEY = 'pref:selected-jlpt-level';
const VALID_LEVELS = new Set([1, 2, 3, 4, 5]);
export const DEFAULT_LEVEL = 5;
export const ALL_LEVELS: readonly number[] = [5, 4, 3, 2, 1];

/**
 * Read the user's last-selected JLPT level from AsyncStorage.
 *
 * Falls back to `DEFAULT_LEVEL` (N5) on any error, missing value, or value
 * outside the 1..5 range — keeping the home screen renderable even if the
 * storage is corrupted or has never been written.
 */
export async function getSelectedLevel(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LEVEL_KEY);
    if (raw === null) return DEFAULT_LEVEL;
    const n = Number.parseInt(raw, 10);
    return VALID_LEVELS.has(n) ? n : DEFAULT_LEVEL;
  } catch {
    return DEFAULT_LEVEL;
  }
}

/** Persist the user's level choice. Invalid levels are silently ignored. */
export async function setSelectedLevel(level: number): Promise<void> {
  if (!VALID_LEVELS.has(level)) return;
  try {
    await AsyncStorage.setItem(LEVEL_KEY, String(level));
  } catch {
    // AsyncStorage write failures aren't worth surfacing — the worst case
    // is the next launch falls back to DEFAULT_LEVEL, which is harmless.
  }
}
