import { Stack } from 'expo-router';
import { THEME } from '@casa/config';

export default function InspectionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: THEME.colors.canvas,
        },
        animation: 'slide_from_right',
      }}
    />
  );
}
