import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { ChatbotMessage } from '../types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SIDEBAR_WIDTH_RATIO = 0.88;
const MAX_SIDEBAR_WIDTH = 400;
const HEADER_HEIGHT = 56;
const INPUT_BAR_HEIGHT = 60;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ------------------------------------------------------------------ */
/*  ChatSidebar                                                        */
/* ------------------------------------------------------------------ */

interface ChatSidebarProps {
  visible: boolean;
  onClose: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const sessionIdRef = useRef<string>(uid());
  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(1)).current; // 1 = off-screen right

  // Animate in/out
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatbotMessage = { id: uid(), role: 'user', text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    scrollToBottom();

    try {
      const { reply } = await api.sendChatbotMessage(text, sessionIdRef.current);
      const botMsg: ChatbotMessage = { id: uid(), role: 'bot', text: reply, timestamp: Date.now() };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errMsg: ChatbotMessage = {
        id: uid(),
        role: 'bot',
        text: "Couldn't reach the assistant. Check your connection and try again.",
        timestamp: Date.now(),
        error: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }, [input, sending, scrollToBottom]);

  // Reset session when sidebar opens fresh
  useEffect(() => {
    if (visible && messages.length === 0) {
      sessionIdRef.current = uid();
    }
  }, [visible]);

  if (!visible) return null;

  const scrimColor = theme.isDark ? 'rgba(8,11,15,0.55)' : 'rgba(0,0,0,0.3)';
  const sidebarBg = theme.colors.surface;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Scrim / backdrop */}
      <TouchableOpacity
        style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }]}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sidebar panel */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            backgroundColor: sidebarBg,
            borderColor: theme.colors.border,
            transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, MAX_SIDEBAR_WIDTH + 40] }) }],
          },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
              RouteLink Assistant
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Message list */}
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={40} color={theme.colors.primary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
                How can I help?
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                Ask me about your trip, hazards, guides, or anything else.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
            />
          )}

          {/* Typing indicator */}
          {sending && (
            <View style={[styles.typingRow]}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.typingText, { color: theme.colors.textSecondary }]}>
                Thinking...
              </Text>
            </View>
          )}

          {/* Input bar */}
          <View style={[styles.inputBar, { borderTopColor: theme.colors.border, backgroundColor: sidebarBg }]}>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.colors.surfaceSecondary,
                  borderColor: theme.colors.border,
                },
              ]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask something..."
              placeholderTextColor={theme.colors.textSecondary}
              returnKeyType="send"
              onSubmitEditing={send}
              editable={!sending}
              multiline={false}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: theme.colors.buttonPrimary, opacity: input.trim() && !sending ? 1 : 0.4 },
              ]}
              onPress={send}
              disabled={!input.trim() || sending}
            >
              <Ionicons name="send" size={20} color={theme.colors.onButtonPrimary} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Message bubble                                                     */
/* ------------------------------------------------------------------ */

const MessageBubble: React.FC<{ message: ChatbotMessage }> = ({ message }) => {
  const { theme } = useTheme();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.colors.buttonPrimary : theme.colors.surfaceSecondary,
            borderColor: isUser ? 'transparent' : theme.colors.border,
            borderWidth: isUser ? 0 : 1,
            alignSelf: isUser ? 'flex-end' : 'flex-start',
          },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? theme.colors.onButtonPrimary : theme.colors.textPrimary },
            message.error && { color: theme.colors.danger },
          ]}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '88%',
    maxWidth: MAX_SIDEBAR_WIDTH,
    borderLeftWidth: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  typingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
