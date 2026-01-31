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
      <Stack.Screen name="[id]" options={{ title: 'Arrears Details' }} />
      <Stack.Screen name="create-plan" options={{ title: 'Create Payment Plan' }} />
      <Stack.Screen name="log-action" options={{ title: 'Log Action' }} />
      <Stack.Screen name="templates" options={{ title: 'Reminder Templates' }} />
    </Stack>
  );
}
