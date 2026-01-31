import { Stack } from 'expo-router';
import { THEME } from '@casa/config';

export default function InspectionDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: THEME.colors.canvas,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="conduct" />
      <Stack.Screen name="rooms" />
      <Stack.Screen name="comparison" />
      <Stack.Screen name="evidence-report" />
    </Stack>
  );
}
