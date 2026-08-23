import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/context';
import { SignupValidationError } from '../auth/api';
import { ApiError, NetworkError } from '../api/client';
import { Field } from '../ui/Field';
import { colors, radius, spacing } from '../ui/theme';

export function SignupScreen({ onGoToLogin }: { onGoToLogin: () => void }): React.JSX.Element {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await register({ email, password, familyName });
    } catch (caught) {
      if (caught instanceof SignupValidationError) {
        // Bind each message to the input the API blamed, so the error appears where
        // the user can act on it rather than as one anonymous banner (task 7.2).
        const next: Record<string, string> = {};
        for (const { field, message } of caught.errors) next[field] = message;
        setFieldErrors(next);
      } else if (caught instanceof NetworkError) {
        setFormError(caught.message);
      } else if (caught instanceof ApiError) {
        setFormError(caught.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your family</Text>
      <Text style={styles.subtitle}>Signing up creates your account and your family together.</Text>

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete="new-password"
        placeholder="Choose a strong password"
      />
      <Field
        label="Family name (optional)"
        value={familyName}
        onChangeText={setFamilyName}
        error={fieldErrors.familyName}
        placeholder="The Levrats"
      />

      {formError !== null ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{busy ? 'Creating…' : 'Create account'}</Text>
      </Pressable>

      <Pressable onPress={onGoToLogin} accessibilityRole="link">
        <Text style={styles.link}>Already have an account? Sign in</Text>
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
