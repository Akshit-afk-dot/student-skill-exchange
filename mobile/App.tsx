import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initHaptics } from './src/haptics';
import { Navigation } from './src/navigation';
import { AuthProvider } from './src/store/auth';

export default function App() {
  const scheme = useColorScheme();

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
    return <View style={{ flex: 1, backgroundColor: '#5B4BE8' }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* Inverted relative to the background, so the clock stays legible in both themes. */}
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Navigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
