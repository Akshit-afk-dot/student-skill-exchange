import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initHaptics } from './src/haptics';
import { Navigation } from './src/navigation';
import { AuthProvider } from './src/store/auth';
import { ThemeProvider, palettes, useTheme } from './src/theme';

export default function App() {
  // Each weight is imported on its own so only the five the app uses are bundled.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    void initHaptics();
  }, []);

  // Hold on the splash colour until the typeface is ready, so text never flashes in the
  // system font and then jumps. If the fonts fail to load, carry on without them: a
  // working app in the wrong typeface beats a blank screen.
  if (!fontsLoaded && !fontError) {
    // Matches the native splash (app.json), so the hand-over is seamless.
    return <View style={{ flex: 1, backgroundColor: palettes.light.primary }} />;
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        {/*
          Tracks the keyboard frame by frame (Android's WindowInsetsAnimation, iOS's
          keyboard notifications), so anything that has to clear the keyboard moves
          with it instead of jumping after it. The app draws edge to edge, so Android
          no longer resizes the window for the keyboard: this is what makes room.
        */}
        <KeyboardProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <Navigation />
          </AuthProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

/** Inverted relative to the background, so the clock stays legible in both themes. */
function ThemedStatusBar() {
  const t = useTheme();
  return <StatusBar style={t.dark ? 'light' : 'dark'} />;
}
