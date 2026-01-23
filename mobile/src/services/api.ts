/**
 * API Client for ChemoCare Backend
 */
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
};

// Convert snake_case to camelCase
const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Recursively convert object keys from snake_case to camelCase
const convertKeysToCamelCase = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);
  if (typeof obj !== 'object') return obj;
  
  const converted: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = toCamelCase(key);
      converted[camelKey] = convertKeysToCamelCase(obj[key]);
    }
  }
  return converted;
};

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error reading token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh and case conversion
apiClient.interceptors.response.use(
  (response) => {
    // Convert snake_case to camelCase for all responses
    if (response.data) {
      response.data = convertKeysToCamelCase(response.data);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          const { access_token, refresh_token } = response.data;
          
          await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, access_token);
          await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
          
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Clear tokens and redirect to login
        await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        // The auth store will handle redirect
      }
    }
    
    return Promise.reject(error);
  }
);

// Day Care API endpoints
const daycareApi = {
  getActivePatients: () => apiClient.get('/daycare/sessions/active').then(res => res.data),
  getChairStatus: () => apiClient.get('/daycare/chairs').then(res => res.data),
  getPatientDetails: (id: string) => apiClient.get(`/daycare/sessions/${id}`).then(res => res.data),
  startInfusion: (sessionId: string) => apiClient.post(`/daycare/sessions/${sessionId}/start`),
  updateProgress: (sessionId: string, progress: number) => apiClient.patch(`/daycare/sessions/${sessionId}/progress`, { progress }),
  reportReaction: (sessionId: string, data: any) => apiClient.post(`/daycare/sessions/${sessionId}/reaction`, data),
  completeSession: (sessionId: string) => apiClient.post(`/daycare/sessions/${sessionId}/complete`),
};

// API object with organized endpoints
const api = {
  client: apiClient,
  daycare: daycareApi,
};

export default api;

// Export the raw client for backward compatibility
export { apiClient };

// Helper functions
export const setAuthTokens = async (accessToken: string, refreshToken: string) => {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
};

export const clearAuthTokens = async () => {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
};

export const getAccessToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
};
