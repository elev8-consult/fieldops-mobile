import { api } from './api';

export type ShelfKind = 'before' | 'after';

export interface RemoteShelfPhoto {
  brandId: string;
  brandName: string;
  shelfId: string;
  kind: ShelfKind;
  url: string | null;
}

export async function fetchTodayShelfPhotos(
  outletId: string,
): Promise<RemoteShelfPhoto[]> {
  const { data } = await api.get<{ photos: RemoteShelfPhoto[] }>(
    '/shelf-photos/today',
    { params: { outletId } },
  );
  return data.photos ?? [];
}

export async function uploadShelfPhoto(input: {
  outletId: string;
  brandId: string;
  shelfId: string;
  kind: ShelfKind;
  localUri: string;
}): Promise<RemoteShelfPhoto> {
  const body = new FormData();
  body.append('outletId', input.outletId);
  body.append('brandId', input.brandId);
  body.append('shelfId', input.shelfId);
  body.append('kind', input.kind);
  body.append('file', {
    uri: input.localUri,
    name: 'shelf.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  const { data } = await api.post<RemoteShelfPhoto>('/shelf-photos', body, {
    timeout: 60000,
  });
  return data;
}

export async function deleteShelfPhoto(input: {
  outletId: string;
  brandId: string;
  shelfId: string;
  kind: ShelfKind;
}): Promise<void> {
  await api.delete('/shelf-photos/today', { params: input });
}
