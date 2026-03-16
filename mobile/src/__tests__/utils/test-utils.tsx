/**
 * Test Utilities
 * 
 * Custom render functions and utilities for testing React Native components.
 */
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock providers wrapper
const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 0, height: 0 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      {children}
    </SafeAreaProvider>
  );
};

/**
 * Custom render function that includes all necessary providers
 */
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

// Re-export everything
export * from '@testing-library/react-native';

// Override render method
export { customRender as render };

/**
 * Helper to create mock navigation
 */
export const createMockNavigation = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  dispatch: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getParent: jest.fn(),
  getState: jest.fn(() => ({ routes: [], index: 0 })),
});

/**
 * Helper to create mock route
 */
export const createMockRoute = <T extends Record<string, unknown>>(params?: T) => ({
  key: 'test-route',
  name: 'TestScreen' as const,
  params: params || {},
});

/**
 * Wait for async state updates
 */
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Helper for testing form inputs
 */
export const fillInput = async (
  getByTestId: (id: string) => any,
  testId: string,
  value: string
) => {
  const { fireEvent } = await import('@testing-library/react-native');
  const input = getByTestId(testId);
  fireEvent.changeText(input, value);
  return input;
};

/**
 * Helper for testing button presses
 */
export const pressButton = async (
  getByTestId: (id: string) => any,
  testId: string
) => {
  const { fireEvent } = await import('@testing-library/react-native');
  const button = getByTestId(testId);
  fireEvent.press(button);
  return button;
};

/**
 * Create a mock Zustand store for testing
 */
export const createMockStore = <T extends object>(initialState: T) => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (partial: Partial<T>) => {
      state = { ...state, ...partial };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => listeners.clear(),
  };
};
