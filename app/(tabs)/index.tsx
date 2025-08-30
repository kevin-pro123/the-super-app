import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import AuthScreen from '@/components/AuthScreen';
import PassengerView from '@/components/PassengerView';
import DriverView from '@/components/DriverView';
import LoadingScreen from '@/components/LoadingScreen';

export default function HomeScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <View style={styles.container}>
      {user.role === 'passenger' ? (
        <PassengerView user={user} onNavigate={() => {}} />
      ) : (
        <DriverView user={user} onNavigate={() => {}} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});