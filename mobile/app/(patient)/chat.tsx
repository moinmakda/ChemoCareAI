/**
 * Patient Chat Screen - AI-powered communication assistant
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Header, Avatar, Badge } from '../../src/components';
import { aiService, ChatMessage, ChatResponse } from '../../src/services/aiService';

interface DisplayMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  isUrgent?: boolean;
  shouldContactCareTeam?: boolean;
  suggestedActions?: string[];
}

export default function PatientChatScreen() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Messages with initial welcome message
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: '0',
      text: "Hello! I'm your ChemoCare AI assistant. I'm here to help answer your questions about your treatment, side effects, and general care. How are you feeling today?",
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
      isUrgent: false,
    },
  ]);

  // Convert messages to API format
  const getConversationHistory = useCallback((): ChatMessage[] => {
    return messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    }));
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessage: DisplayMessage = {
      id: Date.now().toString(),
      text: message.trim(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd();
    }, 100);

    try {
      const response = await aiService.chat({
        message: userMessage.text,
        conversation_history: getConversationHistory(),
      });

      const assistantMessage: DisplayMessage = {
        id: (Date.now() + 1).toString(),
        text: response.message,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        isUrgent: response.is_urgent,
        shouldContactCareTeam: response.should_contact_care_team,
        suggestedActions: response.suggested_actions,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Show alert if urgent
      if (response.is_urgent) {
        Alert.alert(
          '⚠️ Important Notice',
          'Based on what you shared, I recommend contacting your care team promptly.',
          [
            { text: 'Call Care Team', onPress: () => {} },
            { text: 'Continue Chat', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      // Add fallback message
      const fallbackMessage: DisplayMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble connecting right now. For any urgent concerns, please contact your care team directly. Is there anything else I can try to help with?",
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd();
      }, 100);
    }
  };

  const renderMessage = ({ item }: { item: DisplayMessage }) => {
    const isUser = item.sender === 'user';

    return (
      <View>
        <View
          style={[
            styles.messageContainer,
            isUser ? styles.userMessageContainer : styles.careTeamMessageContainer,
          ]}
        >
          {!isUser && (
            <View style={styles.aiAvatarContainer}>
              <Ionicons name="sparkles" size={20} color={colors.primary[500]} />
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.careTeamBubble,
              item.isUrgent && styles.urgentBubble,
            ]}
          >
            {!isUser && (
              <View style={styles.senderRow}>
                <Text style={styles.senderName}>ChemoCare AI</Text>
                {item.isUrgent && <Badge label="Urgent" variant="error" size="small" />}
              </View>
            )}
            <Text
              style={[styles.messageText, isUser && styles.userMessageText]}
            >
              {item.text}
            </Text>
            <View style={styles.timestampRow}>
              <Text
                style={[styles.timestamp, isUser && styles.userTimestamp]}
              >
                {item.timestamp}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Suggested Actions */}
        {item.suggestedActions && item.suggestedActions.length > 0 && (
          <View style={styles.suggestedActions}>
            {item.suggestedActions.slice(0, 2).map((action, idx) => (
              <TouchableOpacity key={idx} style={styles.suggestedAction}>
                <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.primary[500]} />
                <Text style={styles.suggestedActionText} numberOfLines={1}>{action}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Header
        title="AI Assistant"
        showBackButton
      />

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="sparkles" size={18} color={colors.primary[500]} />
        <Text style={styles.infoBannerText}>
          AI-powered assistant. For emergencies, call your care team directly.
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Typing indicator */}
      {loading && (
        <View style={styles.typingIndicator}>
          <View style={styles.aiAvatarContainerSmall}>
            <Ionicons name="sparkles" size={14} color={colors.primary[500]} />
          </View>
          <Text style={styles.typingText}>ChemoCare AI is typing...</Text>
          <ActivityIndicator size="small" color={colors.primary[500]} />
        </View>
      )}

      {/* Input Area */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || spacing.md }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Ask about your treatment..."
            placeholderTextColor={colors.text.tertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.sendButton, (!message.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!message.trim() || loading}
        >
          <Ionicons
            name="send"
            size={20}
            color={message.trim() && !loading ? colors.neutral[0] : colors.text.tertiary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  infoBannerText: {
    flex: 1,
    fontWeight: '400',
    fontSize: 11,
    color: colors.primary[600],
  },
  messagesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    maxWidth: '85%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  careTeamMessageContainer: {
    alignSelf: 'flex-start',
  },
  aiAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    marginTop: spacing.xs,
  } as ViewStyle,
  aiAvatarContainerSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  messageBubble: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: colors.primary[500],
    borderBottomRightRadius: 4,
  },
  careTeamBubble: {
    backgroundColor: colors.neutral[0],
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  urgentBubble: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  senderName: {
    fontWeight: '600',
    fontSize: 11,
    color: colors.primary[500],
  },
  messageText: {
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    lineHeight: 22,
  },
  userMessageText: {
    color: colors.neutral[0],
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  timestamp: {
    fontWeight: '400',
    fontSize: 10,
    color: colors.text.tertiary,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  suggestedActions: {
    marginLeft: 40,
    marginTop: -4,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  suggestedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  suggestedActionText: {
    fontWeight: '500',
    fontSize: 12,
    color: colors.primary[600],
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  typingText: {
    fontWeight: '400',
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    maxHeight: 120,
  },
  input: {
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    minHeight: 36,
    maxHeight: 100,
  } as TextStyle,
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.background.secondary,
  },
});
