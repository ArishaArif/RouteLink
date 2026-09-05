import React, { createContext, useContext, useState, ReactNode } from 'react';
import { createTheme, Theme } from '../constants/theme';

interface ThemeContextType {
  isDark: boolean;
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(true);

  const theme = createTheme(isDark);

  return (
    <ThemeContext.Provider value={{ isDark, theme, toggle: () => setIsDark((v) => !v) }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
