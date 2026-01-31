import { Stack } from 'expo-router';
import { THEME } from '@casa/config';

export default function SubscriptionLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Subscription' }} />
      <Stack.Screen name="add-ons" options={{ title: 'Add-On Services' }} />
      <Stack.Screen name="billing-history" options={{ title: 'Billing History' }} />
    </Stack>
  );
}
