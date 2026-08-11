import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/lib/api';
import { loadCatalogCache, syncCatalog } from '@/lib/offline/catalogCache';
import { useNetwork } from '@/lib/offline/useNetwork';
import { KEYS, readJson, writeJson } from '@/lib/offline/storage';
import { fetchMobileSummary, type SummaryOutlet } from '@/lib/reports';
import { useAuthStore } from '@/store/auth.store';
import { useQueueStore } from '@/store/queue.store';
import { useVisitStore } from '@/store/visit.store';
import { colors, font, radius, spacing } from '@/theme';

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setOutlet = useVisitStore((s) => s.setOutlet);
  const reset = useVisitStore((s) => s.reset);
  const [search, setSearch] = useState('');

  const { online } = useNetwork();
  const pending = useQueueStore((s) => s.pending);
  const syncing = useQueueStore((s) => s.syncing);
  const flush = useQueueStore((s) => s.flush);

  // Last known summary from disk — declared before the query so it is always
  // initialised when the query renders.
  const [cachedSummary, setCachedSummary] = useState<
    Awaited<ReturnType<typeof fetchMobileSummary>> | null
  >(null);

  const summaryQ = useQuery({
    queryKey: ['mobile-summary'],
    queryFn: async () => {
      const data = await fetchMobileSummary();
      // Keep a copy so the store list still renders with no connectivity.
      await writeJson(KEYS.outlets, data);
      return data;
    },
    retry: 1,
  });

  // Restore cached data on mount, and refresh the barcode catalog when online.
  useEffect(() => {
    void (async () => {
      await loadCatalogCache();
      const stored =
        await readJson<Awaited<ReturnType<typeof fetchMobileSummary>>>(
          KEYS.outlets,
        );
      if (stored) setCachedSummary(stored);
    })();
  }, []);

  useEffect(() => {
    if (online) {
      // Refresh the offline barcode catalog in the background.
      void syncCatalog().catch(() => undefined);
    }
  }, [online]);

  const data = summaryQ.data ?? cachedSummary ?? undefined;

  function startVisit(outlet: SummaryOutlet) {
    reset();
    setOutlet({ id: outlet.id, name: outlet.name, regionName: outlet.regionName });
    router.push('/(app)/scan');
  }

  const sections = useMemo(() => {
    const all = data?.outlets ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? all.filter((o) => o.name.toLowerCase().includes(q))
      : all;
    const pending = filtered.filter((o) => !o.visitedToday);
    const done = filtered.filter((o) => o.visitedToday);
    const out: Array<{ title: string; done: boolean; data: SummaryOutlet[] }> = [];
    if (pending.length) out.push({ title: 'Stores to visit', done: false, data: pending });
    if (done.length) out.push({ title: 'Visited today', done: true, data: done });
    return out;
  }, [data?.outlets, search]);

  const assigned = data?.assignedCount ?? 0;
  const visited = data?.visitedCount ?? 0;
  const pct = assigned > 0 ? Math.round((visited / assigned) * 100) : 0;
  const allDone = assigned > 0 && visited >= assigned;

  if (summaryQ.isLoading && !data) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Only a hard error when we have nothing cached to show.
  if (summaryQ.isError && !data) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <Text style={styles.errorText}>
          {apiErrorMessage(summaryQ.error, 'Could not load your stores.')}
        </Text>
        <Pressable onPress={() => summaryQ.refetch()} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(o) => o.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={summaryQ.isFetching && !summaryQ.isLoading}
            onRefresh={() => summaryQ.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>
                Hi{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''} 👋
              </Text>
              <Pressable onPress={() => signOut()} hitSlop={10}>
                <Text style={styles.signOut}>Sign out</Text>
              </Pressable>
            </View>

            {!online && (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineText}>
                  No internet — you can keep scanning. Visits are saved on your
                  phone.
                </Text>
              </View>
            )}

            {pending.length > 0 && (
              <View style={styles.syncCard}>
                <View style={styles.flex}>
                  <Text style={styles.syncTitle}>
                    {pending.length} visit{pending.length > 1 ? 's' : ''} waiting
                    to send
                  </Text>
                  <Text style={styles.syncMeta}>
                    {online
                      ? 'Will send automatically.'
                      : 'They will send when you get internet.'}
                  </Text>
                </View>
                {syncing ? (
                  <ActivityIndicator color={colors.warning} />
                ) : (
                  online && (
                    <Pressable
                      onPress={() =>
                        void flush().then(({ sent }) => {
                          if (sent > 0) void summaryQ.refetch();
                        })
                      }
                      style={styles.syncBtn}
                    >
                      <Text style={styles.syncBtnText}>Send now</Text>
                    </Pressable>
                  )
                )}
              </View>
            )}

            {/* Today's progress */}
            <View style={[styles.card, allDone && styles.cardDone]}>
              <Text style={styles.cardLabel}>TODAY</Text>
              <Text style={styles.progressBig}>
                {visited} <Text style={styles.progressSmall}>of {assigned} stores</Text>
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%` },
                    allDone && { backgroundColor: colors.success },
                  ]}
                />
              </View>
              <Text style={styles.cardMeta}>
                {allDone
                  ? 'All stores visited today ✓'
                  : `${data?.itemsToday ?? 0} items counted today`}
              </Text>
            </View>

            {data?.lastVisit && (
              <Text style={styles.lastVisit}>
                Last: {data.lastVisit.outletName ?? 'Unknown store'} ·{' '}
                {data.lastVisit.itemCount} items ·{' '}
                {timeAgo(data.lastVisit.submittedAt)}
              </Text>
            )}

            {assigned === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No stores assigned yet</Text>
                <Text style={styles.emptyText}>
                  Ask your supervisor to assign your stores, then pull down to
                  refresh.
                </Text>
              </View>
            ) : (
              <TextInput
                style={styles.search}
                value={search}
                onChangeText={setSearch}
                placeholder="Search store name…"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
              />
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>
            {section.title} ({section.data.length})
          </Text>
        )}
        renderItem={({ item, section }) => (
          <Pressable
            style={({ pressed }) => [
              styles.outletRow,
              section.done && styles.outletRowDone,
              pressed && { backgroundColor: colors.primarySoft },
            ]}
            onPress={() => startVisit(item)}
          >
            <View style={styles.flex}>
              <Text
                style={[styles.outletName, section.done && styles.outletNameDone]}
              >
                {item.name}
              </Text>
              {item.regionName && (
                <Text style={styles.outletRegion}>{item.regionName}</Text>
              )}
            </View>
            {section.done ? (
              <Text style={styles.check}>✓</Text>
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          assigned > 0 ? (
            <Text style={styles.empty}>No stores match your search.</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingTop: spacing.md, paddingBottom: spacing.xl },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  signOut: { fontSize: font.label, fontWeight: '600', color: colors.danger },

  offlineBanner: {
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  offlineText: {
    color: '#7A5200',
    fontSize: font.small,
    fontWeight: '600',
    lineHeight: 20,
  },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  syncTitle: { fontSize: font.label, fontWeight: '800', color: colors.text },
  syncMeta: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  syncBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
  syncBtnText: { color: colors.white, fontWeight: '700', fontSize: font.small },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  cardDone: { borderColor: colors.success, backgroundColor: colors.successSoft },
  cardLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  progressBig: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
  },
  progressSmall: { fontSize: font.body, fontWeight: '600', color: colors.textMuted },
  barTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: { height: '100%', backgroundColor: colors.primary },
  cardMeta: {
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  lastVisit: {
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
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
    marginTop: spacing.lg,
  },

  sectionHeader: {
    fontSize: font.small,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
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
    minHeight: font.tapTarget,
  },
  outletRowDone: { opacity: 0.65, borderColor: colors.success },
  outletName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  outletNameDone: { color: colors.textMuted },
  outletRegion: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 28, color: colors.textMuted, marginLeft: spacing.sm },
  check: {
    fontSize: 22,
    color: colors.success,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },

  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  emptyTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  emptyText: {
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
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
