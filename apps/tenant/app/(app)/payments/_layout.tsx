import { Stack } from 'expo-router';
import { THEME } from '@casa/config';

export default function PaymentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: THEME.colors.surface },
        headerTintColor: THEME.colors.brand,
        headerTitleStyle: {
          fontWeight: THEME.fontWeight.semibold,
          color: THEME.colors.textPrimary,
        },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="pay" options={{ title: 'Make Payment' }} />
      <Stack.Screen name="methods" options={{ headerShown: false }} />
      <Stack.Screen name="autopay" options={{ title: 'Auto-Pay' }} />
      <Stack.Screen name="history" options={{ title: 'Payment History' }} />
    </Stack>
  );
}
