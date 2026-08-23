import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/context';
import { GENERIC_AUTH_FAILURE } from '../auth/api';
import { NetworkError } from '../api/client';
import { Field } from '../ui/Field';
import { colors, radius, spacing } from '../ui/theme';

export function LoginScreen({ onGoToSignup }: { onGoToSignup: () => void }): React.JSX.Element {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await signIn({ email, password });
    } catch (caught) {
      // Every authentication failure collapses to one message. Naming the wrong field
      // here would re-open the account-enumeration hole the API deliberately closed.
      // A transport failure is a different thing and is reported as such.
      setError(caught instanceof NetworkError ? caught.message : GENERIC_AUTH_FAILURE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Welcome back to FamilyHub.</Text>

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        placeholder="Your password"
      />

      {error !== null ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>

      <Pressable onPress={onGoToSignup} accessibilityRole="link">
        <Text style={styles.link}>No account yet? Create one</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg, marginTop: spacing.xs },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 16 },
  link: { color: colors.primary, textAlign: 'center', marginTop: spacing.lg },
});
