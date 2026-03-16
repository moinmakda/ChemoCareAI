/**
 * Auth Service Tests
 * 
 * Tests for authentication API service using Jest mocks.
 */
import { authService } from '../../services/authService';

// Mock the api module
jest.mock('../../services/api', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
  setAuthTokens: jest.fn(() => Promise.resolve()),
  clearAuthTokens: jest.fn(() => Promise.resolve()),
}));

import { apiClient, setAuthTokens, clearAuthTokens } from '../../services/api';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('successfully logs in with valid credentials', async () => {
      const mockResponse = {
        data: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          tokenType: 'bearer',
          expiresIn: 3600,
        },
      };
      mockedApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authService.login({
        email: 'patient@test.com',
        password: 'password123',
      });

      expect(clearAuthTokens).toHaveBeenCalled();
      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/login', expect.any(Object));
      expect(setAuthTokens).toHaveBeenCalledWith('mock-access-token', 'mock-refresh-token');
      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('throws error with invalid credentials', async () => {
      mockedApiClient.post.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        authService.login({
          email: 'wrong@test.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('successfully registers a new user', async () => {
      const mockResponse = {
        data: {
          id: '2',
          email: 'newuser@test.com',
          fullName: 'New User',
          role: 'patient',
        },
      };
      mockedApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authService.register({
        email: 'newuser@test.com',
        password: 'password123',
        full_name: 'New User',
        role: 'patient' as const,
      });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/register', expect.any(Object));
      expect(result).toBeDefined();
      expect(result.email).toBe('newuser@test.com');
    });

    it('handles validation errors', async () => {
      mockedApiClient.post.mockRejectedValueOnce(new Error('Email already registered'));

      await expect(
        authService.register({
          email: 'existing@test.com',
          password: 'password123',
          full_name: 'Existing User',
          role: 'patient' as const,
        })
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('getCurrentUser', () => {
    it('successfully gets current user', async () => {
      const mockResponse = {
        data: {
          id: '1',
          email: 'patient@test.com',
          fullName: 'Test Patient',
          role: 'patient',
        },
      };
      mockedApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await authService.getCurrentUser();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toBeDefined();
      expect(result.email).toBe('patient@test.com');
    });

    it('handles unauthorized error', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(authService.getCurrentUser()).rejects.toThrow('Unauthorized');
    });
  });

  describe('logout', () => {
    it('successfully logs out', async () => {
      mockedApiClient.post.mockResolvedValueOnce({});

      await authService.logout();

      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/logout');
      expect(clearAuthTokens).toHaveBeenCalled();
    });

    it('clears tokens even if API call fails', async () => {
      mockedApiClient.post.mockRejectedValueOnce(new Error('Network error'));

      // Logout will throw but tokens should still be cleared in finally block
      try {
        await authService.logout();
      } catch {
        // Expected to throw
      }

      expect(clearAuthTokens).toHaveBeenCalled();
    });
  });
});
