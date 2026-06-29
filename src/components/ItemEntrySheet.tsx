import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Product } from '@/lib/catalog';
import { colors, font, radius, spacing } from '@/theme';
import { Button } from './Button';

export interface NewItem {
  productId: string | null;
  barcode: string | null;
  productName: string;
  quantity: number;
  expiryDate: string | null;
}

interface Props {
  visible: boolean;
  barcode: string | null;
  /** The matched catalog product, or null if the barcode is unknown. */
  product: Product | null;
  onCancel: () => void;
  onAdd: (item: NewItem) => void;
}

export function ItemEntrySheet({
  visible,
  barcode,
  product,
  onCancel,
  onAdd,
}: Props) {
  const isUnknown = !product;
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  // Reset fields each time the sheet opens for a new scan.
  useEffect(() => {
    if (visible) {
      setName(product?.canonicalName ?? '');
      setQty('');
      setMonth('');
      setYear('');
    }
  }, [visible, product]);

  const quantity = parseInt(qty, 10);
  const qtyValid = Number.isFinite(quantity) && quantity > 0;
  const nameValid = isUnknown ? name.trim().length > 0 : true;

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  const expiryStarted = month.length > 0 || year.length > 0;
  const expiryValid =
    !expiryStarted ||
    (monthNum >= 1 &&
      monthNum <= 12 &&
      yearNum >= 2024 &&
      yearNum <= 2099);

  const canAdd = qtyValid && nameValid && expiryValid;

  function handleAdd() {
    const expiryDate =
      expiryStarted && expiryValid
        ? `${yearNum}-${String(monthNum).padStart(2, '0')}-01`
        : null;
    onAdd({
      productId: product?.id ?? null,
      barcode,
      productName: isUnknown ? name.trim() : product!.canonicalName,
      quantity,
      expiryDate,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {isUnknown ? (
                <>
                  <Text style={styles.unknownTag}>Not in catalog</Text>
                  <Text style={styles.barcode}>Barcode: {barcode}</Text>
                  <Text style={styles.label}>Product name</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Type the product name"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                </>
              ) : (
                <>
                  <Text style={styles.productName}>
                    {product!.canonicalName}
                  </Text>
                  {product!.brandName && (
                    <Text style={styles.brand}>{product!.brandName}</Text>
                  )}
                </>
              )}

              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={qty}
                onChangeText={(t) => setQty(t.replace(/\D/g, ''))}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                autoFocus={!isUnknown}
              />

              <Text style={styles.label}>Expiry (optional)</Text>
              <View style={styles.expiryRow}>
                <TextInput
                  style={[styles.input, styles.expiryField]}
                  value={month}
                  onChangeText={(t) => setMonth(t.replace(/\D/g, ''))}
                  placeholder="MM"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TextInput
                  style={[styles.input, styles.expiryField]}
                  value={year}
                  onChangeText={(t) => setYear(t.replace(/\D/g, ''))}
                  placeholder="YYYY"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              {!expiryValid && (
                <Text style={styles.hint}>
                  Enter a valid month (1–12) and year.
                </Text>
              )}

              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={onCancel}
                  />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={styles.flex}>
                  <Button
                    label="Add item"
                    variant="success"
                    onPress={handleAdd}
                    disabled={!canAdd}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  flex: { flex: 1 },
  unknownTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontWeight: '700',
    fontSize: font.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barcode: {
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  productName: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  brand: { fontSize: font.body, color: colors.textMuted, marginTop: 2 },
  label: {
    fontSize: font.label,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: font.tapTarget,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: font.h2,
    color: colors.text,
  },
  expiryRow: { flexDirection: 'row', gap: spacing.md },
  expiryField: { flex: 1 },
  hint: { color: colors.danger, fontSize: font.small, marginTop: spacing.sm },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
});
