import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from './theme';

interface FieldProps extends TextInputProps {
  label: string;
  /** Message bound to this specific input, from the API's `field` attribution (7.2). */
  error?: string | undefined;
}

export function Field({ label, error, ...inputProps }: FieldProps): React.JSX.Element {
  const hasError = error !== undefined && error !== '';
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, hasError && styles.inputError]}
        placeholderTextColor={colors.textMuted}
        {...inputProps}
      />
      {hasError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  inputError: { borderColor: colors.fieldError },
  error: { color: colors.fieldError, marginTop: spacing.xs, fontSize: 13 },
});
