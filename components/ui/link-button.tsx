import { Link, type LinkProps } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

interface LinkButtonProps {
  href: LinkProps['href'];
  /** Use `router.replace` instead of `push` (e.g. for chained review flows). */
  replace?: boolean;
  /**
   * Style applied to the outer Pressable. Scope: positioning only
   * (`marginTop`, `alignSelf`, etc.). Avoid putting `flexDirection`,
   * `padding`, `border`, `background`, or `gap` here — see below.
   */
  outerStyle?: StyleProp<ViewStyle>;
  /**
   * Style applied to the inner View. This is where layout (`flexDirection`,
   * `gap`), visual frame (`padding`, `borderRadius`, `backgroundColor`,
   * `border`), and content-width hints (`alignSelf`) should live.
   */
  innerStyle?: StyleProp<ViewStyle>;
  /** Style merged into outerStyle while the Pressable is pressed. Defaults to opacity 0.6. */
  pressedStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

const DEFAULT_PRESSED: ViewStyle = { opacity: 0.6 };

/**
 * `Link asChild` + `Pressable` + inner `View` triplet packaged as a single
 * component.
 *
 * Why this exists: on the new React Native architecture (Fabric), the
 * function-style output (`style={({ pressed }) => [...]}`) for a Pressable
 * cloned by `Link asChild` does not reliably forward layout, visual frame,
 * or alignment properties to the touchable's underlying view. The fix —
 * confirmed across PR #27 / #28 / #29 — is to keep the Pressable lean
 * (positioning + pressed feedback only) and put layout / frame / alignment
 * on an inner View that the component always renders.
 *
 * Style scope, by prop:
 *
 * - `outerStyle` (Pressable): positioning only — `marginTop`, etc.
 * - `innerStyle` (View): layout + frame + alignment — `flexDirection`,
 *   `gap`, `padding`, `borderRadius`, `backgroundColor`, `border`,
 *   `alignSelf`, etc.
 *
 * See app/index.tsx (StageRow, Reviews CTA) and app/reviews.tsx (ReviewRow)
 * for canonical usage.
 */
export function LinkButton({
  href,
  replace,
  outerStyle,
  innerStyle,
  pressedStyle = DEFAULT_PRESSED,
  children,
}: LinkButtonProps) {
  return (
    <Link href={href} replace={replace} asChild>
      <Pressable style={({ pressed }) => [outerStyle, pressed && pressedStyle]}>
        <View style={innerStyle}>{children}</View>
      </Pressable>
    </Link>
  );
}
