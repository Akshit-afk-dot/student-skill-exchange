import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { Navigation } from './src/navigation';
import { AuthProvider } from './src/store/auth';

export default function App() {
  const scheme = useColorScheme();

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
