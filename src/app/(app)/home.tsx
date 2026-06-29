import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/lib/api';
import { fetchOutlets, type Outlet } from '@/lib/catalog';
import { useAuthStore } from '@/store/auth.store';
import { useVisitStore } from '@/store/visit.store';
import { colors, font, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setOutlet = useVisitStore((s) => s.setOutlet);
  const reset = useVisitStore((s) => s.reset);
  const [search, setSearch] = useState('');

  const outletsQ = useQuery({
    queryKey: ['outlets', search],
    queryFn: () => fetchOutlets(search.trim() || undefined),
  });

  function startVisit(outlet: Outlet) {
    reset();
    setOutlet(outlet);
    router.push('/(app)/scan');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.greetingRow}>
        <Text style={styles.greeting}>
          Hi{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''} 👋
        </Text>
        <Pressable onPress={() => signOut()} hitSlop={10}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={styles.prompt}>Which outlet are you visiting?</Text>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search outlet name…"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
      />

      {outletsQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : outletsQ.isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {apiErrorMessage(outletsQ.error, 'Could not load outlets.')}
          </Text>
          <Pressable onPress={() => outletsQ.refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={outletsQ.data ?? []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>No outlets found.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.outletRow,
                pressed && { backgroundColor: colors.primarySoft },
              ]}
              onPress={() => startVisit(item)}
            >
              <View style={styles.flex}>
                <Text style={styles.outletName}>{item.name}</Text>
                {item.regionName && (
                  <Text style={styles.outletRegion}>{item.regionName}</Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  flex: { flex: 1 },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  signOut: { fontSize: font.label, fontWeight: '600', color: colors.danger },
  prompt: {
    fontSize: font.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  search: {
    minHeight: font.tapTarget,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: font.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: spacing.xl },
  outletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  outletName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  outletRegion: {
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevron: { fontSize: 28, color: colors.textMuted, marginLeft: spacing.sm },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: font.body,
    marginTop: spacing.xl,
  },
  errorText: {
    color: colors.danger,
    fontSize: font.body,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retry: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.white, fontWeight: '700', fontSize: font.label },
});
