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
      <Stack.Screen name="index" options={{ title: 'All Payments' }} />
      <Stack.Screen name="[id]" options={{ title: 'Payment Details' }} />
      <Stack.Screen name="onboard" options={{ title: 'Payout Setup' }} />
    </Stack>
  );
}
