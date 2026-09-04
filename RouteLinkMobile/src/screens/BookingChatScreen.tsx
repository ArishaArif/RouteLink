import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { ChatMessage } from '../types';
import { api } from '../services/api';

interface BookingChatScreenProps {
  bookingId?: string | null;
  guideName?: string | null;
  myUserId?: string | null;
}

export const BookingChatScreen: React.FC<BookingChatScreenProps> = ({
  bookingId = null,
  guideName = 'your guide',
  myUserId = null,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const history = await api.getMessages(bookingId);
      setMessages(history);
    } catch (err: any) {
      setLoadError("Couldn't load this conversation. Pull down to retry.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || !bookingId) return;

    const textToSend = inputText;
    setInputText('');
    setSending(true);
    try {
      const saved = await api.sendMessage(bookingId, textToSend);
      setMessages((prev) => [...prev, saved]);
    } catch (err: any) {
      // Put the text back so the traveler doesn't lose it, and surface the failure --
      // silently swallowing this (as the old version did) hides real send failures.
      setInputText(textToSend);
      setLoadError("Message didn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  if (!bookingId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No active conversation</Text>
        <Text style={styles.emptySubtitle}>
          Book a guide from the Guides tab to start chatting with them here.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat with {guideName}</Text>
        <Text style={styles.subTitle}>Booking ID: #{bookingId.slice(0, 8)}</Text>
      </View>

      {loadError && <Text style={styles.errorBanner}>{loadError}</Text>}

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isMe = myUserId ? item.senderId === myUserId : item.sender?.name !== guideName;
            return (
              <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                <Text style={styles.senderName}>{item.sender?.name || 'Unknown'}</Text>
                <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>{item.text}</Text>
                <Text style={styles.timestamp}>{item.createdAt}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyListText}>No messages yet -- say hello!</Text>
          }
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Write a message..."
          value={inputText}
          onChangeText={setInputText}
          editable={!sending}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
          {sending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.sendBtnText}>Send</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F5F5' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6C757D', textAlign: 'center' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  subTitle: { fontSize: 12, color: '#666', marginTop: 2 },
  errorBanner: { backgroundColor: '#FEE2E2', color: '#991B1B', padding: 8, fontSize: 12, textAlign: 'center' },
  loader: { marginTop: 30 },
  messageList: { padding: 16 },
  emptyListText: { textAlign: 'center', color: '#999', marginTop: 20 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 10 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: '#E5E5EA' },
  senderName: { fontSize: 10, color: '#888', marginBottom: 2 },
  messageText: { fontSize: 14, lineHeight: 18 },
  myText: { color: '#FFF' },
  theirText: { color: '#000' },
  timestamp: { fontSize: 9, color: '#AAA', marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  input: { flex: 1, borderWidth: 1, borderColor: '#CCC', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  sendBtn: { backgroundColor: '#007AFF', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnText: { color: '#FFF', fontWeight: 'bold' },
});
