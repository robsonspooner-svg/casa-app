import { Stack } from 'expo-router';
import { THEME } from '@casa/config';

export default function ReportsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: THEME.colors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="financial" />
      <Stack.Screen name="expenses" />
      <Stack.Screen name="tax" />
      <Stack.Screen name="property-performance" />
      <Stack.Screen name="cash-flow" />
      <Stack.Screen name="generated" />
    </Stack>
  );
}
