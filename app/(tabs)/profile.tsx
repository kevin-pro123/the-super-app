import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import ProfileScreen from '@/components/ProfileScreen';
import LoadingScreen from '@/components/LoadingScreen';
import AuthScreen from '@/components/AuthScreen';

export default function ProfileTab() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <View style={styles.container}>
      <ProfileScreen user={user} onBack={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});