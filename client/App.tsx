import { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth/context';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { colors } from './src/ui/theme';

/**
 * Navigation is a function of auth state rather than a router: three screens do not
 * justify a routing dependency, and "send the user to Login when the session is
 * rejected" is a state transition either way (design.md — smallest defensible option).
 */
function Root(): React.JSX.Element {
  const { status } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  if (status === 'restoring') {
    return (
      <View style={styles.centered} testID="app-restoring">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === 'anonymous') {
    return showSignup ? (
      <SignupScreen onGoToLogin={() => setShowSignup(false)} />
    ) : (
      <LoginScreen onGoToSignup={() => setShowSignup(true)} />
    );
  }

  return <DashboardScreen />;
}

export default function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="auto" />
        <Root />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
