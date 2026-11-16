import { createContext, useContext } from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { fontForWeight } from '../theme';

/** True for any Text rendered inside another Text, where style is inherited. */
const InsideText = createContext(false);

/**
 * The app's text primitive. Use this instead of React Native's `Text`.
 *
 * The typeface ships as one file per weight, so "bold" is a different font family rather
 * than a `fontWeight`. This component hides that: write `fontWeight: '600'` as usual and
 * it picks the matching file, then removes the weight so Android does not smear a fake
 * bold on top of the real one.
 *
 * A nested Text with no weight of its own is left alone, so it inherits its parent's
 * family the way nested text is expected to.
 */
export function Text({ style, children, ...props }: TextProps) {
  const nested = useContext(InsideText);
  const { fontWeight, fontFamily, ...rest } = (StyleSheet.flatten(style) ?? {}) as TextStyle;

  // An explicit weight wins, then an explicit family, then the regular face. Nested
  // text with neither inherits instead.
  const family =
    fontWeight !== undefined
      ? fontForWeight(fontWeight)
      : (fontFamily ?? (nested ? undefined : fontForWeight('400')));

  return (
    <RNText {...props} style={family ? [rest, { fontFamily: family }] : rest}>
      <InsideText.Provider value>{children}</InsideText.Provider>
    </RNText>
  );
}
