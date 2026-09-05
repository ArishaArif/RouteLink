import React, { createContext, useContext, useState, ReactNode } from 'react';
import { api, setAuthToken } from '../services/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const applySession = (u: User, t: string) => {
    setUser(u);
    setToken(t);
    setAuthToken(t);
  };

  const clearSession = () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
  };

  const login = async (email: string, password: string) => {
    const session = await api.login(email, password);
    applySession(session.user, session.token);
  };

  const signup = async (name: string, email: string, password: string) => {
    const session = await api.signup({ name, email, password, role: 'traveler' });
    applySession(session.user, session.token);
  };

  const logout = () => clearSession();

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
