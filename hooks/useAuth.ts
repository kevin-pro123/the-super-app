import { useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken, onAuthChange, notifyAuthChange } from '@/lib/api';
import { User } from '@/types/database';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<User>('/auth/me'));
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
    return onAuthChange(fetchUserProfile);
  }, [fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await api<{ token: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(data.token);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'passenger' | 'driver',
    userType: 'adult' | 'child' | 'student' | 'driver',
    documentNumber: string
  ) => {
    try {
      const data = await api<{ token: string }>('/auth/register', {
        method: 'POST',
        body: {
          email,
          password,
          full_name: fullName,
          role,
          user_type: userType,
          document_number: documentNumber,
        },
      });
      setToken(data.token);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    setToken(null);
    return { error: null };
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser: notifyAuthChange,
  };
}
