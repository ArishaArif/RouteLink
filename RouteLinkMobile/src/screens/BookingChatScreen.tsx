import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { ChatMessage } from '../types';
import { api } from '../services/api';

interface BookingChatScreenProps {
  bookingId?: string;
  guideName?: string;
}

export const BookingChatScreen: React.FC<BookingChatScreenProps> = ({
  bookingId = '04b8f4e2-1c9d-4a77-9f3e-2b6a5c8d1e88',
  guideName = 'Ali Raza',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initial mock thread setup
    setMessages([
      {
        id: 'msg-1',
        bookingId,
        senderId: 'guide-uuid',
        text: `Hello! I am ${guideName}. Looking forward to guiding your trip in Hunza!`,
        sender: { id: 'guide-uuid', name: guideName },
        createdAt: '10:00 AM',
      },
    ]);
  }, [bookingId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      bookingId,
      senderId: 'me-uuid',
      text: inputText,
      sender: { id: 'me-uuid', name: 'You' },
      createdAt: 'Just now',
    };

    setMessages((prev) => [...prev, newMsg]);
    const textToSend = inputText;
    setInputText('');

    try {
      await api.sendMessage(bookingId, textToSend);
    } catch (err) {
      // Retain message locally for seamless UX during offline/testing
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat with {guideName}</Text>
        <Text style={styles.subTitle}>Booking ID: #{bookingId.slice(0, 8)}</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => {
          const isMe = item.sender.name === 'You';
          return (
            <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
              <Text style={styles.senderName}>{item.sender.name}</Text>
              <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>{item.text}</Text>
              <Text style={styles.timestamp}>{item.createdAt}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Write a message..."
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  subTitle: { fontSize: 12, color: '#666', marginTop: 2 },
  messageList: { padding: 16 },
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