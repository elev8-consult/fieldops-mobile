import { Stack } from 'expo-router';
import { colors, font } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '800', fontSize: font.body },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="home" options={{ title: 'Select outlet' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan products' }} />
    </Stack>
  );
}
