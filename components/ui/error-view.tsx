import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LinkButton } from '@/components/ui/link-button';

interface ErrorViewProps {
  /** Short, user-facing title (e.g. "Something went wrong"). */
  title: string;
  /** One-sentence explanation in plain language. No raw error text here. */
  message: string;
  /**
   * The original error message string, shown only in dev builds (`__DEV__`).
   * Helps debugging without exposing internals to production users.
   */
  rawError?: string | null;
  /** If provided, a "Try again" button appears and calls this on press. */
  onRetry?: () => void;
  /**
   * Home button target. Default is the Stages screen — appropriate for
   * almost every failure mode since the user can always restart from there.
   */
  homeHref?: '/' | '/reviews';
  /** Label for the home button. Defaults to "Back to Stages". */
  homeLabel?: string;
  /** Glyph at the top. Defaults to ⚠ for errors, ↺ for not-found feel. */
  glyph?: string;
  /**
   * Hide the "Back to Stages" button entirely. Useful when the error is
   * shown ON the Stages screen itself — bouncing back to / is a no-op and
   * adds noise to the UI.
   */
  hideHome?: boolean;
}

/**
 * Shared empty/error state used by the four DB-dependent screens (Stages,
 * Reviews, Stage detail, Word detail). Replaces the raw "DB error" /
 * "Stage not found" blocks with:
 *
 *   - a user-facing title + plain-language message
 *   - an optional "Try again" callback (re-runs the fetch on the same
 *     screen — no full re-mount)
 *   - a "Back to Stages" link as the safe fallback
 *   - dev-only raw error footer for debugging
 *
 * Stays presentational — owns no state, no DB access. Each call site
 * supplies the retry callback (typically a `useCallback`-wrapped fetcher).
 */
export function ErrorView({
  title,
  message,
  rawError,
  onRetry,
  homeHref = '/',
  homeLabel = 'Back to Stages',
  glyph = '⚠',
  hideHome = false,
}: ErrorViewProps) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.glyph}>{glyph}</ThemedText>
      <ThemedText type="title" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText style={styles.message}>{message}</ThemedText>

      <View style={styles.buttonRow}>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [
              styles.button,
              styles.buttonPrimary,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
          >
            <ThemedText type="defaultSemiBold" style={styles.buttonPrimaryText}>
              Try again
            </ThemedText>
          </Pressable>
        )}
        {!hideHome && (
          <LinkButton
            href={homeHref}
            replace
            outerStyle={styles.buttonOuter}
            innerStyle={[styles.button, styles.buttonSecondary]}
          >
            <ThemedText type="defaultSemiBold" style={styles.buttonSecondaryText}>
              {homeLabel}
            </ThemedText>
          </LinkButton>
        )}
      </View>

      {__DEV__ && rawError ? (
        <ThemedText style={styles.devDetails} numberOfLines={6}>
          [dev] {rawError}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  glyph: {
    fontSize: 56,
    lineHeight: 64,
    opacity: 0.55,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  buttonOuter: {
    // Pressable scope only — visible frame is on the inner View
    // ([[feedback-link-aschild-pressable]]).
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  buttonPrimary: {
    backgroundColor: '#c66',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 15,
  },
  buttonSecondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8886',
    backgroundColor: 'transparent',
  },
  buttonSecondaryText: {
    fontSize: 15,
    opacity: 0.85,
  },
  devDetails: {
    marginTop: 16,
    fontSize: 11,
    opacity: 0.5,
    textAlign: 'center',
    fontFamily: 'Courier',
  },
});
