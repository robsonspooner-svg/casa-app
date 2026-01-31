import { Stack } from 'expo-router';
import { THEME } from '@casa/config';

export default function RoomsLayout() {
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
      <Stack.Screen name="[roomId]" />
    </Stack>
  );
}
