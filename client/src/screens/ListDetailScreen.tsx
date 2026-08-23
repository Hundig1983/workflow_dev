import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UnauthenticatedError } from '../api/client';
import { useAuth } from '../auth/context';
import {
  addItem,
  checkItem,
  clearList,
  deleteItem,
  editItem,
  fetchListDetail,
  uncheckItem,
} from '../shopping/api';
import type { ListDetail, ShoppingItem } from '../shopping/types';
import { Field } from '../ui/Field';
import { colors, radius, spacing } from '../ui/theme';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; detail: ListDetail }
  | { kind: 'failed'; message: string };

interface ListDetailScreenProps {
  listId: string;
  listName: string;
  onBack: () => void;
}

/**
 * Optimistic UI with rollback (design.md): every mutation updates local state first,
 * reconciles with the server response, and restores the snapshot if the server
 * rejects. No client-side conflict detection — the decided LWW semantics absorb
 * concurrent writes server-side.
 */
export function ListDetailScreen({
  listId,
  listName,
  onBack,
}: ListDetailScreenProps): React.JSX.Element {
  const { api } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [newItem, setNewItem] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editNote, setEditNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'loaded', detail: await fetchListDetail(api, listId) });
    } catch (caught) {
      if (caught instanceof UnauthenticatedError) return;
      setState({
        kind: 'failed',
        message: caught instanceof Error ? caught.message : 'Could not load this list.',
      });
    }
  }, [api, listId]);

  useEffect(() => {
    void load();
  }, [load]);

  function mutate(update: (detail: ListDetail) => ListDetail): LoadState {
    const snapshot = state;
    setState((prev) =>
      prev.kind === 'loaded' ? { kind: 'loaded', detail: update(prev.detail) } : prev,
    );
    return snapshot;
  }

  function rollbackOn(caught: unknown, snapshot: LoadState): void {
    if (caught instanceof UnauthenticatedError) return;
    setState(snapshot);
    setActionError(caught instanceof Error ? caught.message : 'That change did not go through.');
  }

  async function handleAdd(): Promise<void> {
    const name = newItem.trim();
    if (name === '' || adding) return;
    setAdding(true);
    setFormError(null);
    try {
      const quantity = newQuantity.trim();
      const created = await addItem(api, listId, quantity ? { name, quantity } : { name });
      setNewItem('');
      setNewQuantity('');
      mutate((d) => ({ ...d, unchecked: [...d.unchecked, created] }));
    } catch (caught) {
      if (!(caught instanceof UnauthenticatedError)) {
        setFormError(caught instanceof Error ? caught.message : 'Could not add the item.');
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleCheck(item: ShoppingItem): Promise<void> {
    setActionError(null);
    const snapshot = mutate((d) => ({
      ...d,
      unchecked: d.unchecked.filter((i) => i.id !== item.id),
      checked: [...d.checked, { ...item, checkedAt: new Date().toISOString() }],
    }));
    try {
      const server = await checkItem(api, listId, item.id);
      mutate((d) => ({
        ...d,
        checked: d.checked.map((i) => (i.id === server.id ? server : i)),
      }));
    } catch (caught) {
      rollbackOn(caught, snapshot);
    }
  }

  async function handleUncheck(item: ShoppingItem): Promise<void> {
    setActionError(null);
    const snapshot = mutate((d) => ({
      ...d,
      checked: d.checked.filter((i) => i.id !== item.id),
      unchecked: [...d.unchecked, { ...item, checkedAt: null, checkedBy: null }],
    }));
    try {
      const server = await uncheckItem(api, listId, item.id);
      mutate((d) => ({
        ...d,
        unchecked: d.unchecked.map((i) => (i.id === server.id ? server : i)),
      }));
    } catch (caught) {
      rollbackOn(caught, snapshot);
    }
  }

  async function handleDelete(item: ShoppingItem): Promise<void> {
    setActionError(null);
    const snapshot = mutate((d) => ({
      ...d,
      unchecked: d.unchecked.filter((i) => i.id !== item.id),
      checked: d.checked.filter((i) => i.id !== item.id),
    }));
    try {
      await deleteItem(api, listId, item.id);
    } catch (caught) {
      rollbackOn(caught, snapshot);
    }
  }

  async function handleClear(): Promise<void> {
    setActionError(null);
    const snapshot = mutate((d) => ({ ...d, checked: [] }));
    try {
      await clearList(api, listId);
    } catch (caught) {
      rollbackOn(caught, snapshot);
    }
  }

  function startEdit(item: ShoppingItem): void {
    setEditing(item);
    setEditName(item.name);
    setEditQuantity(item.quantity ?? '');
    setEditNote(item.note ?? '');
  }

  async function handleSaveEdit(): Promise<void> {
    if (!editing) return;
    const target = editing;
    setEditing(null);
    setActionError(null);
    const name = editName.trim();
    const patch = {
      ...(name !== '' && name !== target.name ? { name } : {}),
      quantity: editQuantity.trim() === '' ? null : editQuantity.trim(),
      note: editNote.trim() === '' ? null : editNote.trim(),
    };
    const apply = (i: ShoppingItem): ShoppingItem =>
      i.id === target.id
        ? { ...i, name: name || i.name, quantity: patch.quantity, note: patch.note }
        : i;
    const snapshot = mutate((d) => ({
      ...d,
      unchecked: d.unchecked.map(apply),
      checked: d.checked.map(apply),
    }));
    try {
      const server = await editItem(api, listId, target.id, patch);
      const reconcile = (i: ShoppingItem): ShoppingItem => (i.id === server.id ? server : i);
      mutate((d) => ({
        ...d,
        unchecked: d.unchecked.map(reconcile),
        checked: d.checked.map(reconcile),
      }));
    } catch (caught) {
      rollbackOn(caught, snapshot);
    }
  }

  if (state.kind === 'loading') {
    return (
      <View style={styles.centered} testID="list-loading">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (state.kind === 'failed') {
    return (
      <View style={styles.centered} testID="list-error">
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Couldn&apos;t load this list</Text>
          <Text style={styles.errorBody}>{state.message}</Text>
          <Pressable style={styles.retryButton} onPress={load} accessibilityRole="button">
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.link}>← Back to lists</Text>
        </Pressable>
      </View>
    );
  }

  const { detail } = state;

  return (
    <ScrollView contentContainerStyle={styles.page} testID="list-detail">
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.link}>← Lists</Text>
        </Pressable>
        <Text style={styles.title}>{detail.list.name || listName}</Text>
      </View>

      <View style={styles.createRow}>
        <View style={styles.createField}>
          <Field
            label="Add an item"
            placeholder="Milk"
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={() => void handleAdd()}
            error={formError ?? undefined}
          />
        </View>
        <View style={styles.qtyField}>
          <Field label="Qty" placeholder="2L" value={newQuantity} onChangeText={setNewQuantity} />
        </View>
        <Pressable
          style={[styles.button, adding && styles.buttonDisabled]}
          onPress={() => void handleAdd()}
          accessibilityRole="button"
          disabled={adding}
        >
          <Text style={styles.buttonText}>{adding ? 'Adding…' : 'Add'}</Text>
        </Pressable>
      </View>

      {actionError ? (
        <Text style={styles.actionError} accessibilityLiveRegion="polite">
          {actionError}
        </Text>
      ) : null}

      {editing ? (
        <View style={styles.editCard} testID="item-edit">
          <Field label="Name" value={editName} onChangeText={setEditName} />
          <Field label="Quantity" value={editQuantity} onChangeText={setEditQuantity} />
          <Field label="Note" value={editNote} onChangeText={setEditNote} />
          <View style={styles.editActions}>
            <Pressable
              style={styles.button}
              onPress={() => void handleSaveEdit()}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(null)} accessibilityRole="button">
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.group} testID="unchecked-group">
        <Text style={styles.groupTitle}>To buy ({detail.unchecked.length})</Text>
        {detail.unchecked.length === 0 ? (
          <Text style={styles.mutedText}>Nothing to buy — add something above.</Text>
        ) : (
          detail.unchecked.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Pressable
                style={styles.itemMain}
                onPress={() => void handleCheck(item)}
                accessibilityRole="button"
                accessibilityLabel={`Check off ${item.name}`}
              >
                <Text style={styles.checkbox}>☐</Text>
                <View style={styles.itemText}>
                  <Text style={styles.itemName}>
                    {item.name}
                    {item.quantity ? (
                      <Text style={styles.mutedText}> · {item.quantity}</Text>
                    ) : null}
                  </Text>
                  {item.note ? <Text style={styles.mutedText}>{item.note}</Text> : null}
                </View>
              </Pressable>
              <Pressable onPress={() => startEdit(item)} accessibilityRole="button">
                <Text style={styles.link}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => void handleDelete(item)} accessibilityRole="button">
                <Text style={styles.delete}>✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Checked items stay visible, grouped apart, until an explicit clear (spec). */}
      <View style={[styles.group, styles.checkedGroup]} testID="checked-group">
        <View style={styles.checkedHeader}>
          <Text style={styles.groupTitle}>In the basket ({detail.checked.length})</Text>
          {detail.checked.length > 0 ? (
            <Pressable onPress={() => void handleClear()} accessibilityRole="button">
              <Text style={styles.clearText}>Clear checked</Text>
            </Pressable>
          ) : null}
        </View>
        {detail.checked.length === 0 ? (
          <Text style={styles.mutedText}>Checked items collect here until you clear them.</Text>
        ) : (
          detail.checked.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Pressable
                style={styles.itemMain}
                onPress={() => void handleUncheck(item)}
                accessibilityRole="button"
                accessibilityLabel={`Uncheck ${item.name}`}
              >
                <Text style={styles.checkbox}>☑</Text>
                <View style={styles.itemText}>
                  <Text style={[styles.itemName, styles.checkedName]}>
                    {item.name}
                    {item.quantity ? (
                      <Text style={styles.mutedText}> · {item.quantity}</Text>
                    ) : null}
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => void handleDelete(item)} accessibilityRole="button">
                <Text style={styles.delete}>✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  header: { marginBottom: spacing.md },
  link: { color: colors.primary, fontWeight: '600', marginBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },

  createRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  createField: { flex: 1 },
  qtyField: { width: 90 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginTop: 26,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontWeight: '600' },
  actionError: { color: colors.danger, marginBottom: spacing.sm },

  editCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },

  group: { marginTop: spacing.lg },
  groupTitle: { fontWeight: '700', color: colors.text, marginBottom: spacing.sm, fontSize: 16 },
  checkedGroup: {
    backgroundColor: colors.emptySurface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  checkedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearText: { color: colors.danger, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { fontSize: 18, color: colors.primary },
  itemText: { flex: 1 },
  itemName: { color: colors.text, fontSize: 16 },
  checkedName: { textDecorationLine: 'line-through', color: colors.textMuted },
  mutedText: { color: colors.textMuted },
  delete: { color: colors.textMuted, fontSize: 16, paddingHorizontal: spacing.xs },

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
  errorBody: { color: colors.text, marginBottom: spacing.md },
  retryButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
});
