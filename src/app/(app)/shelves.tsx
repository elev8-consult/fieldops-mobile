import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { searchCatalogBrands } from '@/lib/offline/catalogCache';
import { useNetwork } from '@/lib/offline/useNetwork';
import type { ShelfKind } from '@/lib/shelfPhotos';
import {
  useShelfStore,
  type ShelfBrand,
  type ShelfShot,
} from '@/store/shelf.store';
import { useVisitStore } from '@/store/visit.store';
import { colors, font, radius, spacing } from '@/theme';

export default function ShelvesScreen() {
  const outlet = useVisitStore((s) => s.outlet);
  const items = useVisitStore((s) => s.items);
  const photos = useShelfStore((s) => s.photos);
  const extraBrands = useShelfStore((s) => s.extraBrands);
  const shelves = useShelfStore((s) => s.shelves);
  const ready = useShelfStore((s) => s.ready);
  const load = useShelfStore((s) => s.load);
  const pinBrand = useShelfStore((s) => s.pinBrand);
  const ensureShelves = useShelfStore((s) => s.ensureShelves);
  const addShelf = useShelfStore((s) => s.addShelf);
  const removeShelf = useShelfStore((s) => s.removeShelf);
  const saveShot = useShelfStore((s) => s.saveShot);
  const removeShot = useShelfStore((s) => s.removeShot);
  const flush = useShelfStore((s) => s.flush);
  const { online } = useNetwork();
  const [query, setQuery] = useState('');
  const [capture, setCapture] = useState<{
    brand: ShelfBrand;
    shelfId: string;
    shelfLabel: string;
    kind: ShelfKind;
  } | null>(null);

  useEffect(() => {
    if (outlet?.id) void load(outlet.id);
  }, [outlet?.id, load]);

  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  const brands = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.brandId) map.set(item.brandId, item.brandName || 'Brand');
    }
    for (const brand of extraBrands) map.set(brand.id, brand.name);
    for (const photo of photos) map.set(photo.brandId, photo.brandName);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, extraBrands, photos]);

  useEffect(() => {
    if (!ready) return;
    ensureShelves(brands.map((brand) => brand.id));
  }, [ready, brands, ensureShelves]);

  const matches = useMemo(() => searchCatalogBrands(query), [query]);

  function shotFor(
    brandId: string,
    shelfId: string,
    kind: ShelfKind,
  ): ShelfShot | undefined {
    return photos.find(
      (p) => p.brandId === brandId && p.shelfId === shelfId && p.kind === kind,
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.help}>
        Each brand can have several shelves. Take the before, keep scanning,
        then take the after. Add a shelf when the same brand has another one
        in this store.
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Find a brand"
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        style={styles.search}
      />
      {matches.length > 0 && (
        <View style={styles.matches}>
          {matches.map((brand) => (
            <Pressable
              key={brand.id}
              style={styles.match}
              onPress={() => {
                pinBrand(brand);
                setQuery('');
              }}
            >
              <Text style={styles.matchText}>{brand.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={brands}
        keyExtractor={(brand) => brand.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Scan a product, or search its brand, to photograph that shelf.
          </Text>
        }
        renderItem={({ item: brand }) => {
          const units = shelves.filter((shelf) => shelf.brandId === brand.id);
          return (
            <View style={styles.card}>
              <Text style={styles.brand}>{brand.name}</Text>
              {units.map((shelf, index) => {
                const shelfLabel = `Shelf ${index + 1}`;
                return (
                  <View key={shelf.shelfId} style={styles.shelf}>
                    <View style={styles.shelfHead}>
                      <Text style={styles.shelfLabel}>{shelfLabel}</Text>
                      {units.length > 1 ? (
                        <Pressable
                          hitSlop={8}
                          onPress={() => {
                            if (!outlet) return;
                            Alert.alert(
                              `Remove ${shelfLabel}?`,
                              'Its before and after photos will be removed.',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Remove',
                                  style: 'destructive',
                                  onPress: () => {
                                    void removeShelf({
                                      outletId: outlet.id,
                                      brandId: brand.id,
                                      shelfId: shelf.shelfId,
                                    });
                                  },
                                },
                              ],
                            );
                          }}
                        >
                          <Text style={styles.removeShelf}>Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={styles.slots}>
                      <Slot
                        label="Before"
                        shot={shotFor(brand.id, shelf.shelfId, 'before')}
                        onPress={() =>
                          setCapture({
                            brand,
                            shelfId: shelf.shelfId,
                            shelfLabel,
                            kind: 'before',
                          })
                        }
                        onRemove={() => {
                          if (!outlet) return;
                          void removeShot({
                            outletId: outlet.id,
                            brandId: brand.id,
                            shelfId: shelf.shelfId,
                            kind: 'before',
                          });
                        }}
                      />
                      <Slot
                        label="After"
                        shot={shotFor(brand.id, shelf.shelfId, 'after')}
                        onPress={() =>
                          setCapture({
                            brand,
                            shelfId: shelf.shelfId,
                            shelfLabel,
                            kind: 'after',
                          })
                        }
                        onRemove={() => {
                          if (!outlet) return;
                          void removeShot({
                            outletId: outlet.id,
                            brandId: brand.id,
                            shelfId: shelf.shelfId,
                            kind: 'after',
                          });
                        }}
                      />
                    </View>
                  </View>
                );
              })}
              <Pressable
                style={styles.addShelf}
                onPress={() => addShelf(brand.id)}
              >
                <Text style={styles.addShelfText}>Add shelf</Text>
              </Pressable>
            </View>
          );
        }}
      />

      {capture && outlet && (
        <PhotoCapture
          brandName={capture.brand.name}
          shelfLabel={capture.shelfLabel}
          kind={capture.kind}
          onClose={() => setCapture(null)}
          onShot={async (tempUri) => {
            const taken = capture;
            setCapture(null);
            try {
              await saveShot({
                outletId: outlet.id,
                brandId: taken.brand.id,
                brandName: taken.brand.name,
                shelfId: taken.shelfId,
                kind: taken.kind,
                tempUri,
              });
            } catch (err) {
              Alert.alert(
                'Could not keep this photo',
                err instanceof Error ? err.message : 'Try the photo again.',
              );
            }
          }}
        />
      )}
    </View>
  );
}

function Slot({
  label,
  shot,
  onPress,
  onRemove,
}: {
  label: string;
  shot: ShelfShot | undefined;
  onPress: () => void;
  onRemove: () => void;
}) {
  const uri = shot?.localUri || shot?.remoteUrl;
  return (
    <View style={styles.slot}>
      <View>
        <Pressable onPress={onPress}>
          {uri ? (
            <Image
              key={uri}
              recyclingKey={uri}
              source={{ uri }}
              style={styles.photo}
              contentFit="cover"
            />
          ) : (
            <View style={styles.slotEmpty}>
              <Text style={styles.slotPlus}>+</Text>
            </View>
          )}
        </Pressable>
        {uri ? (
          <Pressable
            style={styles.photoX}
            hitSlop={8}
            onPress={() =>
              Alert.alert(label, 'Retake this photo or remove it?', [
                { text: 'Retake', onPress },
                { text: 'Remove', style: 'destructive', onPress: onRemove },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
          >
            <Text style={styles.photoXText}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.slotLabel}>{label}</Text>
      <Text style={styles.slotHint}>
        {uri
          ? shot?.uploaded
            ? 'Tap to retake'
            : 'Saved on this phone'
          : 'Take photo'}
      </Text>
    </View>
  );
}

type ZoomPreset = '0.5' | '1' | '2';

function pickLens(lenses: string[], ...parts: string[]): string | undefined {
  const lower = lenses.map((l) => ({ raw: l, key: l.toLowerCase() }));
  for (const part of parts) {
    const hit = lower.find((l) => l.key.includes(part.toLowerCase()));
    if (hit) return hit.raw;
  }
  return undefined;
}

function cameraSettings(
  preset: ZoomPreset,
  lenses: string[],
): { zoom: number; selectedLens?: string } {
  if (Platform.OS === 'ios') {
    const ultra = pickLens(lenses, 'ultrawide', 'ultra wide');
    const wide =
      pickLens(lenses, 'wideangle', 'wide angle', 'wide') ??
      'builtInWideAngleCamera';
    const tele = pickLens(lenses, 'telephoto', 'tele');
    if (preset === '0.5' && ultra) return { zoom: 0, selectedLens: ultra };
    if (preset === '2' && tele) return { zoom: 0, selectedLens: tele };
    // No matching lens → digital zoom on the wide camera.
    return {
      zoom: preset === '2' ? 0.35 : preset === '0.5' ? 0 : 0,
      selectedLens: wide,
    };
  }
  // Android: Expo exposes digital zoom 0–1 on the main back camera.
  return {
    zoom: preset === '2' ? 0.45 : preset === '1' ? 0.08 : 0,
  };
}

function PhotoCapture({
  brandName,
  shelfLabel,
  kind,
  onClose,
  onShot,
}: {
  brandName: string;
  shelfLabel: string;
  kind: ShelfKind;
  onClose: () => void;
  onShot: (uri: string) => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<ZoomPreset>('1');
  const [lenses, setLenses] = useState<string[]>([]);
  const { zoom, selectedLens } = cameraSettings(preset, lenses);

  async function shoot() {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.4,
      });
      if (picture?.uri) onShot(picture.uri);
      else onClose();
    } catch {
      Alert.alert('Could not take the photo', 'Try again.');
      setBusy(false);
    }
  }

  return (
    <View style={styles.capture}>
      {!permission?.granted ? (
        <View style={styles.captureCenter}>
          <Text style={styles.captureTitle}>Camera access needed</Text>
          <Pressable style={styles.allowBtn} onPress={requestPermission}>
            <Text style={styles.allow}>Allow camera</Text>
          </Pressable>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          autofocus="off"
          zoom={zoom}
          {...(selectedLens ? { selectedLens } : {})}
          onAvailableLensesChanged={({ lenses: next }) => setLenses(next)}
        />
      )}
      <View style={styles.captureTop}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.captureTitle} numberOfLines={1}>
          {brandName} · {shelfLabel} · {kind === 'before' ? 'Before' : 'After'}
        </Text>
      </View>
      {permission?.granted && (
        <>
          <View style={styles.zoomRow}>
            {(['0.5', '1', '2'] as const).map((level) => {
              const active = preset === level;
              return (
                <Pressable
                  key={level}
                  style={[styles.zoomBtn, active && styles.zoomBtnActive]}
                  onPress={() => setPreset(level)}
                  disabled={busy}
                >
                  <Text
                    style={[styles.zoomText, active && styles.zoomTextActive]}
                  >
                    {level}x
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={styles.shutter}
            onPress={() => void shoot()}
            disabled={busy}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  help: {
    color: colors.textMuted,
    fontSize: font.small,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  search: {
    minHeight: font.tapTarget,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: font.body,
    color: colors.text,
  },
  matches: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  match: {
    minHeight: font.tapTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  matchText: { fontSize: font.body, fontWeight: '700', color: colors.text },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  empty: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  brand: {
    fontSize: font.body,
    fontWeight: '800',
    color: colors.text,
  },
  shelf: { marginTop: spacing.md },
  shelfHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  shelfLabel: {
    fontSize: font.label,
    fontWeight: '800',
    color: colors.text,
  },
  removeShelf: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.danger,
  },
  addShelf: {
    minHeight: font.tapTarget,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  addShelfText: {
    fontSize: font.label,
    fontWeight: '800',
    color: colors.primary,
  },
  slots: { flexDirection: 'row', gap: spacing.sm },
  slot: { flex: 1 },
  photo: {
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  photoX: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(22,32,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoXText: {
    color: colors.white,
    fontSize: font.label,
    fontWeight: '800',
    lineHeight: 18,
  },
  slotEmpty: {
    height: 140,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPlus: { fontSize: 36, color: colors.primary, fontWeight: '600' },
  slotLabel: {
    marginTop: spacing.xs,
    fontSize: font.label,
    fontWeight: '800',
    color: colors.text,
  },
  slotHint: { fontSize: font.small, color: colors.textMuted },
  capture: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
    zIndex: 10,
  },
  captureCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  captureTop: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cancel: { color: colors.white, fontSize: font.label, fontWeight: '700' },
  captureTitle: {
    flex: 1,
    color: colors.white,
    fontSize: font.label,
    fontWeight: '800',
  },
  allowBtn: {
    marginTop: spacing.lg,
    minHeight: font.tapTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allow: { color: colors.text, fontSize: font.label, fontWeight: '800' },
  zoomRow: {
    position: 'absolute',
    bottom: spacing.xl + 96,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.pill,
    padding: 4,
  },
  zoomBtn: {
    minWidth: 52,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnActive: { backgroundColor: colors.white },
  zoomText: {
    color: colors.white,
    fontSize: font.label,
    fontWeight: '800',
  },
  zoomTextActive: { color: colors.text },
  shutter: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.white,
  },
});
