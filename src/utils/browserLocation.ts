export type BrowserLocationFailureReason =
  | 'insecure-context'
  | 'unsupported'
  | 'permission-denied'
  | 'position-unavailable'
  | 'timeout'
  | 'low-accuracy';

export interface BrowserLocationFix {
  latitude: number;
  longitude: number;
  accuracyM: number;
  observedAt: string;
  source: 'browser';
}

export type BrowserLocationResult =
  | { ok: true; fix: BrowserLocationFix }
  | { ok: false; reason: BrowserLocationFailureReason; bestFix?: BrowserLocationFix };

interface GeolocationLike {
  watchPosition(
    success: (position: GeolocationPosition) => void,
    error?: (error: GeolocationPositionError) => void,
    options?: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

interface BrowserLocationOptions {
  timeoutMs?: number;
  targetAccuracyM?: number;
  maxAcceptedAccuracyM?: number;
  secureContext?: boolean;
  geolocation?: GeolocationLike;
}

function isValidPosition(position: GeolocationPosition): boolean {
  const { latitude, longitude, accuracy } = position.coords;
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && Number.isFinite(accuracy)
    && accuracy >= 0
    && Math.abs(latitude) <= 90
    && Math.abs(longitude) <= 180
    && (latitude !== 0 || longitude !== 0);
}

function toFix(position: GeolocationPosition): BrowserLocationFix {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyM: position.coords.accuracy,
    observedAt: new Date(position.timestamp || Date.now()).toISOString(),
    source: 'browser',
  };
}

function errorReason(error: GeolocationPositionError): BrowserLocationFailureReason {
  if (error.code === 1) return 'permission-denied';
  if (error.code === 2) return 'position-unavailable';
  return 'timeout';
}

/**
 * 短时间连续采样浏览器定位，返回精度最好的 WGS84 坐标。
 *
 * - 仅在安全上下文运行，避免局域网 HTTP 下静默降级。
 * - 不接受缓存位置。
 * - 达到目标精度时提前结束；超时时只接受不差于最大阈值的结果。
 */
export function getBestBrowserLocation(options: BrowserLocationOptions = {}): Promise<BrowserLocationResult> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const targetAccuracyM = options.targetAccuracyM ?? 30;
  const maxAcceptedAccuracyM = options.maxAcceptedAccuracyM ?? 100;
  const secureContext = options.secureContext
    ?? (typeof window !== 'undefined' ? window.isSecureContext : false);
  const geolocation = options.geolocation
    ?? (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);

  if (!secureContext) return Promise.resolve({ ok: false, reason: 'insecure-context' });
  if (!geolocation) return Promise.resolve({ ok: false, reason: 'unsupported' });

  return new Promise((resolve) => {
    let watchId: number | undefined;
    let bestFix: BrowserLocationFix | undefined;
    let settled = false;

    const cleanup = () => {
      if (watchId !== undefined) geolocation.clearWatch(watchId);
      clearTimeout(timer);
    };
    const finish = (result: BrowserLocationResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const finishWithBestOr = (reason: BrowserLocationFailureReason) => {
      if (bestFix && bestFix.accuracyM <= maxAcceptedAccuracyM) {
        finish({ ok: true, fix: bestFix });
      } else {
        finish({ ok: false, reason: bestFix ? 'low-accuracy' : reason, bestFix });
      }
    };
    const timer = setTimeout(() => finishWithBestOr('timeout'), timeoutMs);

    try {
      watchId = geolocation.watchPosition(
        (position) => {
          if (!isValidPosition(position)) return;
          const fix = toFix(position);
          if (!bestFix || fix.accuracyM < bestFix.accuracyM) bestFix = fix;
          if (fix.accuracyM <= targetAccuracyM) finish({ ok: true, fix });
        },
        (error) => finishWithBestOr(errorReason(error)),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: timeoutMs,
        },
      );
    } catch {
      finishWithBestOr('position-unavailable');
    }
  });
}

export function describeBrowserLocationFailure(reason: BrowserLocationFailureReason): string {
  switch (reason) {
    case 'insecure-context':
      return '精确定位需要 HTTPS；当前局域网 HTTP 只能进行城市级定位。';
    case 'unsupported':
      return '当前浏览器不支持设备定位。';
    case 'permission-denied':
      return '定位权限被拒绝，请在浏览器站点设置中允许精确位置。';
    case 'position-unavailable':
      return '暂时无法获取设备位置，请到开阔处并确认系统定位已开启。';
    case 'low-accuracy':
      return '本次定位精度不足，未作为准确位置使用；请重试或手动选点。';
    case 'timeout':
      return '定位超时，请重试或在地图上手动选点。';
  }
}
