/**
 * Patient Chat Screen - Communication with care team
 */
import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Header, Avatar } from '../../src/components';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'care_team';
  senderName?: string;
  timestamp: string;
  read: boolean;
}

export default function PatientChatScreen() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [message, setMessage] = useState('');

  // Mock messages
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! How are you feeling after your last treatment session?',
      sender: 'care_team',
      senderName: 'Nurse Sarah',
      timestamp: '10:30 AM',
      read: true,
    },
    {
      id: '2',
      text: "I'm feeling much better today, thank you. The nausea has mostly subsided.",
      sender: 'user',
      timestamp: '10:35 AM',
      read: true,
    },
    {
      id: '3',
      text: "That's great to hear! Remember to stay hydrated and take your anti-nausea medication as prescribed. Let us know if you experience any new symptoms.",
      sender: 'care_team',
      senderName: 'Nurse Sarah',
      timestamp: '10:38 AM',
      read: true,
    },
    {
      id: '4',
      text: 'I will. When should I expect results from my blood work?',
      sender: 'user',
      timestamp: '11:00 AM',
      read: true,
    },
    {
      id: '5',
      text: 'Your blood work results should be available by tomorrow afternoon. Dr. Johnson will review them and reach out if there are any concerns. You can also view them in your patient portal once available.',
      sender: 'care_team',
      senderName: 'Nurse Sarah',
      timestamp: '11:05 AM',
      read: true,
    },
  ]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: message.trim(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
      read: false,
    };

    setMessages([...messages, newMessage]);
    setMessage('');

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd();
    }, 100);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.careTeamMessageContainer,
        ]}
      >
        {!isUser && (
          <Avatar name={item.senderName} size="small" style={styles.avatar} />
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.careTeamBubble,
          ]}
        >
          {!isUser && item.senderName && (
            <Text style={styles.senderName}>{item.senderName}</Text>
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
            {isUser && (
              <Ionicons
                name={item.read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.read ? colors.info : colors.neutral[0]}
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
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
        title="Care Team"
        showBackButton
      />

      {/* Care Team Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color={colors.info} />
        <Text style={styles.infoBannerText}>
          For emergencies, please call the emergency hotline or visit the nearest ER.
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

      {/* Input Area */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || spacing.md }]}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="attach" size={24} color={colors.text.secondary} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor={colors.text.tertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
          />
        </View>

        <TouchableOpacity
          style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={message.trim() ? colors.neutral[0] : colors.text.tertiary}
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
    backgroundColor: colors.infoLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  infoBannerText: {
    flex: 1,
    fontWeight: '400',
    fontSize: 11,
    color: colors.info,
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
  avatar: {
    marginRight: spacing.xs,
    marginTop: spacing.xs,
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
  },
  senderName: {
    fontWeight: '600',
    fontSize: 11,
    color: colors.primary[500],
    marginBottom: 2,
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
  readIcon: {
    marginLeft: 4,
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
  attachButton: {
    padding: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.xs,
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
