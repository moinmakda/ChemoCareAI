/**
 * Index Screen - Entry point that redirects based on auth state
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/constants/theme';

export default function IndexScreen() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  // Redirect based on auth state
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Redirect based on user role
  switch (user?.role) {
    case 'patient':
      return <Redirect href="/(patient)/home" />;
    case 'doctor_opd':
      return <Redirect href="/(doctor-opd)/home" />;
    case 'doctor_daycare':
      return <Redirect href="/(doctor-daycare)/home" />;
    case 'nurse':
      return <Redirect href="/(nurse)/home" />;
    case 'admin':
      return <Redirect href="/(doctor-daycare)/home" />;
    default:
      return <Redirect href="/(auth)/login" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
});
