/**
 * 高德地图加载器：从 MapContainer 提取，供行程迷你地图等场景复用。
 * 单例 Promise，避免重复加载脚本。
 */

export type AMapLngLat = {
  getLng: () => number;
  getLat: () => number;
};

export type AMapEvent = {
  lnglat?: AMapLngLat;
  pixel?: { getX?: () => number; getY?: () => number };
};

export type AMapFeature = 'bg' | 'road' | 'building' | 'point';

export type AMapMarker = {
  on: (event: string, handler: (event: AMapEvent) => void) => void;
  setMap?: (map: unknown) => void;
};

export type AMapPolyline = {
  setMap?: (map: unknown) => void;
};

export type AMapInstance = {
  add: (overlay: unknown | unknown[]) => void;
  remove: (overlay: unknown | unknown[]) => void;
  destroy: () => void;
  getZoom: () => number;
  setZoom: (zoom: number) => void;
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean) => void;
  setCenter: (center: [number, number]) => void;
  setFitView: (
    overlays?: unknown[],
    immediately?: boolean,
    avoid?: [number, number, number, number],
    maxZoom?: number,
  ) => void;
  setFeatures: (features: AMapFeature[]) => void;
  on: (event: string, handler: (event: AMapEvent) => void) => void;
  containerToLngLat: (pixel: { getX?: () => number; getY?: () => number }) => AMapLngLat | null;
};

export type AMapGlobal = {
  Map: new (container: HTMLDivElement, options: Record<string, unknown>) => AMapInstance;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Polyline: new (options: Record<string, unknown>) => AMapPolyline;
};

declare global {
  interface Window {
    AMap?: AMapGlobal;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

let amapLoader: Promise<AMapGlobal> | undefined;

export function loadAmap(): Promise<AMapGlobal> {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (amapLoader) return amapLoader;
  amapLoader = fetch('/api/map/config')
    .then(async (response) => {
      if (!response.ok) throw new Error('高德地图配置不可用');
      return response.json() as Promise<{ webKey: string; securityJsCode: string }>;
    })
    .then(({ webKey, securityJsCode }) => new Promise<AMapGlobal>((resolve, reject) => {
      window._AMapSecurityConfig = { securityJsCode };
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(webKey)}`;
      script.async = true;
      script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error('高德地图加载失败'));
      script.onerror = () => reject(new Error('无法连接高德地图服务'));
      document.head.appendChild(script);
    }));
  return amapLoader.catch((error) => {
    amapLoader = undefined;
    throw error;
  });
}
