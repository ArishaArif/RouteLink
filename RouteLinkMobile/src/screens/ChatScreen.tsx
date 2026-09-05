import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../services/api';
import { ChatMessage, RootStackParamList } from '../types';
import { formatRelativeTime } from '../utils/display';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const POLL_INTERVAL_MS = 15000;

export const ChatScreen = ({ route }: Props) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { bookingId, title } = route.params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await api.listMessages(bookingId);
      setMessages(data);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : 'Unable to load messages.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [bookingId]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      load(false);
    }, POLL_INTERVAL_MS);
  }, [load]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      startPolling();
      return () => {
        stopPolling();
      };
    }, [load, startPolling, stopPolling])
  );

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      bookingId,
      senderId: user?.id || 'me',
      text: trimmed,
      sender: { id: user?.id || 'me', name: user?.name || 'You' },
      createdAt: new Date().toISOString(),
    };

    setText('');
    setSending(true);
    setMessages((prev) => [...prev, optimistic]);
    Vibration.vibrate(10);

    try {
      const sent = await api.sendMessage(bookingId, trimmed);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? sent : m))
      );
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(e instanceof ApiError ? e.message : 'Message failed to send.');
    } finally {
      setSending(false);
    }
  };

  const isMe = (msg: ChatMessage) => msg.senderId === user?.id;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-outline" size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textPrimary }]}>
                Start the conversation
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                Messages are synced every 15 seconds while this screen is open.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const me = isMe(item);
          return (
            <View style={[styles.bubbleRow, me ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: me ? theme.colors.buttonPrimary : theme.colors.surface,
                    borderColor: me ? 'transparent' : theme.colors.border,
                  },
                ]}
              >
                {!me && (
                  <Text style={[styles.sender, { color: theme.colors.primary }]}>
                    {item.sender?.name || 'Guide'}
                  </Text>
                )}
                <Text style={{ color: me ? theme.colors.onButtonPrimary : theme.colors.textPrimary }}>
                  {item.text}
                </Text>
                <Text
                  style={[
                    styles.time,
                    { color: me ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary },
                  ]}
                >
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
          <Text style={[styles.errorText, { color: theme.colors.dangerSoftText }]}>{error}</Text>
          <TouchableOpacity onPress={() => load(false)} activeOpacity={0.8}>
            <Text style={[styles.errorAction, { color: theme.colors.danger }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surfaceSecondary,
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
            },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: text.trim() ? theme.colors.buttonPrimary : theme.colors.surfaceSecondary,
            },
          ]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <Ionicons name="sync" size={20} color={theme.colors.textSecondary} />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={text.trim() ? theme.colors.onButtonPrimary : theme.colors.textSecondary}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 32,
  },
  bubbleRow: {
    marginBottom: 10,
  },
  bubbleRowLeft: {
    alignItems: 'flex-start',
  },
  bubbleRowRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  sender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  time: {
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  errorAction: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
