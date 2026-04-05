import '../global.css';
import { Stack } from 'expo-router';
import { AppProvider } from '../src/store/AppContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#f7f7f5' },
          }}
        />
      </AppProvider>
    </SafeAreaProvider>
  );
}
