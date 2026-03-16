/**
 * Jest Setup File
 * 
 * Configures the test environment including:
 * - React Native mocks
 * - Global test utilities
 * 
 * NOTE: MSW (Mock Service Worker) is temporarily disabled due to 
 * peer dependency conflicts. Service tests use jest mocks instead.
 */
import '@testing-library/react-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => children,
  Slot: () => null,
  Stack: {
    Screen: () => null,
  },
  Tabs: {
    Screen: () => null,
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
  PanGestureHandler: 'PanGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  State: {},
  Directions: {},
}));

// Silence console warnings during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = args[0]?.toString() || '';
    if (
      message.includes('Warning:') ||
      message.includes('act(...)') ||
      message.includes('Not implemented')
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
  
  console.warn = (...args: unknown[]) => {
    const message = args[0]?.toString() || '';
    if (message.includes('componentWillReceiveProps')) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
(global as unknown as Record<string, unknown>).waitFor = async (callback: () => boolean | Promise<boolean>, timeout = 5000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await callback()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('waitFor timeout');
};
