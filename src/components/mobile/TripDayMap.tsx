import React, { useEffect, useRef, useState } from 'react';
import { loadAmap, type AMapInstance, type AMapMarker, type AMapPolyline } from '../../utils/amapLoader';
import type { Place, TripItem } from '../../types';

interface TripDayMapProps {
  items: TripItem[];
  places: Place[];
  className?: string;
}

/**
 * 行程迷你地图：按天显示地点标记 + 路线折线。
 * 只读，无交互编辑，用于行程页快速预览当日路线。
 */
export default function TripDayMap({ items, places, className = '' }: TripDayMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapInstance | undefined>(undefined);
  const overlaysRef = useRef<(AMapMarker | AMapPolyline)[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  // 提取有坐标的行程项（按 sort_order 排序）
  const routePoints = items
    .filter(item => item.place_id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(item => {
      const place = places.find(p => p.id === item.place_id);
      return place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
        ? { item, place }
        : null;
    })
    .filter((p): p is { item: TripItem; place: Place } => p !== null);

  useEffect(() => {
    let disposed = false;
    loadAmap().then((AMap) => {
      if (disposed || !containerRef.current) return;
      const map = new AMap.Map(containerRef.current, {
        zoom: 10,
        mapStyle: 'amap://styles/normal',
        viewMode: '2D',
        resizeEnable: true,
      });
      mapRef.current = map;
      setReady(true);
    }).catch((err) => {
      if (!disposed) setError(err instanceof Error ? err.message : '地图加载失败');
    });
    return () => {
      disposed = true;
      mapRef.current?.destroy();
    };
  }, []);

  // 渲染标记和路线
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const AMap = window.AMap;
    if (!AMap) return;

    // 清除旧覆盖物
    overlaysRef.current.forEach(o => map.remove(o));
    overlaysRef.current = [];

    if (routePoints.length === 0) return;

    // 添加标记
    routePoints.forEach(({ item, place }, index) => {
      const content = document.createElement('div');
      content.className = 'flex flex-col items-center';
      content.innerHTML = `
        <span class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-xs font-black text-white shadow-lg">
          ${index + 1}
        </span>
        <span class="mt-0.5 whitespace-nowrap rounded-md border border-slate-100 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 shadow-sm">
          ${place.name}
        </span>
      `;
      const marker = new AMap.Marker({
        position: [place.longitude, place.latitude],
        content,
        anchor: 'bottom-center',
        offset: [0, 4],
        zIndex: 100,
      });
      map.add(marker);
      overlaysRef.current.push(marker);
    });

    // 添加路线折线（两点以上才画）
    if (routePoints.length >= 2) {
      const path = routePoints.map(({ place }) => [place.longitude, place.latitude]);
      const polyline = new AMap.Polyline({
        path,
        strokeColor: '#3b82f6',
        strokeWeight: 4,
        strokeOpacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 50,
      });
      map.add(polyline);
      overlaysRef.current.push(polyline);
    }

    // 自适应视野
    map.setFitView(overlaysRef.current, false, [20, 20, 20, 20], 14);
  }, [ready, routePoints]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 ${className}`}>
        <p className="text-xs text-slate-400">{error}</p>
      </div>
    );
  }

  if (routePoints.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 ${className}`}>
        <p className="text-xs text-slate-400">当日暂无关联地点的行程项</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-xl border border-slate-100 overflow-hidden bg-slate-100 ${className}`}
      style={{ minHeight: 180 }}
      aria-label="当日行程路线地图"
    />
  );
}
