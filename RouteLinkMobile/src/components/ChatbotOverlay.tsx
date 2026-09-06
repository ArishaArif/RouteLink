import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ChatSidebar } from './ChatSidebar';

/* ------------------------------------------------------------------ */
/*  Routes where the FAB should NOT appear                             */
/* ------------------------------------------------------------------ */

const HIDDEN_ROUTES = new Set(['SOS']);

/* ------------------------------------------------------------------ */
/*  ChatbotOverlay — FAB + sidebar, placed inside RootNavigator        */
/* ------------------------------------------------------------------ */

interface ChatbotOverlayProps {
  /** Current active route name — pass from useRoute() or navigation state. */
  currentRoute: string;
}

export const ChatbotOverlay: React.FC<ChatbotOverlayProps> = ({ currentRoute }) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  const showFab = !HIDDEN_ROUTES.has(currentRoute);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* FAB */}
      {showFab && !open && (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor: theme.colors.buttonPrimary,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: theme.isDark ? 0.4 : 0.18,
              shadowRadius: 14,
              elevation: 8,
            },
          ]}
          onPress={toggle}
          activeOpacity={0.85}
          accessibilityLabel="Open RouteLink Assistant"
          accessibilityRole="button"
        >
          <Ionicons name="chatbubble-ellipses" size={26} color={theme.colors.onButtonPrimary} />
        </TouchableOpacity>
      )}

      {/* Sidebar */}
      <ChatSidebar visible={open} onClose={close} />
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 92, // above the 72px tab bar + 20px breathing room
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
