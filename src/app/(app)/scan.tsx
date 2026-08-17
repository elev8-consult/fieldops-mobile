import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { ItemEntrySheet, type NewItem } from '@/components/ItemEntrySheet';
import { apiErrorMessage } from '@/lib/api';
import { resolveBarcode, type Product } from '@/lib/catalog';
import { submitVisit } from '@/lib/reports';
import { useQueueStore } from '@/store/queue.store';
import { useVisitStore } from '@/store/visit.store';
import { colors, font, radius, spacing } from '@/theme';

const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
] as const;

/** True when the request never reached the server (no connectivity). */
function isOffline(err: unknown): boolean {
  return (
    axios.isAxiosError(err) &&
    (!err.response || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK')
  );
}

export default function ScanScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const enqueue = useQueueStore((s) => s.enqueue);
  const outlet = useVisitStore((s) => s.outlet);
  const items = useVisitStore((s) => s.items);
  const addItem = useVisitStore((s) => s.addItem);
  const removeItem = useVisitStore((s) => s.removeItem);
  const reset = useVisitStore((s) => s.reset);

  const [permission, requestPermission] = useCameraPermissions();
  const [looking, setLooking] = useState(false);
  const [entry, setEntry] = useState<{
    barcode: string;
    product: Product | null;
  } | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  async function handleScan(res: BarcodeScanningResult) {
    if (looking || entry) return;
    const code = res.data?.trim();
    if (!code) return;
    // Ignore the same barcode re-read within 2.5s.
    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.code === code &&
      now - lastScanRef.current.at < 2500
    ) {
      return;
    }
    lastScanRef.current = { code, at: now };

    setLooking(true);
    try {
      // Checks the offline cache first, then the server.
      const { product } = await resolveBarcode(code);
      setEntry({ barcode: code, product });
    } catch (e) {
      Alert.alert('Lookup failed', apiErrorMessage(e));
    } finally {
      setLooking(false);
    }
  }

  function handleAdd(item: NewItem) {
    addItem({
      productId: item.productId,
      barcode: item.barcode,
      productName: item.productName,
      quantity: item.quantity,
      expiryDate: item.expiryDate,
    });
    setEntry(null);
  }

  const submit = useMutation({
    mutationFn: async (): Promise<{ queued: boolean }> => {
      const payload = {
        outletId: outlet!.id,
        items: items.map((i) => ({
          productId: i.productId,
          barcode: i.barcode,
          productNameRaw: i.productName,
          quantity: i.quantity,
          expiryDate: i.expiryDate,
        })),
      };

      try {
        await submitVisit(payload);
        return { queued: false };
      } catch (err) {
        // No network / server unreachable → keep the work safely on the device
        // and let the sync engine deliver it once we are back online.
        if (isOffline(err)) {
          await enqueue({
            outletId: payload.outletId,
            outletName: outlet!.name,
            items: payload.items,
          });
          return { queued: true };
        }
        throw err;
      }
    },
    onSuccess: ({ queued }) => {
      // Refresh the home screen's progress and "visited today" list.
      void qc.invalidateQueries({ queryKey: ['mobile-summary'] });
      Alert.alert(
        queued ? 'Saved on your phone' : 'Visit submitted',
        queued
          ? `${items.length} item(s) saved. They will be sent automatically when you have internet.`
          : `${items.length} item(s) saved.`,
        [
          {
            text: 'OK',
            onPress: () => {
              reset();
              router.replace('/(app)/home');
            },
          },
        ],
      );
    },
    onError: (e) => Alert.alert('Submit failed', apiErrorMessage(e)),
  });

  function confirmSubmit() {
    if (items.length === 0) return;
    Alert.alert(
      'Submit visit?',
      `Send ${items.length} item(s) for ${outlet?.name ?? 'this outlet'}?`,
      [
        { text: 'Keep scanning', style: 'cancel' },
        { text: 'Submit', onPress: () => submit.mutate() },
      ],
    );
  }

  // ── Camera permission states ─────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: spacing.lg }]}>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permText}>
          I Prom uses the camera to scan product barcodes.
        </Text>
        <View style={{ height: spacing.lg }} />
        <Button label="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText} numberOfLines={1}>
          📍 {outlet?.name ?? 'No outlet selected'}
        </Text>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={entry || looking ? undefined : handleScan}
        />
        <View style={styles.frame} pointerEvents="none" />
        <View style={styles.scanHintWrap} pointerEvents="none">
          <Text style={styles.scanHint}>
            {looking ? 'Looking up product…' : 'Point at a barcode'}
          </Text>
        </View>
      </View>

      <View style={styles.listSection}>
        <Text style={styles.listTitle}>Items added ({items.length})</Text>
        <FlatList
          data={items}
          keyExtractor={(i) => i.key}
          contentContainerStyle={{ paddingBottom: spacing.md }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Scan a product to add it to this visit.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <View style={styles.flex}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.productName}
                  {item.productId ? '' : '  (manual)'}
                </Text>
                <Text style={styles.itemMeta}>
                  Qty {item.quantity}
                  {item.expiryDate ? `  ·  exp ${item.expiryDate.slice(0, 7)}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => removeItem(item.key)}
                hitSlop={10}
                style={styles.removeBtn}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      </View>

      <View style={styles.footer}>
        <Button
          label={
            items.length > 0 ? `Submit visit (${items.length})` : 'Submit visit'
          }
          onPress={confirmSubmit}
          disabled={items.length === 0}
          loading={submit.isPending}
        />
      </View>

      <ItemEntrySheet
        visible={entry !== null}
        barcode={entry?.barcode ?? null}
        product={entry?.product ?? null}
        onCancel={() => setEntry(null)}
        onAdd={handleAdd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  flex: { flex: 1 },
  banner: {
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bannerText: { color: colors.white, fontSize: font.label, fontWeight: '700' },
  cameraWrap: {
    height: 300,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  frame: {
    position: 'absolute',
    top: '25%',
    left: '12%',
    right: '12%',
    bottom: '25%',
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: radius.md,
  },
  scanHintWrap: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanHint: {
    color: colors.white,
    backgroundColor: 'rgba(0,0,0,0.55)',
    fontSize: font.label,
    fontWeight: '600',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  listSection: { flex: 1, padding: spacing.lg },
  listTitle: {
    fontSize: font.label,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  empty: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  itemName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  removeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontSize: 20, color: colors.danger, fontWeight: '700' },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  permTitle: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  permText: {
    fontSize: font.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
