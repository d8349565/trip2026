export interface PoiSearchInput {
  keywords: string;
  region?: string;
}

export interface ReverseGeocodeInput {
  latitude: number;
  longitude: number;
}

export interface GeocodingProvider {
  readonly name: string;
  searchPoi(input: PoiSearchInput): Promise<Record<string, unknown>>;
  reverseGeocode(input: ReverseGeocodeInput): Promise<Record<string, unknown>>;
}

export class GeocodingError extends Error {
  constructor(
    readonly code: 'GEOCODER_NOT_CONFIGURED' | 'GEOCODER_UPSTREAM_ERROR' | 'GEOCODER_UPSTREAM_UNAVAILABLE',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

interface CacheEntry {
  value: Record<string, unknown>;
  expiresAt: number;
}

class TimedLruCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number,
  ) {}

  get(key: string): Record<string, unknown> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: Record<string, unknown>) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

export class AmapGeocodingProvider implements GeocodingProvider {
  readonly name = 'amap';

  constructor(
    private readonly key: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request(url: URL): Promise<Record<string, unknown>> {
    try {
      const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(8_000) });
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok || body.status === '0') {
        throw new GeocodingError(
          'GEOCODER_UPSTREAM_ERROR',
          typeof body.info === 'string' ? body.info : '高德地理编码服务返回错误',
          typeof body.infocode === 'string' ? { infocode: body.infocode } : undefined,
        );
      }
      return body;
    } catch (error) {
      if (error instanceof GeocodingError) throw error;
      throw new GeocodingError(
        'GEOCODER_UPSTREAM_UNAVAILABLE',
        error instanceof Error && error.name === 'TimeoutError'
          ? '高德地理编码服务请求超时'
          : '无法连接高德地理编码服务',
      );
    }
  }

  searchPoi(input: PoiSearchInput): Promise<Record<string, unknown>> {
    const url = new URL('https://restapi.amap.com/v5/place/text');
    url.searchParams.set('key', this.key);
    url.searchParams.set('keywords', input.keywords);
    url.searchParams.set('page_size', '20');
    if (input.region) url.searchParams.set('region', input.region);
    return this.request(url);
  }

  reverseGeocode(input: ReverseGeocodeInput): Promise<Record<string, unknown>> {
    const url = new URL('https://restapi.amap.com/v3/geocode/regeo');
    url.searchParams.set('key', this.key);
    url.searchParams.set('location', `${input.longitude},${input.latitude}`);
    url.searchParams.set('extensions', 'all');
    return this.request(url);
  }
}

/**
 * 提供方按顺序执行：高德可作为主提供方，未来可追加本地城市库作为降级提供方。
 * 只有成功结果进入内存 LRU，错误不会污染缓存。
 */
export class GeocodingService {
  private readonly poiCache: TimedLruCache;
  private readonly reverseCache: TimedLruCache;

  constructor(
    private readonly providers: GeocodingProvider[],
    options: {
      now?: () => number;
      poiTtlMs?: number;
      reverseTtlMs?: number;
      maxEntries?: number;
    } = {},
  ) {
    const now = options.now ?? Date.now;
    const maxEntries = options.maxEntries ?? 500;
    this.poiCache = new TimedLruCache(options.poiTtlMs ?? 5 * 60_000, maxEntries, now);
    this.reverseCache = new TimedLruCache(options.reverseTtlMs ?? 24 * 60 * 60_000, maxEntries, now);
  }

  private async firstSuccessful(
    operation: (provider: GeocodingProvider) => Promise<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    if (this.providers.length === 0) {
      throw new GeocodingError('GEOCODER_NOT_CONFIGURED', '未配置可用的地理编码服务');
    }
    let lastError: unknown;
    for (const provider of this.providers) {
      try {
        return await operation(provider);
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError instanceof GeocodingError) throw lastError;
    throw new GeocodingError('GEOCODER_UPSTREAM_UNAVAILABLE', '所有地理编码服务均不可用');
  }

  async searchPoi(input: PoiSearchInput): Promise<Record<string, unknown>> {
    const normalized = {
      keywords: input.keywords.trim(),
      region: input.region?.trim() || undefined,
    };
    const key = `${normalized.keywords.toLocaleLowerCase()}\n${normalized.region?.toLocaleLowerCase() ?? ''}`;
    const cached = this.poiCache.get(key);
    if (cached) return cached;
    const result = await this.firstSuccessful((provider) => provider.searchPoi(normalized));
    this.poiCache.set(key, result);
    return result;
  }

  async reverseGeocode(input: ReverseGeocodeInput): Promise<Record<string, unknown>> {
    // 五位小数约为米级范围，同一地图点击/拖动产生的微小浮点差异可复用结果。
    const normalized = {
      latitude: Number(input.latitude.toFixed(5)),
      longitude: Number(input.longitude.toFixed(5)),
    };
    const key = `${normalized.longitude},${normalized.latitude}`;
    const cached = this.reverseCache.get(key);
    if (cached) return cached;
    const result = await this.firstSuccessful((provider) => provider.reverseGeocode(normalized));
    this.reverseCache.set(key, result);
    return result;
  }
}
