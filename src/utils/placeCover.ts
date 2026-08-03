/**
 * 地点封面统一选择逻辑，PC 与手机端共用。
 *
 * 规则（见 AGENTS.md「数据与前端状态」）：
 * 1. 用户显式设置的 cover_image 优先；
 * 2. 否则回退到 created_at 最新的那张照片的 file_path；
 * 3. 无任何可用值时返回 undefined。
 *
 * 本模块只做选择，不做任何 URL 转换；file_path 原样返回。
 */

interface CoverPlace {
  cover_image?: string | null;
}

interface CoverPhoto {
  file_path?: string | null;
  created_at?: string | null;
}

/** 解析 created_at 为可比较的时间戳；缺失或非法时视为最旧。 */
function photoTimestamp(createdAt: string | null | undefined): number {
  const parsed = typeof createdAt === 'string' ? Date.parse(createdAt) : Number.NaN;
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * 选取 created_at 最新的照片。时间戳相等或均缺失时保持数组顺序稳定（取首个）。
 */
export function pickLatestPhoto<T extends { created_at?: string | null }>(
  photos: readonly T[],
): T | undefined {
  let latest: T | undefined;
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  for (const photo of photos) {
    const timestamp = photoTimestamp(photo.created_at);
    if (!latest || timestamp > latestTimestamp) {
      latest = photo;
      latestTimestamp = timestamp;
    }
  }
  return latest;
}

/**
 * 统一封面回退：cover_image 非空字符串优先；否则返回最新照片的 file_path。
 * 空数组、created_at 缺失/非法、file_path 为空均被安全处理。
 */
export function pickPlaceCover(
  place: CoverPlace,
  photos: readonly CoverPhoto[],
): string | undefined {
  if (typeof place.cover_image === 'string' && place.cover_image.length > 0) {
    return place.cover_image;
  }
  const usable = photos.filter(
    (photo) => typeof photo.file_path === 'string' && photo.file_path.length > 0,
  );
  return pickLatestPhoto(usable)?.file_path ?? undefined;
}
