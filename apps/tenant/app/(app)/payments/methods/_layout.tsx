import { Stack } from 'expo-router';
import { THEME } from '@casa/config';

export default function MethodsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: THEME.colors.surface,
        },
        headerTintColor: THEME.colors.brand,
        headerTitleStyle: {
          fontWeight: '600',
          color: THEME.colors.textPrimary,
        },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Payment Methods' }} />
      <Stack.Screen name="add" options={{ title: 'Add Payment Method' }} />
    </Stack>
  );
}
