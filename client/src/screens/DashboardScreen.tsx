import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/context';
import { fetchDashboard } from '../family/api';
import type { Dashboard } from '../family/types';
import { UnauthenticatedError } from '../api/client';
import { isShoppingSummaryArray } from '../shopping/types';
import { colors, radius, spacing } from '../ui/theme';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; dashboard: Dashboard }
  | { kind: 'failed'; message: string };

interface DashboardScreenProps {
  onOpenShopping: () => void;
}

export function DashboardScreen({ onOpenShopping }: DashboardScreenProps): React.JSX.Element {
  const { api, signOut } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async (): Promise<void> => {
    setState({ kind: 'loading' });
    try {
      const dashboard = await fetchDashboard(api);
      setState({ kind: 'loaded', dashboard });
    } catch (caught) {
      // A rejected session is not a load failure — the provider has already switched
      // the app back to the signed-out surface, so showing an error here would flash
      // a contradiction on the way out.
      if (caught instanceof UnauthenticatedError) return;
      setState({
        kind: 'failed',
        message: caught instanceof Error ? caught.message : 'Could not load your dashboard.',
      });
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <View style={styles.centered} testID="dashboard-loading">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.mutedText}>Loading your family…</Text>
      </View>
    );
  }

  // "Could not load" — visually and textually distinct from the empty state below,
  // and the only one of the two that offers a retry, because it is the only one
  // where retrying means anything (family-dashboard: Empty vs unavailable).
  if (state.kind === 'failed') {
    return (
      <View style={styles.centered} testID="dashboard-error">
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Couldn&apos;t load your dashboard</Text>
          <Text style={styles.errorBody}>{state.message}</Text>
          <Text style={styles.errorHint}>
            This is a problem loading the information — not an empty family.
          </Text>
          <Pressable style={styles.retryButton} onPress={load} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
        <Pressable onPress={signOut} accessibilityRole="button">
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  const { dashboard } = state;

  return (
    <ScrollView contentContainerStyle={styles.page} testID="dashboard-loaded">
      <View style={styles.header}>
        <View>
          <Text style={styles.familyName}>{dashboard.family.name}</Text>
          <Text style={styles.mutedText}>
            {dashboard.members.length} {dashboard.members.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <Pressable onPress={signOut} accessibilityRole="button">
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {dashboard.isEmpty ? (
        // The API said "successful, and there is nothing here yet". Rendered as a
        // deliberate state with its own copy — never a blank screen (task 7.6).
        <View style={styles.emptyCard} testID="dashboard-empty">
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>
            Your family is set up and ready. Calendar events, tasks, and shopping lists will appear
            here as you add them.
          </Text>
          <Pressable style={styles.emptyAction} onPress={onOpenShopping} accessibilityRole="button">
            <Text style={styles.emptyActionText}>Start a shopping list</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sections}>
          {dashboard.sections.map((section) => {
            if (section.key === 'shopping' && isShoppingSummaryArray(section.items)) {
              return (
                <Pressable
                  key={section.key}
                  style={styles.sectionCard}
                  onPress={onOpenShopping}
                  accessibilityRole="button"
                  testID="dashboard-shopping"
                >
                  <Text style={styles.sectionTitle}>shopping</Text>
                  {section.items.length === 0 ? (
                    <Text style={styles.mutedText}>No lists yet — tap to create one</Text>
                  ) : (
                    section.items.map((summary) => (
                      <Text key={summary.listId} style={styles.mutedText}>
                        {summary.name} · {summary.uncheckedCount} to buy
                      </Text>
                    ))
                  )}
                </Pressable>
              );
            }
            return (
              <View key={section.key} style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{section.key}</Text>
                <Text style={styles.mutedText}>{section.items.length} items</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.membersBlock}>
        <Text style={styles.sectionTitle}>Members</Text>
        {dashboard.members.map((member) => (
          <Text key={member.userId} style={styles.member}>
            {member.email} · {member.role}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  familyName: { fontSize: 26, fontWeight: '700', color: colors.text },
  mutedText: { color: colors.textMuted, marginTop: spacing.xs },
  signOut: { color: colors.primary, fontWeight: '600' },

  emptyCard: {
    backgroundColor: colors.emptySurface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.empty, marginBottom: spacing.sm },
  emptyBody: { color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyAction: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  emptyActionText: { color: colors.primaryText, fontWeight: '600' },

  errorCard: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.danger, marginBottom: spacing.sm },
  errorBody: { color: colors.text, marginBottom: spacing.sm },
  errorHint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  retryButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  retryText: { color: colors.primaryText, fontWeight: '600' },

  sections: { gap: spacing.sm },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  membersBlock: { marginTop: spacing.xl },
  member: { color: colors.textMuted, marginTop: spacing.xs },
});
