/**
 * AI Chat Service - API calls for AI chat functionality
 */
import { apiClient } from './api';

// Request/Response types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  conversation_history?: ChatMessage[];
}

export interface ChatResponse {
  message: string;
  is_urgent: boolean;
  suggested_actions: string[];
  should_contact_care_team: boolean;
  symptom_severity: 'low' | 'moderate' | 'high' | 'critical' | null;
}

export const aiService = {
  /**
   * Send a message to the AI chat assistant
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await apiClient.post('/ai/chat', request);
    return response.data;
  },

  /**
   * Check AI service health
   */
  async healthCheck(): Promise<{
    status: string;
    model: string;
    provider: string;
    features: string[];
  }> {
    const response = await apiClient.get('/ai/health');
    return response.data;
  },
};
