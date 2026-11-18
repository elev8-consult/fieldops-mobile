import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import {
  deleteShelfPhoto,
  fetchTodayShelfPhotos,
  updateShelfPhotoNotes,
  uploadShelfPhoto,
  type ShelfKind,
} from '@/lib/shelfPhotos';
import { isOnline } from '@/lib/offline/network';
import { KEYS, readJson, writeJson } from '@/lib/offline/storage';
import { beirutToday } from '@/lib/offline/visitCache';

export interface ShelfBrand {
  id: string;
  name: string;
}

export interface ShelfUnit {
  brandId: string;
  shelfId: string;
}

export interface ShelfShot {
  brandId: string;
  brandName: string;
  shelfId: string;
  kind: ShelfKind;
  /** File kept on the phone so switching back to scanning does not drop it. */
  localUri: string | null;
  remoteUrl: string | null;
  uploaded: boolean;
  notes: string;
}

type StoredShot = Omit<ShelfShot, 'shelfId'> & { shelfId?: string };

interface StoredDay {
  date: string;
  photos: StoredShot[];
  extraBrands: ShelfBrand[];
  shelves: ShelfUnit[];
  /** Slots removed on the phone that the server may still have. */
  removed: string[];
}

interface ShelfState {
  outletId: string | null;
  date: string | null;
  photos: ShelfShot[];
  extraBrands: ShelfBrand[];
  shelves: ShelfUnit[];
  removed: string[];
  /** True once today's shelves have been lined up for the open store. */
  ready: boolean;
  load: (outletId: string) => Promise<void>;
  pinBrand: (brand: ShelfBrand) => void;
  ensureShelves: (brandIds: string[]) => void;
  addShelf: (brandId: string) => void;
  removeShelf: (shelf: {
    outletId: string;
    brandId: string;
    shelfId: string;
  }) => Promise<void>;
  saveShot: (shot: {
    outletId: string;
    brandId: string;
    brandName: string;
    shelfId: string;
    kind: ShelfKind;
    tempUri: string;
  }) => Promise<void>;
  setNotes: (shot: {
    outletId: string;
    brandId: string;
    shelfId: string;
    kind: ShelfKind;
    notes: string;
  }) => Promise<void>;
  removeShot: (shot: {
    outletId: string;
    brandId: string;
    shelfId: string;
    kind: ShelfKind;
  }) => Promise<void>;
  flush: () => Promise<void>;
}

const slotKey = (brandId: string, shelfId: string, kind: ShelfKind) =>
  `${brandId}|${shelfId}|${kind}`;

function newShelfId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function upsert(photos: ShelfShot[], shot: ShelfShot): ShelfShot[] {
  const key = slotKey(shot.brandId, shot.shelfId, shot.kind);
  const rest = photos.filter(
    (p) => slotKey(p.brandId, p.shelfId, p.kind) !== key,
  );
  return [...rest, shot];
}

function rememberShelf(shelves: ShelfUnit[], brandId: string, shelfId: string) {
  if (shelves.some((shelf) => shelf.shelfId === shelfId)) return shelves;
  return [...shelves, { brandId, shelfId }];
}

/**
 * Pictures saved before shelves existed have no shelf id. They join the
 * server's first shelf for that brand when it is known, otherwise one new shelf.
 */
function reconcile(
  localPhotos: StoredShot[],
  localShelves: ShelfUnit[],
  remote: ShelfShot[],
  removed: string[],
): { photos: ShelfShot[]; shelves: ShelfUnit[]; removed: string[] } {
  let shelves = [...localShelves];
  const remoteShelfIds = new Map<string, string[]>();
  for (const shot of remote) {
    const list = remoteShelfIds.get(shot.brandId) ?? [];
    if (!list.includes(shot.shelfId)) list.push(shot.shelfId);
    remoteShelfIds.set(shot.brandId, list);
    shelves = rememberShelf(shelves, shot.brandId, shot.shelfId);
  }

  const legacyShelf = new Map<string, string>();
  const photos: ShelfShot[] = localPhotos.map((photo) => {
    const notes = photo.notes ?? '';
    if (photo.shelfId) {
      shelves = rememberShelf(shelves, photo.brandId, photo.shelfId);
      return { ...(photo as ShelfShot), notes };
    }
    let shelfId = legacyShelf.get(photo.brandId);
    if (!shelfId) {
      const remoteIds = remoteShelfIds.get(photo.brandId) ?? [];
      shelfId =
        remoteIds.length === 1
          ? remoteIds[0]
          : (shelves.find((shelf) => shelf.brandId === photo.brandId)?.shelfId ??
            newShelfId());
      legacyShelf.set(photo.brandId, shelfId);
    }
    shelves = rememberShelf(shelves, photo.brandId, shelfId);
    return { ...photo, shelfId, notes };
  });

  const removedNext = removed.flatMap((key) => {
    const parts = key.split('|');
    if (parts.length >= 3) return [key];
    const [brandId, kind] = parts;
    if (kind !== 'before' && kind !== 'after') return [];
    const shelfId =
      legacyShelf.get(brandId) ??
      shelves.find((shelf) => shelf.brandId === brandId)?.shelfId;
    return shelfId ? [`${brandId}|${shelfId}|${kind}`] : [];
  });
  const removedSet = new Set(removedNext);
  const merged = mergeRemote(
    photos,
    remote.filter(
      (shot) => !removedSet.has(slotKey(shot.brandId, shot.shelfId, shot.kind)),
    ),
  );
  for (const shot of merged) {
    shelves = rememberShelf(shelves, shot.brandId, shot.shelfId);
  }
  return { photos: merged, shelves, removed: removedNext };
}

async function readDay(outletId: string): Promise<StoredDay | null> {
  const all = await readJson<Record<string, StoredDay>>(KEYS.shelfPhotos);
  const row = all?.[outletId];
  if (!row || row.date !== beirutToday()) return null;
  return {
    date: row.date,
    photos: row.photos ?? [],
    extraBrands: row.extraBrands ?? [],
    shelves: row.shelves ?? [],
    removed: row.removed ?? [],
  };
}

async function writeDay(outletId: string, day: StoredDay): Promise<void> {
  const all =
    (await readJson<Record<string, StoredDay>>(KEYS.shelfPhotos)) ?? {};
  const today = day.date;
  const next: Record<string, StoredDay> = {};
  for (const [id, row] of Object.entries(all)) {
    if (row.date === today) next[id] = row;
  }
  next[outletId] = day;
  await writeJson(KEYS.shelfPhotos, next);
}

let fileSeq = 0;

async function keepOnPhone(
  outletId: string,
  brandId: string,
  shelfId: string,
  kind: ShelfKind,
  tempUri: string,
): Promise<string> {
  const root = FileSystem.documentDirectory;
  if (!root) return tempUri;
  const dir = `${root}shelf-photos/${outletId}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  // A new file name every shot. Reusing one name makes the phone keep
  // painting the first photo from its image cache.
  const dest = `${dir}${brandId}-${shelfId}-${kind}-${Date.now()}-${fileSeq++}.jpg`;
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

function mergeRemote(local: ShelfShot[], remote: ShelfShot[]): ShelfShot[] {
  const map = new Map(
    local.map((p) => [slotKey(p.brandId, p.shelfId, p.kind), p]),
  );
  for (const shot of remote) {
    const key = slotKey(shot.brandId, shot.shelfId, shot.kind);
    const existing = map.get(key);
    if (!existing || existing.uploaded || !existing.localUri) {
      map.set(key, {
        ...shot,
        localUri: existing?.localUri ?? null,
        brandName: existing?.brandName || shot.brandName,
        notes: existing?.notes || shot.notes || '',
        uploaded: true,
      });
      continue;
    }
    map.set(key, existing);
  }
  return [...map.values()];
}

let flushing = false;
/** Bumps whenever a shot is saved or removed, including during an upload. */
let revision = 0;

export const useShelfStore = create<ShelfState>((set, get) => ({
  outletId: null,
  date: null,
  photos: [],
  extraBrands: [],
  shelves: [],
  removed: [],
  ready: false,

  load: async (outletId) => {
    const date = beirutToday();
    const stored = await readDay(outletId);
    const same = get().outletId === outletId && get().date === date;
    if (!same) {
      set({
        outletId,
        date,
        photos: ((stored?.photos ?? []) as ShelfShot[]).map((photo) => ({
          ...photo,
          notes: photo.notes ?? '',
        })),
        extraBrands: stored?.extraBrands ?? [],
        shelves: stored?.shelves ?? [],
        removed: stored?.removed ?? [],
        ready: false,
      });
    }

    let remote: ShelfShot[] = [];
    let fetched = !isOnline();
    if (isOnline()) {
      try {
        const rows = await fetchTodayShelfPhotos(outletId);
        remote = rows.map((photo) => ({
          brandId: photo.brandId,
          brandName: photo.brandName,
          shelfId: photo.shelfId,
          kind: photo.kind,
          localUri: null,
          remoteUrl: photo.url,
          uploaded: true,
          notes: photo.notes ?? '',
        }));
        fetched = true;
      } catch {
        // The copies on the phone still show. A later open tries the server again.
      }
    }

    if (get().outletId !== outletId) return;
    if (!fetched) {
      set({ ready: true });
      await get().flush();
      return;
    }
    const current = get();
    const next = reconcile(
      current.photos,
      current.shelves,
      remote,
      current.removed,
    );
    const extraBrands = [...current.extraBrands];
    for (const shot of remote) {
      if (!extraBrands.some((brand) => brand.id === shot.brandId)) {
        extraBrands.push({ id: shot.brandId, name: shot.brandName });
      }
    }
    set({ ...next, extraBrands, ready: true });
    await writeDay(outletId, {
      date,
      photos: next.photos,
      extraBrands,
      shelves: next.shelves,
      removed: next.removed,
    });
    await get().flush();
  },

  pinBrand: (brand) => {
    const { outletId, date, extraBrands } = get();
    if (!outletId || extraBrands.some((b) => b.id === brand.id)) return;
    const next = [...extraBrands, brand];
    set({ extraBrands: next });
    void writeDay(outletId, {
      date: date ?? beirutToday(),
      photos: get().photos,
      extraBrands: next,
      shelves: get().shelves,
      removed: get().removed,
    });
  },

  ensureShelves: (brandIds) => {
    const { outletId, date } = get();
    if (!outletId) return;
    let shelves = get().shelves;
    let changed = false;
    for (const brandId of brandIds) {
      if (shelves.some((shelf) => shelf.brandId === brandId)) continue;
      shelves = rememberShelf(shelves, brandId, newShelfId());
      changed = true;
    }
    if (!changed) return;
    set({ shelves });
    void writeDay(outletId, {
      date: date ?? beirutToday(),
      photos: get().photos,
      extraBrands: get().extraBrands,
      shelves,
      removed: get().removed,
    });
  },

  addShelf: (brandId) => {
    const { outletId, date } = get();
    if (!outletId) return;
    const shelves = rememberShelf(get().shelves, brandId, newShelfId());
    set({ shelves });
    void writeDay(outletId, {
      date: date ?? beirutToday(),
      photos: get().photos,
      extraBrands: get().extraBrands,
      shelves,
      removed: get().removed,
    });
  },

  removeShelf: async ({ outletId, brandId, shelfId }) => {
    const doomed = get().photos.filter(
      (photo) => photo.brandId === brandId && photo.shelfId === shelfId,
    );
    const photos = get().photos.filter(
      (photo) => !(photo.brandId === brandId && photo.shelfId === shelfId),
    );
    let removed = get().removed.filter(
      (key) => !key.startsWith(`${brandId}|${shelfId}|`),
    );
    for (const shot of doomed) {
      if (shot.uploaded || shot.remoteUrl) {
        removed = [
          ...new Set([...removed, slotKey(shot.brandId, shot.shelfId, shot.kind)]),
        ];
      }
    }
    let shelves = get().shelves.filter((shelf) => shelf.shelfId !== shelfId);
    if (!shelves.some((shelf) => shelf.brandId === brandId)) {
      shelves = rememberShelf(shelves, brandId, newShelfId());
    }
    const date = get().date ?? beirutToday();
    revision += 1;
    set({ outletId, date, photos, shelves, removed });
    await writeDay(outletId, {
      date,
      photos,
      extraBrands: get().extraBrands,
      shelves,
      removed,
    });
    for (const shot of doomed) {
      if (!shot.localUri) continue;
      await FileSystem.deleteAsync(shot.localUri, { idempotent: true }).catch(
        () => undefined,
      );
    }
    void get().flush();
  },

  saveShot: async ({ outletId, brandId, brandName, shelfId, kind, tempUri }) => {
    const previous = get().photos.find(
      (photo) =>
        photo.brandId === brandId &&
        photo.shelfId === shelfId &&
        photo.kind === kind,
    );
    let localUri = tempUri;
    try {
      localUri = await keepOnPhone(outletId, brandId, shelfId, kind, tempUri);
    } catch {
      localUri = tempUri;
    }
    if (previous?.localUri && previous.localUri !== localUri) {
      await FileSystem.deleteAsync(previous.localUri, { idempotent: true }).catch(
        () => undefined,
      );
    }
    const shot: ShelfShot = {
      brandId,
      brandName,
      shelfId,
      kind,
      localUri,
      remoteUrl: null,
      uploaded: false,
      notes: previous?.notes ?? '',
    };
    const date = beirutToday();
    const photos = upsert(get().photos, shot);
    const removed = get().removed.filter(
      (key) => key !== slotKey(brandId, shelfId, kind),
    );
    const extraBrands = get().extraBrands.some((b) => b.id === brandId)
      ? get().extraBrands
      : [...get().extraBrands, { id: brandId, name: brandName }];
    const shelves = rememberShelf(get().shelves, brandId, shelfId);
    revision += 1;
    set({ outletId, date, photos, extraBrands, shelves, removed });
    await writeDay(outletId, { date, photos, extraBrands, shelves, removed });
    void get().flush();
  },

  setNotes: async ({ outletId, brandId, shelfId, kind, notes }) => {
    const key = slotKey(brandId, shelfId, kind);
    const shot = get().photos.find(
      (photo) => slotKey(photo.brandId, photo.shelfId, photo.kind) === key,
    );
    if (!shot) return;
    const trimmed = notes.trim();
    const next: ShelfShot = { ...shot, notes: trimmed };
    const photos = upsert(get().photos, next);
    const date = get().date ?? beirutToday();
    set({ photos });
    await writeDay(outletId, {
      date,
      photos,
      extraBrands: get().extraBrands,
      shelves: get().shelves,
      removed: get().removed,
    });
    if (!(shot.uploaded || shot.remoteUrl) || !isOnline()) return;
    try {
      await updateShelfPhotoNotes({
        outletId,
        brandId,
        shelfId,
        kind,
        notes: trimmed,
      });
    } catch {
      // Local note stays; next reconnect or edit can retry.
    }
  },

  removeShot: async ({ outletId, brandId, shelfId, kind }) => {
    const key = slotKey(brandId, shelfId, kind);
    const shot = get().photos.find(
      (photo) => slotKey(photo.brandId, photo.shelfId, photo.kind) === key,
    );
    const photos = get().photos.filter(
      (photo) => slotKey(photo.brandId, photo.shelfId, photo.kind) !== key,
    );
    const onServer = Boolean(shot?.uploaded || shot?.remoteUrl);
    const removed = onServer
      ? [...new Set([...get().removed, key])]
      : get().removed.filter((item) => item !== key);
    const date = get().date ?? beirutToday();
    revision += 1;
    set({ outletId, date, photos, removed });
    await writeDay(outletId, {
      date,
      photos,
      extraBrands: get().extraBrands,
      shelves: get().shelves,
      removed,
    });
    if (shot?.localUri) {
      await FileSystem.deleteAsync(shot.localUri, { idempotent: true }).catch(
        () => undefined,
      );
    }
    void get().flush();
  },

  flush: async () => {
    if (flushing || !isOnline()) return;
    const { outletId, date } = get();
    if (!outletId || !date) return;
    const pending = get().photos.filter((p) => !p.uploaded && p.localUri);
    const deletions = [...get().removed];
    if (pending.length === 0 && deletions.length === 0) return;
    const seen = revision;
    flushing = true;
    try {
      for (const key of deletions) {
        const [brandId, shelfId, kind] = key.split('|') as [
          string,
          string,
          ShelfKind,
        ];
        if (!brandId || !shelfId || (kind !== 'before' && kind !== 'after')) {
          continue;
        }
        try {
          await deleteShelfPhoto({ outletId, brandId, shelfId, kind });
          if (get().outletId !== outletId) return;
          // A retake during this delete already dropped the tombstone.
          if (!get().removed.includes(key)) continue;
          const removed = get().removed.filter((item) => item !== key);
          set({ removed });
          await writeDay(outletId, {
            date,
            photos: get().photos,
            extraBrands: get().extraBrands,
            shelves: get().shelves,
            removed,
          });
        } catch {
          // Keep the removal on the phone and try the server again later.
        }
      }
      for (const shot of pending) {
        if (!shot.localUri) continue;
        const key = slotKey(shot.brandId, shot.shelfId, shot.kind);
        if (get().removed.includes(key)) continue;
        const current = get().photos.find(
          (photo) =>
            slotKey(photo.brandId, photo.shelfId, photo.kind) === key,
        );
        // Retake replaced this file while the older one was uploading.
        if (!current || current.localUri !== shot.localUri) continue;
        try {
          const saved = await uploadShelfPhoto({
            outletId,
            brandId: shot.brandId,
            shelfId: shot.shelfId,
            kind: shot.kind,
            localUri: shot.localUri,
            notes: shot.notes,
          });
          if (get().outletId !== outletId) return;
          const latest = get().photos.find(
            (photo) =>
              slotKey(photo.brandId, photo.shelfId, photo.kind) === key,
          );
          if (
            !latest ||
            latest.localUri !== shot.localUri ||
            get().removed.includes(key)
          ) {
            continue;
          }
          const photosNow = upsert(get().photos, {
            ...latest,
            brandName: saved.brandName || latest.brandName,
            shelfId: saved.shelfId || latest.shelfId,
            remoteUrl: saved.url,
            notes: saved.notes ?? latest.notes ?? '',
            uploaded: true,
          });
          set({ photos: photosNow });
          await writeDay(outletId, {
            date,
            photos: photosNow,
            extraBrands: get().extraBrands,
            shelves: get().shelves,
            removed: get().removed,
          });
        } catch {
          // Leave it on the phone. The next open or reconnect sends it.
        }
      }
    } finally {
      flushing = false;
    }
    if (get().outletId === outletId && revision !== seen) {
      void get().flush();
    }
  },
}));
