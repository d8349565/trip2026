/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, Crosshair, Edit3, Link2, LocateFixed, MapPin, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { api, type AmapPoi } from '../api';
import { wgs84ToGcj02 } from '../utils/coords';
import type { Place, PlaceCategory, Media } from '../types';

interface MapContainerProps {
  places: Place[];
  media?: Media[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place) => void;
  onCreatePlace: (place: Partial<Place>) => Promise<Place>;
  onUpdatePlace: (id: string, place: Partial<Place>) => Promise<Place>;
  onDeletePlace: (id: string) => Promise<void>;
  editorRequest?: number;
  editRequest?: { token: number; place: Place } | null;
  photoDraft?: { token: number; mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string } | null;
  onPhotoDraftEnd?: () => void;
  categoryColors: Record<PlaceCategory, { bg: string; text: string; iconBg: string; border: string }>;
  categoryLabels: Record<PlaceCategory, string>;
  categoryIcons: Record<PlaceCategory, React.ReactNode>;
  /** 搜索栏下方的插槽（如分类条），确保搜索结果在其后展开不被遮挡 */
  searchSlot?: React.ReactNode;
}

type AMapLngLat = { getLng: () => number; getLat: () => number };
type AMapEvent = { lnglat?: AMapLngLat };
type AMapMarker = { on: (event: string, handler: (event: AMapEvent) => void) => void };
type AMapInstance = {
  add: (overlay: unknown | unknown[]) => void;
  remove: (overlay: unknown | unknown[]) => void;
  destroy: () => void;
  getZoom: () => number;
  setZoom: (zoom: number) => void;
  setZoomAndCenter: (zoom: number, center: [number, number]) => void;
  setCenter: (center: [number, number]) => void;
  on: (event: string, handler: (event: AMapEvent) => void) => void;
  containerToLngLat: (pixel: { getX?: () => number; getY?: () => number }) => AMapLngLat | null;
};
type AMapGlobal = {
  Map: new (container: HTMLDivElement, options: Record<string, unknown>) => AMapInstance;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
};

declare global {
  interface Window {
    AMap?: AMapGlobal;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

let amapLoader: Promise<AMapGlobal> | undefined;

async function loadAmap(): Promise<AMapGlobal> {
  if (window.AMap) return window.AMap;
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

const CATEGORY_EMOJI: Partial<Record<PlaceCategory, string>> = {
  stream: '🌊', scenic: '🏞️', play: '🎡', food: '🍜', accommodation: '🏠', camp: '⛺',
  parking: '🅿️', hiking: '🥾', viewpoint: '🔭', family: '👨‍👩‍👧', charging: '⚡', medical: '🏥',
};

const EMPTY_DRAFT: Partial<Place> = {
  name: '', category_id: 'scenic', address: '', summary: '', coordinate_system: 'GCJ02',
  status: 'want_to_go', visibility: 'shared', favorite: false, recommended: false,
};

function mapCenter(places: Place[]): [number, number] {
  if (!places.length) return [116.63, 23.66];
  const total = places.reduce((result, place) => ({
    lng: result.lng + place.longitude,
    lat: result.lat + place.latitude,
  }), { lng: 0, lat: 0 });
  return [total.lng / places.length, total.lat / places.length];
}

function inferCategory(poi: AmapPoi): PlaceCategory {
  const text = `${poi.type ?? ''} ${poi.name}`;
  if (/餐饮|美食|饭店|餐厅|小吃|咖啡|茶馆/.test(text)) return 'food';
  if (/酒店|住宿|宾馆|民宿|客栈/.test(text)) return 'accommodation';
  if (/停车/.test(text)) return 'parking';
  if (/充电/.test(text)) return 'charging';
  if (/医疗|医院|诊所|药店/.test(text)) return 'medical';
  if (/露营|营地/.test(text)) return 'camp';
  if (/步道|徒步|登山/.test(text)) return 'hiking';
  if (/乐园|游乐|娱乐/.test(text)) return 'play';
  return 'scenic';
}

export default function MapContainer({
  places,
  media = [],
  selectedPlace,
  onSelectPlace,
  onCreatePlace,
  onUpdatePlace,
  onDeletePlace,
  editorRequest = 0,
  editRequest = null,
  photoDraft = null,
  onPhotoDraftEnd,
  categoryLabels,
  searchSlot,
}: MapContainerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<AMapInstance | undefined>(undefined);
  const markersRef = useRef<unknown[]>([]);
  const draftMarkerRef = useRef<unknown | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [keywords, setKeywords] = useState('');
  const [region, setRegion] = useState('');
  const [pois, setPois] = useState<AmapPoi[]>([]);
  const [searchMode, setSearchMode] = useState<'poi' | 'share'>('poi');
  const [shareUrl, setShareUrl] = useState('');
  const [draft, setDraft] = useState<Partial<Place> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [contextMenu, setContextMenu] = useState<{ place: Place; x: number; y: number } | null>(null);
  const [photoMode, setPhotoMode] = useState<string | null>(null);
  const photoModeRef = useRef<string | null>(null);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number; address?: string; name?: string } | null>(null);
  const myLocMarkerRef = useRef<unknown | undefined>(undefined);
  const initialCenterRef = useRef(mapCenter(places));
  // 手势模式按“主指针”判定：触屏笔记本的主指针仍是鼠标(fine)，应走 PC 双击建点；
  // 只看 ontouchstart/maxTouchPoints 会把触屏 PC 误判成移动端，导致双击无法新增。
  const isTouchDevice = typeof window !== 'undefined' && (
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
  const dismissHint = () => {}; // no-op: 不再显示底部提示
  // 手机端编辑表单：可收起/展开
  const [draftExpanded, setDraftExpanded] = useState(false);
  // 长按检测 ref
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  const enterPhotoMode = (mediaId: string) => {
    photoModeRef.current = mediaId;
    setPhotoMode(mediaId);
  };
  const endPhotoMode = () => {
    if (!photoModeRef.current) return;
    photoModeRef.current = null;
    setPhotoMode(null);
    onPhotoDraftEnd?.();
  };

  const reversePosition = async (latitude: number, longitude: number) => {
    setDraft((current) => current ? { ...current, latitude, longitude } : current);
    try {
      const location = await api.reverseGeocode(latitude, longitude);
      const { name, ...fields } = location;
      setDraft((current) => current && current.latitude === latitude && current.longitude === longitude
        ? { ...current, ...fields, ...(current.name ? {} : name ? { name } : {}) }
        : current);
    } catch {
      setMessage('坐标已更新，但地址反查失败；可手动修改地址。');
    }
  };

  const startDraftAt = (latitude: number, longitude: number, seed: Partial<Place> = {}) => {
    setEditingId(null);
    setContextMenu(null);
    setMessage('拖动蓝色标记可微调位置，保存前地图始终可见。');
    setDraft({ ...EMPTY_DRAFT, ...seed, latitude, longitude });
    mapRef.current?.setZoomAndCenter(16, [longitude, latitude]);
    if (!seed.address) void reversePosition(latitude, longitude);
  };

  useEffect(() => {
    if (!editorRequest) return;
    searchInputRef.current?.focus();
    setMessage('搜索地点，或双击地图开始手动标记。');
  }, [editorRequest]);

  useEffect(() => {
    if (!editRequest) return;
    endPhotoMode();
    const place = editRequest.place;
    setEditingId(place.id);
    setDraft({ ...place });
    setContextMenu(null);
    setMessage('手机GPS定位常有偏差：拖动蓝色标记到准确位置，再保存。');
    mapRef.current?.setZoomAndCenter(16, [place.longitude, place.latitude]);
  }, [editRequest?.token]);

  useEffect(() => {
    if (!photoDraft) return;
    const { latitude, longitude, name, address } = photoDraft;
    enterPhotoMode(photoDraft.mediaId);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      startDraftAt(latitude as number, longitude as number, { name: name ?? '', address: address ?? '' });
      setMessage('已根据照片拍摄位置预填。可拖动蓝色标记微调，保存后照片会自动关联到这个地点。');
    } else {
      setMessage('这张照片没有位置信息。请在地图上双击选择拍摄位置，保存标记后会自动关联照片。');
    }
  }, [photoDraft?.token]);

  useEffect(() => {
    let disposed = false;
    loadAmap().then((AMap) => {
      if (disposed || !containerRef.current) return;
      const map = new AMap.Map(containerRef.current, {
        center: initialCenterRef.current,
        zoom: places.length > 1 ? 11 : 13,
        viewMode: '2D',
        doubleClickZoom: isTouchDevice,
        resizeEnable: true,
      });
      // 移动端：双击放大走原生（doubleClickZoom=true），长按创建标记
      // PC 端：双击缩放被禁用，双击改为创建标记
      if (!isTouchDevice) {
        map.on('dblclick', (event) => {
          if (!event.lnglat) return;
          dismissHint();
          startDraftAt(
            Number(event.lnglat.getLat().toFixed(6)),
            Number(event.lnglat.getLng().toFixed(6)),
          );
        });
      }
      mapRef.current = map;
      setReady(true);
      // 双击/双指缩放会触发 zoomstart；AMap 可能吞掉 touchend 导致长按定时器残留，
      // 一旦地图开始缩放/移动就清除待定的长按，避免双击误创建标记
      const clearLongPress = () => {
        if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = undefined; }
      };
      map.on('zoomstart', clearLongPress);
      map.on('movestart', clearLongPress);
      // 移动端长按创建标记（600ms，移动超 10px 取消）
      if (isTouchDevice && containerRef.current) {
        const el = containerRef.current;
        el.addEventListener('touchstart', (e) => {
          if (e.touches.length !== 1) return;
          const t = e.touches[0];
          longPressStartRef.current = { x: t.clientX, y: t.clientY };
          longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = undefined;
            // 触发长按：用 touch 坐标转地图经纬度
            const pixel = new (window as any).AMap.Pixel(t.clientX - el.getBoundingClientRect().left, t.clientY - el.getBoundingClientRect().top);
            const lnglat = map.containerToLngLat(pixel);
            if (lnglat) {
              dismissHint();
              startDraftAt(Number(lnglat.getLat().toFixed(6)), Number(lnglat.getLng().toFixed(6)));
            }
          }, 600);
        }, { passive: true });
        el.addEventListener('touchmove', (e) => {
          if (!longPressTimerRef.current || !longPressStartRef.current || e.touches.length !== 1) return;
          const t = e.touches[0];
          const dx = t.clientX - longPressStartRef.current.x;
          const dy = t.clientY - longPressStartRef.current.y;
          if (dx * dx + dy * dy > 100) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = undefined; }
        }, { passive: true });
        el.addEventListener('touchend', () => {
          if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = undefined; }
          longPressStartRef.current = null;
        }, { passive: true });
      }
      // 先恢复上次记住的位置（立即显示蓝点，无需等待授权），再尝试刷新到最新位置
      const saved = (() => {
        try { return JSON.parse(localStorage.getItem(MY_LOCATION_KEY) ?? 'null'); } catch { return null; }
      })();
      if (saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) {
        applyMyLocation(saved.latitude, saved.longitude, 15);
        void refreshMyLocationAddress(saved.latitude, saved.longitude);
      }
      void locateAndCenter();
    }).catch((cause) => {
      if (!disposed) setError(cause instanceof Error ? cause.message : '高德地图加载失败');
    });
    return () => {
      disposed = true;
      mapRef.current?.destroy();
      mapRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (!ready || !map || !AMap) return;
    if (markersRef.current.length) map.remove(markersRef.current);

    markersRef.current = places.map((place) => {
      const selected = selectedPlace?.id === place.id;
      const cover = place.cover_image || media.find((m) => m.place_id === place.id)?.file_path;
      const content = document.createElement('button');
      content.type = 'button';
      content.dataset.placeMarker = place.id;
      content.className = 'group flex flex-col items-center outline-none';
      content.title = `${categoryLabels[place.category_id] ?? '地点'}：${place.name}（右键管理）`;
      const safeName = place.name.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
      const visitedBadge = place.status === 'visited' ? '<i class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-emerald-500 text-[9px] not-italic text-white z-10">✓</i>' : '';
      const iconInner = cover
        ? `<img src="${cover}" alt="${safeName}" class="h-full w-full rounded-full object-cover" />`
        : (CATEGORY_EMOJI[place.category_id] ?? '📍');
      content.innerHTML = `
        <span class="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white text-lg shadow-lg transition-transform ${selected ? 'scale-125 ring-4 ring-blue-400/40' : 'bg-white hover:scale-110'}">
          ${iconInner}
          ${visitedBadge}
        </span>
        <span class="mt-1 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-bold shadow-sm ${selected ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-800'}">${safeName}</span>`;
      content.addEventListener('click', (event) => {
        event.stopPropagation();
        setContextMenu(null);
        onSelectPlace(place);
      });
      content.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return;
        setContextMenu({ place, x: event.clientX - rect.left, y: event.clientY - rect.top });
      });
      const marker = new AMap.Marker({
        position: [place.longitude, place.latitude], content, anchor: 'bottom-center', offset: [0, 10],
        zIndex: selected ? 200 : 100,
      });
      // AMap 2.0 overlay 层可能吞掉自定义 content 上的 DOM click，
      // 用原生 marker 事件兜底确保点击一定触发。
      marker.on('click', () => {
        setContextMenu(null);
        onSelectPlace(place);
      });
      map.add(marker);
      return marker;
    });
    return () => {
      if (markersRef.current.length && mapRef.current) mapRef.current.remove(markersRef.current);
      markersRef.current = [];
    };
  }, [categoryLabels, media, onSelectPlace, places, ready, selectedPlace]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (!ready || !map || !AMap) return;
    if (draftMarkerRef.current) map.remove(draftMarkerRef.current);
    if (!draft || !Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude)) {
      draftMarkerRef.current = undefined;
      return;
    }
    const marker = new AMap.Marker({
      position: [draft.longitude, draft.latitude], draggable: true, cursor: 'move',
      anchor: 'bottom-center', zIndex: 500,
    });
    marker.on('dragend', (event) => {
      if (!event.lnglat) return;
      void reversePosition(
        Number(event.lnglat.getLat().toFixed(6)),
        Number(event.lnglat.getLng().toFixed(6)),
      );
    });
    map.add(marker);
    draftMarkerRef.current = marker;
    return () => {
      if (draftMarkerRef.current && mapRef.current) mapRef.current.remove(draftMarkerRef.current);
      draftMarkerRef.current = undefined;
    };
  }, [draft?.latitude, draft?.longitude, ready]);

  // 我的位置标记：蓝色脉冲圆点，可拖动重新设定位置（美团式交互）
  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (!ready || !map || !AMap) return;
    if (myLocMarkerRef.current) map.remove(myLocMarkerRef.current);
    if (!myLocation || !Number.isFinite(myLocation.latitude) || !Number.isFinite(myLocation.longitude)) {
      myLocMarkerRef.current = undefined;
      return;
    }
    const content = document.createElement('div');
    content.className = 'tf-my-location';
    content.innerHTML = `
      <span class="tf-pulse-ring"></span>
      <span class="tf-pulse-ring tf-pulse-ring-late"></span>
      <span class="tf-my-dot"></span>`;
    const marker = new AMap.Marker({
      position: [myLocation.longitude, myLocation.latitude],
      content, draggable: true, cursor: 'move', anchor: 'center', zIndex: 450,
    });
    marker.on('dragend', (event) => {
      if (!event.lnglat) return;
      const latitude = Number(event.lnglat.getLat().toFixed(6));
      const longitude = Number(event.lnglat.getLng().toFixed(6));
      applyMyLocation(latitude, longitude);
      void refreshMyLocationAddress(latitude, longitude);
      setMessage('当前位置已更新，可继续拖动蓝点调整。');
    });
    map.add(marker);
    myLocMarkerRef.current = marker;
    return () => {
      if (myLocMarkerRef.current && mapRef.current) mapRef.current.remove(myLocMarkerRef.current);
      myLocMarkerRef.current = undefined;
    };
  }, [myLocation?.latitude, myLocation?.longitude, ready]);

  useEffect(() => {
    if (selectedPlace && mapRef.current && !draft) mapRef.current.setCenter([selectedPlace.longitude, selectedPlace.latitude]);
  }, [draft, selectedPlace]);

  // ---- 我的位置：蓝色脉冲定位点，可拖动重新设定，位置记住到本地 ----
  const MY_LOCATION_KEY = 'tf-my-location';

  const applyMyLocation = (latitude: number, longitude: number, zoom?: number) => {
    setMyLocation((current) => current && current.latitude === latitude && current.longitude === longitude
      ? current
      : { latitude, longitude });
    try {
      localStorage.setItem(MY_LOCATION_KEY, JSON.stringify({ latitude, longitude }));
    } catch { /* storage unavailable */ }
    if (zoom) mapRef.current?.setZoomAndCenter(zoom, [longitude, latitude]);
  };

  const refreshMyLocationAddress = async (latitude: number, longitude: number) => {
    try {
      const location = await api.reverseGeocode(latitude, longitude);
      setMyLocation((current) => current && current.latitude === latitude && current.longitude === longitude
        ? { ...current, address: location.address || undefined, name: location.name }
        : current);
    } catch {
      // Keep the coordinates-only display in the location card.
    }
  };

  // Center the map on the user: precise browser geolocation first (works on
  // localhost/HTTPS; browsers block it on plain-HTTP LAN addresses), then
  // AMap IP city location, then keep the last remembered / centroid default.
  const locateAndCenter = async () => {
    if ('geolocation' in navigator) {
      const positioned = await new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = wgs84ToGcj02(position.coords.latitude, position.coords.longitude);
            applyMyLocation(latitude, longitude, 15);
            void refreshMyLocationAddress(latitude, longitude);
            resolve(true);
          },
          () => resolve(false),
          { timeout: 8000, maximumAge: 300000 },
        );
      });
      if (positioned) return;
    }
    try {
      const point = await api.locateByIp();
      if (point) {
        applyMyLocation(point.latitude, point.longitude, 11);
        void refreshMyLocationAddress(point.latitude, point.longitude);
      }
    } catch {
      // Keep the default center derived from existing places.
    }
  };

  const createAtMyLocation = () => {
    if (!myLocation) return;
    startDraftAt(myLocation.latitude, myLocation.longitude, {
      name: myLocation.name ?? '',
      address: myLocation.address ?? '',
    });
    setMessage('已把当前位置填入表单，可拖动蓝色标记微调后保存。');
  };

  const searchPoi = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!keywords.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const results = await api.searchMapPoi(keywords.trim(), region.trim());
      setPois(results);
      if (!results.length) setMessage('没有找到匹配地点，请更换关键词或城市。');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '地点搜索失败');
    } finally {
      setBusy(false);
    }
  };

  const choosePoi = (poi: AmapPoi) => {
    endPhotoMode();
    const [longitude, latitude] = poi.location.split(',').map(Number);
    const address = Array.isArray(poi.address) ? poi.address.join('') : poi.address;
    setPois([]);
    startDraftAt(latitude, longitude, {
      name: poi.name,
      category_id: inferCategory(poi),
      address: [poi.pname, poi.cityname, poi.adname, address].filter(Boolean).join(''),
      province: poi.pname,
      city: poi.cityname,
      district: poi.adname,
      poi_provider: 'amap',
      poi_id: poi.id,
    });
  };

  const resolveShare = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shareUrl.trim()) return;
    endPhotoMode();
    setBusy(true);
    setMessage('');
    try {
      const point = await api.resolveMapShare(shareUrl.trim());
      startDraftAt(point.latitude, point.longitude, {
        name: point.name || '分享的地点',
        address: point.address || '',
        poi_provider: point.provider,
      });
      setShareUrl('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '分享链接解析失败');
    } finally {
      setBusy(false);
    }
  };

  const editPlace = (place: Place) => {
    setEditingId(place.id);
    setDraft({ ...place });
    setContextMenu(null);
    setMessage('手机GPS定位常有偏差：拖动蓝色标记到准确位置，再保存。');
    mapRef.current?.setZoomAndCenter(16, [place.longitude, place.latitude]);
  };

  const deletePlace = async (place: Place) => {
    setContextMenu(null);
    if (!window.confirm(`确定删除“${place.name}”吗？关联打卡会删除，照片和行程将解除地点关联。`)) return;
    setBusy(true);
    try {
      await onDeletePlace(place.id);
      if (editingId === place.id) {
        setDraft(null);
        setEditingId(null);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '地点删除失败');
    } finally {
      setBusy(false);
    }
  };

  const savePlace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft?.name?.trim() || !Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude)) {
      setMessage('地点名称和有效坐标不能为空。');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const saved = editingId
        ? await onUpdatePlace(editingId, draft)
        : await onCreatePlace(draft);
      setDraft(null);
      setEditingId(null);
      endPhotoMode();
      onSelectPlace(saved);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '地点保存失败');
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (field: keyof Place, value: unknown) => setDraft((current) => current ? { ...current, [field]: value } : current);
  const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs outline-none focus:border-blue-400';

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100" onClick={() => setContextMenu(null)}>
      <div ref={containerRef} className="absolute inset-0" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label="高德地图" />

      {!ready && !error && <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">正在加载高德地图…</div>}
      {error && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-50 px-6 text-center"><p className="font-bold text-red-600">{error}</p><p className="mt-2 text-xs text-slate-500">请检查 Key 类型、安全密钥和域名配置。</p></div>}

      <div className="absolute left-3 right-16 top-3 z-40 max-w-md" onClick={(event) => event.stopPropagation()}>
        <div className="flex rounded-2xl border border-slate-100 bg-white/95 p-1.5 shadow-lg backdrop-blur-md">
          {searchMode === 'poi' ? <form onSubmit={searchPoi} className="flex min-w-0 flex-1 gap-1.5">
            <Search size={16} className="ml-2 mt-2 shrink-0 text-slate-400" />
            <input ref={searchInputRef} data-testid="map-poi-search" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="在地图上搜索地点…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
            <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="城市" className="hidden w-20 rounded-lg bg-slate-50 px-2 text-[11px] outline-none sm:block" />
            <button disabled={busy} className="rounded-xl bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-50">搜索</button>
          </form> : <form onSubmit={resolveShare} className="flex min-w-0 flex-1 gap-1.5">
            <Link2 size={16} className="ml-2 mt-2 shrink-0 text-slate-400" />
            <input value={shareUrl} onChange={(event) => setShareUrl(event.target.value)} placeholder="粘贴高德或百度地图分享链接…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
            <button disabled={busy} className="rounded-xl bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-50">解析</button>
          </form>}
          <button type="button" onClick={() => { setSearchMode((current) => current === 'poi' ? 'share' : 'poi'); setPois([]); }} className="ml-1 rounded-xl p-2 text-slate-500 hover:bg-slate-100" title={searchMode === 'poi' ? '粘贴地图分享链接' : '搜索高德地点'}>{searchMode === 'poi' ? <Link2 size={16} /> : <Search size={16} />}</button>
          <button type="button" onClick={() => { setMessage('请在地图目标位置双击，随后可拖动蓝色标记微调。'); searchInputRef.current?.blur(); }} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" title="手动地图选点"><MapPin size={16} /></button>
        </div>

        {searchSlot && <div className="mt-1.5" onClick={(event) => event.stopPropagation()}>{searchSlot}</div>}

        {pois.length > 0 && <div data-testid="map-poi-results" className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-xl">
          {pois.map((poi) => <button key={poi.id} type="button" onClick={() => choosePoi(poi)} className="flex w-full items-start gap-2 rounded-xl p-2.5 text-left hover:bg-blue-50">
            <MapPin size={15} className="mt-0.5 shrink-0 text-blue-500" />
            <span className="min-w-0"><strong className="block truncate text-xs text-slate-800">{poi.name}</strong><small className="mt-0.5 block text-[10px] text-slate-400">{[poi.pname, poi.cityname, poi.adname, Array.isArray(poi.address) ? poi.address.join('') : poi.address].filter(Boolean).join('')}</small></span>
          </button>)}
        </div>}
      </div>

      <div className="absolute right-3 top-3 z-30 flex flex-col gap-2 max-sm:hidden">
        <button onClick={() => mapRef.current?.setZoom(Math.min(20, (mapRef.current?.getZoom() ?? 12) + 1))} className="rounded-xl border bg-white p-2.5 text-slate-600 shadow-lg" title="放大"><Plus size={18} /></button>
        <button onClick={() => mapRef.current?.setZoom(Math.max(3, (mapRef.current?.getZoom() ?? 12) - 1))} className="rounded-xl border bg-white p-2.5 text-slate-600 shadow-lg" title="缩小"><Minus size={18} /></button>
        <button onClick={() => mapRef.current?.setZoomAndCenter(places.length > 1 ? 11 : 13, mapCenter(places))} className="rounded-xl border bg-white p-2.5 text-slate-600 shadow-lg" title="显示全部地点"><LocateFixed size={18} /></button>
        <button onClick={() => void locateAndCenter()} className="rounded-xl border bg-white p-2.5 text-slate-600 shadow-lg" title="定位到当前位置"><Crosshair size={18} /></button>
      </div>

      {contextMenu && <div data-testid="marker-context-menu" style={{ left: Math.min(contextMenu.x, (rootRef.current?.clientWidth ?? 300) - 150), top: Math.min(contextMenu.y, (rootRef.current?.clientHeight ?? 300) - 100) }} className="absolute z-50 w-36 overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <p className="truncate px-2 py-1 text-[10px] font-bold text-slate-400">{contextMenu.place.name}</p>
        <button onClick={() => editPlace(contextMenu.place)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100"><Edit3 size={14} />编辑地点</button>
        <button onClick={() => void deletePlace(contextMenu.place)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={14} />删除地点</button>
      </div>}

      {draft && <form data-testid="map-place-editor" onSubmit={savePlace} onClick={(event) => event.stopPropagation()} className={`absolute left-3 right-3 z-40 overflow-hidden rounded-2xl border border-slate-100 bg-white/98 shadow-2xl backdrop-blur-md transition-all duration-300 ${draftExpanded ? 'bottom-3 max-h-[70vh] overflow-y-auto p-4' : 'bottom-3 p-3'}`}>
        {/* 收起态：一行紧凑操作栏，地图全露 */}
        {!draftExpanded ? (
          <div className="flex items-center gap-2">
            <input required value={draft.name ?? ''} onChange={(event) => updateDraft('name', event.target.value)} placeholder="地点名称" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs outline-none focus:border-blue-400" />
            <button type="button" onClick={() => setDraftExpanded(true)} className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-200">展开</button>
            <button disabled={busy} type="submit" className="shrink-0 flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check size={13} />保存</button>
            <button type="button" onClick={() => { setDraft(null); setEditingId(null); setMessage(''); endPhotoMode(); }} className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={14} /></button>
          </div>
        ) : (
          <>
        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-black text-slate-800">{editingId ? '编辑地点' : '确认地图标记'}</h3><p className="mt-0.5 text-[10px] text-blue-600">拖动地图上的蓝色标记可调整坐标</p></div><div className="flex items-center gap-1.5"><button type="button" onClick={() => setDraftExpanded(false)} className="rounded-full bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200">收起</button><button type="button" onClick={() => { setDraft(null); setEditingId(null); setDraftExpanded(false); setMessage(''); endPhotoMode(); }} className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={15} /></button></div></div>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">地点名称</span><input required value={draft.name ?? ''} onChange={(event) => updateDraft('name', event.target.value)} className={inputClass} /></label>
          <label><span className="mb-1 block text-[10px] font-bold text-slate-400">分类</span><select value={draft.category_id} onChange={(event) => updateDraft('category_id', event.target.value)} className={inputClass}>{(Object.keys(categoryLabels) as PlaceCategory[]).map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label>
          <label><span className="mb-1 block text-[10px] font-bold text-slate-400">门票</span><input value={draft.ticket_price ?? ''} onChange={(event) => updateDraft('ticket_price', event.target.value)} placeholder="如：80元" className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">地址</span><input value={draft.address ?? ''} onChange={(event) => updateDraft('address', event.target.value)} className={inputClass} /></label>
          <label><span className="mb-1 block text-[10px] font-bold text-slate-400">纬度</span><input type="number" step="any" required value={draft.latitude ?? ''} onChange={(event) => void reversePosition(Number(event.target.value), Number(draft.longitude))} className={`${inputClass} font-mono`} /></label>
          <label><span className="mb-1 block text-[10px] font-bold text-slate-400">经度</span><input type="number" step="any" required value={draft.longitude ?? ''} onChange={(event) => void reversePosition(Number(draft.latitude), Number(event.target.value))} className={`${inputClass} font-mono`} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">概览 / 核心亮点</span><textarea value={draft.summary ?? ''} onChange={(event) => updateDraft('summary', event.target.value)} rows={2} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">推荐玩法与路线</span><textarea value={draft.overview_route ?? ''} onChange={(event) => updateDraft('overview_route', event.target.value)} rows={2} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">游玩提示</span><textarea value={draft.overview_tips ?? ''} onChange={(event) => updateDraft('overview_tips', event.target.value)} rows={2} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">安全与避坑</span><textarea value={draft.safety_notes ?? ''} onChange={(event) => updateDraft('safety_notes', event.target.value)} rows={2} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">必备物品（每行一项）</span><textarea value={draft.packing_list ?? ''} onChange={(event) => updateDraft('packing_list', event.target.value)} rows={3} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">附近保障与补给</span><textarea value={draft.nearby_services ?? ''} onChange={(event) => updateDraft('nearby_services', event.target.value)} rows={2} className={inputClass} /></label>
          <label><span className="mb-1 block text-[10px] font-bold text-slate-400">最佳季节</span><input value={draft.best_season ?? ''} onChange={(event) => updateDraft('best_season', event.target.value)} className={inputClass} /></label>
          <label><span className="mb-1 block text-[10px] font-bold text-slate-400">建议时长</span><input value={draft.suggested_duration ?? ''} onChange={(event) => updateDraft('suggested_duration', event.target.value)} className={inputClass} /></label>
          <label className="col-span-2 flex items-center gap-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"><span><input type="checkbox" checked={Boolean(draft.has_parking)} onChange={(event) => updateDraft('has_parking', event.target.checked)} className="mr-1.5" />有停车条件</span><span><input type="checkbox" checked={Boolean(draft.recommended)} onChange={(event) => updateDraft('recommended', event.target.checked)} className="mr-1.5" />重点推荐</span></label>
        </div>
        {message && <p className="mt-2 text-[10px] font-semibold text-amber-600">{message}</p>}
        <button disabled={busy} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white disabled:opacity-50"><Check size={15} />{editingId ? '保存修改' : '保存并生成标记'}</button>
          </>
        )}
      </form>}

      {!draft && message && <div data-testid="map-message" className="absolute bottom-4 left-3 right-3 z-30 flex max-w-sm items-center gap-2 rounded-xl border border-slate-100 bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-md">
        <span className="truncate">{message}</span>
        {photoMode && <button type="button" data-testid="photo-draft-cancel" onClick={() => { endPhotoMode(); setMessage(''); }} className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 font-bold text-slate-500 hover:bg-slate-50">不关联照片</button>}
      </div>}
    </div>
  );
}
