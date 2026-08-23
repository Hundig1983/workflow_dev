import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UnauthenticatedError } from '../api/client';
import { useAuth } from '../auth/context';
import { createList, deleteList, fetchLists } from '../shopping/api';
import type { ShoppingListWithCounts } from '../shopping/types';
import { Field } from '../ui/Field';
import { colors, radius, spacing } from '../ui/theme';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; lists: ShoppingListWithCounts[] }
  | { kind: 'failed'; message: string };

interface ListsScreenProps {
  onOpenList: (listId: string, name: string) => void;
  onBack: () => void;
}

export function ListsScreen({ onOpenList, onBack }: ListsScreenProps): React.JSX.Element {
  const { api } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Two-tap delete: first tap arms this id, second tap deletes (RN-friendly confirm). */
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'loaded', lists: await fetchLists(api) });
    } catch (caught) {
      if (caught instanceof UnauthenticatedError) return;
      setState({
        kind: 'failed',
        message: caught instanceof Error ? caught.message : 'Could not load your lists.',
      });
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(): Promise<void> {
    const name = newName.trim();
    if (name === '' || creating) return;
    setCreating(true);
    setFormError(null);
    try {
      const created = await createList(api, name);
      setNewName('');
      // Reconcile with the server response rather than guessing counts locally.
      setState((prev) =>
        prev.kind === 'loaded'
          ? {
              kind: 'loaded',
              lists: [...prev.lists, { ...created, uncheckedCount: 0, checkedCount: 0 }],
            }
          : prev,
      );
    } catch (caught) {
      if (!(caught instanceof UnauthenticatedError)) {
        setFormError(caught instanceof Error ? caught.message : 'Could not create the list.');
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(listId: string): Promise<void> {
    if (confirmingDelete !== listId) {
      setConfirmingDelete(listId);
      return;
    }
    setConfirmingDelete(null);
    // Optimistic removal with rollback on rejection (design.md — client half of LWW).
    const snapshot = state;
    setState((prev) =>
      prev.kind === 'loaded'
        ? { kind: 'loaded', lists: prev.lists.filter((l) => l.id !== listId) }
        : prev,
    );
    try {
      await deleteList(api, listId);
    } catch (caught) {
      if (!(caught instanceof UnauthenticatedError)) setState(snapshot);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} testID="lists-screen">
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.link}>← Dashboard</Text>
        </Pressable>
        <Text style={styles.title}>Shopping lists</Text>
      </View>

      <View style={styles.createRow}>
        <View style={styles.createField}>
          <Field
            label="New list"
            placeholder="Groceries"
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={() => void handleCreate()}
            error={formError ?? undefined}
          />
        </View>
        <Pressable
          style={[styles.button, creating && styles.buttonDisabled]}
          onPress={() => void handleCreate()}
          accessibilityRole="button"
          disabled={creating}
        >
          <Text style={styles.buttonText}>{creating ? 'Creating…' : 'Create'}</Text>
        </Pressable>
      </View>

      {state.kind === 'loading' ? (
        <View style={styles.centered} testID="lists-loading">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : state.kind === 'failed' ? (
        <View style={styles.errorCard} testID="lists-error">
          <Text style={styles.errorTitle}>Couldn&apos;t load your lists</Text>
          <Text style={styles.errorBody}>{state.message}</Text>
          <Pressable style={styles.retryButton} onPress={load} accessibilityRole="button">
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      ) : state.lists.length === 0 ? (
        <View style={styles.emptyCard} testID="lists-empty">
          <Text style={styles.emptyTitle}>No lists yet</Text>
          <Text style={styles.emptyBody}>
            Create your first list above — everyone in the family will see it.
          </Text>
        </View>
      ) : (
        <View style={styles.listRows}>
          {state.lists.map((list) => (
            <View key={list.id} style={styles.listRow}>
              <Pressable
                style={styles.listMain}
                onPress={() => onOpenList(list.id, list.name)}
                accessibilityRole="button"
              >
                <Text style={styles.listName}>{list.name}</Text>
                <Text style={styles.mutedText}>
                  {list.uncheckedCount} to buy · {list.checkedCount} in basket
                </Text>
              </Pressable>
              <Pressable onPress={() => void handleDelete(list.id)} accessibilityRole="button">
                <Text style={confirmingDelete === list.id ? styles.deleteArmed : styles.delete}>
                  {confirmingDelete === list.id ? 'Really delete?' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  header: { marginBottom: spacing.lg },
  link: { color: colors.primary, fontWeight: '600', marginBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },

  createRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  createField: { flex: 1 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginTop: 26,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontWeight: '600' },

  listRows: { gap: spacing.sm, marginTop: spacing.md },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  listMain: { flex: 1 },
  listName: { fontWeight: '700', color: colors.text, fontSize: 16 },
  mutedText: { color: colors.textMuted, marginTop: spacing.xs },
  delete: { color: colors.textMuted },
  deleteArmed: { color: colors.danger, fontWeight: '700' },

  emptyCard: {
    backgroundColor: colors.emptySurface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.empty, marginBottom: spacing.sm },
  emptyBody: { color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  errorCard: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: spacing.md,
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.danger, marginBottom: spacing.sm },
  errorBody: { color: colors.text, marginBottom: spacing.md },
  retryButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
});
