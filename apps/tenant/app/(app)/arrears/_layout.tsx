import { Stack } from 'expo-router';
import { THEME } from '@casa/config';

export default function ArrearsLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Arrears' }} />
      <Stack.Screen name="payment-plan" options={{ title: 'Payment Plan' }} />
    </Stack>
  );
}
