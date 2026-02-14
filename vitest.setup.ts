import { vi } from 'vitest';

// Mock @react-navigation/native for hooks that use useFocusEffect
vi.mock('@react-navigation/native', () => ({
  useFocusEffect: vi.fn(),
  useNavigation: vi.fn(() => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
    setOptions: vi.fn(),
  })),
  useRoute: vi.fn(() => ({
    params: {},
  })),
  useIsFocused: vi.fn(() => true),
}));
