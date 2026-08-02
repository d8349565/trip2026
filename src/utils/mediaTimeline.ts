import type { Media } from '../types';

function mediaTimestamp(item: Media): number {
  const value = item.captured_at || item.created_at;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/** Return a stable local calendar key so PC and mobile share the same grouping. */
export function getMediaDateKey(item: Media): string {
  const rawValue = item.captured_at || item.created_at;
  const rawDate = rawValue?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (rawDate) return rawDate;

  const timestamp = mediaTimestamp(item);
  if (!timestamp) return 'recent';
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function sortMediaByDateDesc(items: Media[]): Media[] {
  return [...items].sort((left, right) => {
    const difference = mediaTimestamp(right) - mediaTimestamp(left);
    return difference || right.id.localeCompare(left.id);
  });
}

export function groupMediaByDate(items: Media[]): Array<{ dateKey: string; photos: Media[] }> {
  const grouped = new Map<string, Media[]>();
  for (const item of sortMediaByDateDesc(items)) {
    const dateKey = getMediaDateKey(item);
    const photos = grouped.get(dateKey);
    if (photos) photos.push(item);
    else grouped.set(dateKey, [item]);
  }
  return [...grouped.entries()].map(([dateKey, photos]) => ({ dateKey, photos }));
}

export function formatMediaDate(dateKey: string, now = new Date()): string {
  if (dateKey === 'recent') return '最近上传';
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const [, year, month, day] = match;
  return Number(year) === now.getFullYear()
    ? `${Number(month)}月${Number(day)}日`
    : `${year}年${Number(month)}月${Number(day)}日`;
}
