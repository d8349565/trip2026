/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Crosshair, Edit3, Heart, Link2, LocateFixed, MapPin, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { api, type AmapPoi } from '../api';
import { describeBrowserLocationFailure, getBestBrowserLocation } from '../utils/browserLocation';
import { wgs84ToGcj02 } from '../utils/coords';
import { confirmedPhotoLocationFields } from '../utils/photoUpload';
import type { Place, PlaceCategory, Media, MediaUploadInput } from '../types';

/** 一张「本地已处理、尚未落库」的照片，等待用户在地图上确认位置与归属后一并保存。 */
export interface PendingPhotoUpload {
  token: number;
  fileName: string;
  fileSize: number;
  dataUrl: string;
  capturedAt?: string;
  /** 原始 EXIF/定位坐标，WGS84，保存时原样传给服务器。 */
  wgsLat?: number;
  wgsLng?: number;
  /** 客户端换算后的 GCJ-02 坐标，供地图标记与反查使用。 */
  gcjLat?: number;
  gcjLng?: number;
  locationSource?: 'exif' | 'xmp' | 'browser';
  locationAccuracyM?: number;
  locationObservedAt?: string;
  name?: string;
  address?: string;
}

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
  /** 待一并保存的照片（照片尚未落库）；存在时进入「确认位置+归属」模式。 */
  photoUpload?: PendingPhotoUpload | null;
  /** 确认流程结束：saved=已保存（留地图），cancel=放弃（回照片页）。 */
  onPhotoUploadDone?: (result: 'saved' | 'cancel') => void;
  /** 把照片落库（可带 place_id），内部应刷新数据。 */
  onSavePhoto?: (data: MediaUploadInput) => Promise<Media | undefined>;
  /** 手机端定位按钮通过递增 token 触发地图重新定位。 */
  locateRequest?: number;
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
  setFitView: (
    overlays?: unknown[],
    immediately?: boolean,
    avoid?: [number, number, number, number],
    maxZoom?: number,
  ) => void;
  on: (event: string, handler: (event: AMapEvent) => void) => void;
  containerToLngLat: (pixel: { getX?: () => number; getY?: () => number }) => AMapLngLat | null;
};
type AMapGlobal = {
  Map: new (container: HTMLDivElement, options: Record<string, unknown>) => AMapInstance;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
};

interface MyLocationState {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  source: 'browser' | 'manual';
  observedAt: string;
  address?: string;
  name?: string;
}

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
  if (!places.length) return [104.2, 35.9];
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
  photoUpload = null,
  onPhotoUploadDone,
  onSavePhoto,
  locateRequest = 0,
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
  // 「照片待保存」模式：照片尚未落库，确认位置+归属后与地点一并保存。
  const [uploadModeActive, setUploadModeActive] = useState(false);
  const uploadModeRef = useRef(false);
  // 上传确认时的归属选择：新建地点 / 并入已有 / 仅保存照片。
  const [attribMode, setAttribMode] = useState<'new' | 'existing' | 'none'>('new');
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [existingQuery, setExistingQuery] = useState('');
  const [myLocation, setMyLocation] = useState<MyLocationState | null>(null);
  const myLocMarkerRef = useRef<unknown | undefined>(undefined);
  const initialFitDoneRef = useRef(false);
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
  // Track whether the draft name was auto-filled by the system (POI search / reverse geocode)
  // vs. manually typed by the user. Only auto-filled names get overwritten on marker drag.
  const nameAutoFilledRef = useRef(true);

  const fitAllPlaces = () => {
    const map = mapRef.current;
    if (!map || markersRef.current.length === 0) return;
    const mobile = (rootRef.current?.clientWidth ?? 0) < 640;
    map.setFitView(
      markersRef.current,
      false,
      mobile ? [150, 36, 120, 36] : [72, 72, 72, 72],
      15,
    );
  };

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
        ? { ...current, ...fields, ...(nameAutoFilledRef.current && name ? { name } : {}) }
        : current);
    } catch {
      setMessage('坐标已更新，但地址反查失败；可手动修改地址。');
    }
  };

  const startDraftAt = (latitude: number, longitude: number, seed: Partial<Place> = {}) => {
    setEditingId(null);
    setContextMenu(null);
    setMessage('拖动蓝色标记可微调位置，保存前地图始终可见。');
    nameAutoFilledRef.current = true;
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
    nameAutoFilledRef.current = true;
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
    if (!photoUpload) return;
    // 进入「照片待保存」模式：照片尚未落库，确认位置+归属后一并保存。
    uploadModeRef.current = true;
    setUploadModeActive(true);
    setEditingId(null);
    setContextMenu(null);
    setDraftExpanded(true);
    setAttribMode('new');
    setSelectedExistingId(null);
    setExistingQuery('');
    const { gcjLat, gcjLng, name, address } = photoUpload;
    if (Number.isFinite(gcjLat) && Number.isFinite(gcjLng)) {
      startDraftAt(gcjLat as number, gcjLng as number, { name: name ?? '', address: address ?? '' });
      setMessage('已按照片位置预填标记，可拖动微调；选择归属后点保存，照片将一并存入。');
    } else {
      setDraft({ ...EMPTY_DRAFT, name: name ?? '', address: address ?? '' });
      setMessage('这张照片没有位置信息：手机长按、电脑双击地图选择拍摄位置，再选归属保存。');
    }
  }, [photoUpload?.token]);

  useEffect(() => {
    let disposed = false;
    loadAmap().then((AMap) => {
      if (disposed || !containerRef.current) return;
      const map = new AMap.Map(containerRef.current, {
        center: initialCenterRef.current,
        zoom: places.length === 0 ? 4 : places.length > 1 ? 11 : 13,
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
      // 若进入地图时已带有待确认坐标，先把视图定位过去。
      // 优先照片待保存的 GCJ 坐标，其次旧 photoDraft 坐标。
      // MapContainer 仅在 map 视图挂载（条件渲染），首次渲染闭包即可拿到这些 prop。
      const uploadCoord = photoUpload && Number.isFinite(photoUpload.gcjLat) && Number.isFinite(photoUpload.gcjLng)
        ? { latitude: photoUpload.gcjLat, longitude: photoUpload.gcjLng }
        : null;
      const draftCoord = uploadCoord ?? photoDraft;
      const hasDraftCoord = !!draftCoord && Number.isFinite(draftCoord.latitude) && Number.isFinite(draftCoord.longitude);
      if (hasDraftCoord) {
        map.setZoomAndCenter(16, [draftCoord.longitude as number, draftCoord.latitude as number]);
      } else {
        // 仅恢复近期、明确来自浏览器或手动微调的位置。首次打开不主动请求定位，
        // 避免权限失败或网络出口变化导致地图无故跳转。
        const saved = (() => {
          try { return JSON.parse(localStorage.getItem(MY_LOCATION_KEY) ?? 'null'); } catch { return null; }
        })();
        const savedAt = typeof saved?.observedAt === 'string' ? new Date(saved.observedAt).getTime() : NaN;
        const isRecent = Number.isFinite(savedAt) && Date.now() - savedAt <= 10 * 60_000;
        if (saved && isRecent
          && (saved.source === 'browser' || saved.source === 'manual')
          && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) {
          applyMyLocation(saved as MyLocationState, undefined, false);
          void refreshMyLocationAddress(saved.latitude, saved.longitude);
        }
      }
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
        <span class="relative inline-flex transition-transform ${selected ? 'scale-125' : 'hover:scale-110'}">
          <span class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white text-lg shadow-lg ${selected ? 'ring-4 ring-blue-400/40' : 'bg-white'}">
            ${iconInner}
          </span>
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
    if (!initialFitDoneRef.current && markersRef.current.length > 0) {
      initialFitDoneRef.current = true;
      requestAnimationFrame(fitAllPlaces);
    }
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
      applyMyLocation({
        latitude,
        longitude,
        source: 'manual',
        observedAt: new Date().toISOString(),
      });
      void refreshMyLocationAddress(latitude, longitude);
      setMessage('已手动调整当前位置，可继续拖动蓝点微调。');
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

  const applyMyLocation = (location: MyLocationState, zoom?: number, persist = true) => {
    setMyLocation((current) => current
      && current.latitude === location.latitude
      && current.longitude === location.longitude
      && current.accuracyM === location.accuracyM
      ? { ...current, ...location }
      : location);
    if (persist) {
      try {
        localStorage.setItem(MY_LOCATION_KEY, JSON.stringify(location));
      } catch { /* storage unavailable */ }
    }
    if (zoom) mapRef.current?.setZoomAndCenter(zoom, [location.longitude, location.latitude]);
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

  // 只接受浏览器设备定位。失败时保持当前视野，不使用网络出口 IP 猜测位置。
  const locateAndCenter = async () => {
    setMessage('正在获取高精度位置…');
    const result = await getBestBrowserLocation();
    if (result.ok) {
      const { latitude, longitude } = wgs84ToGcj02(result.fix.latitude, result.fix.longitude);
      applyMyLocation({
        latitude,
        longitude,
        accuracyM: result.fix.accuracyM,
        source: 'browser',
        observedAt: result.fix.observedAt,
      }, 16);
      void refreshMyLocationAddress(latitude, longitude);
      setMessage(`定位完成，当前精度约 ±${Math.round(result.fix.accuracyM)} 米；可拖动蓝点微调。`);
      return;
    }

    const failureMessage = describeBrowserLocationFailure(
      'reason' in result ? result.reason : 'position-unavailable',
    );
    setMessage(failureMessage);
  };

  useEffect(() => {
    if (!ready || !locateRequest) return;
    void locateAndCenter();
  }, [locateRequest, ready]);

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
    nameAutoFilledRef.current = true;
    setEditingId(place.id);
    setDraft({ ...place });
    setContextMenu(null);
    setMessage('手机GPS定位常有偏差：拖动蓝色标记到准确位置，再保存。');
    mapRef.current?.setZoomAndCenter(16, [place.longitude, place.latitude]);
  };

  const deletePlace = async (place: Pick<Place, 'id' | 'name'>) => {
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
    if (uploadModeActive) {
      await savePhotoUpload();
      return;
    }
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

  // 照片待保存模式的一次性保存：按需新建/并入地点，再把照片落库（带 place_id）。
  const savePhotoUpload = async () => {
    const pu = photoUpload;
    if (!pu || !onSavePhoto) return;
    let placeId: string | undefined;
    if (attribMode === 'new') {
      const d = draft;
      if (!d?.name?.trim() || !Number.isFinite(d.latitude) || !Number.isFinite(d.longitude)) {
        setMessage('请填写地点名称，并在地图上确认坐标。');
        return;
      }
      setBusy(true);
      setMessage('');
      try {
        const created = await onCreatePlace({
          name: d.name.trim(),
          category_id: d.category_id ?? 'scenic',
          latitude: d.latitude as number,
          longitude: d.longitude as number,
          coordinate_system: 'GCJ02',
          address: d.address ?? '',
        });
        placeId = created.id;
      } catch (cause) {
        setBusy(false);
        setMessage(cause instanceof Error ? cause.message : '地点创建失败');
        return;
      }
    } else if (attribMode === 'existing') {
      if (!selectedExistingId) {
        setMessage('请选择要并入的已有地点。');
        return;
      }
      placeId = selectedExistingId;
      setBusy(true);
      setMessage('');
    } else {
      setBusy(true);
      setMessage('');
    }
    try {
      const location = confirmedPhotoLocationFields(pu, {
        latitude: draft?.latitude,
        longitude: draft?.longitude,
      });
      await onSavePhoto({
        filename: pu.fileName,
        file_size: pu.fileSize,
        dataUrl: pu.dataUrl,
        place_id: placeId,
        captured_at: pu.capturedAt,
        ...location,
      });
      setDraft(null);
      setEditingId(null);
      setDraftExpanded(false);
      setAttribMode('new');
      setSelectedExistingId(null);
      setExistingQuery('');
      uploadModeRef.current = false;
      setUploadModeActive(false);
      setMessage('');
      onPhotoUploadDone?.('saved');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '照片保存失败');
    } finally {
      setBusy(false);
    }
  };

  // 关闭照片相关流程：上传模式=放弃（照片不存，回照片页），旧 photoDraft 模式=结束关联。
  const closePhotoFlow = () => {
    const wasUpload = uploadModeActive;
    setDraft(null);
    setEditingId(null);
    setDraftExpanded(false);
    setMessage('');
    setAttribMode('new');
    setSelectedExistingId(null);
    setExistingQuery('');
    if (wasUpload) {
      uploadModeRef.current = false;
      setUploadModeActive(false);
      onPhotoUploadDone?.('cancel');
    } else {
      endPhotoMode();
    }
  };

  const updateDraft = (field: keyof Place, value: unknown) => {
    if (field === 'name') nameAutoFilledRef.current = false;
    setDraft((current) => current ? { ...current, [field]: value } : current);
  };
  const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-base outline-none focus:border-blue-400 sm:text-xs';

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100" onClick={() => setContextMenu(null)}>
      <div ref={containerRef} className="absolute inset-0" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label="高德地图" />

      {!ready && !error && <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">正在加载高德地图…</div>}
      {error && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-50 px-6 text-center"><p className="font-bold text-red-600">{error}</p><p className="mt-2 text-xs text-slate-500">请检查 Key 类型、安全密钥和域名配置。</p></div>}

      <div className="absolute left-3 right-3 top-3 z-40 max-w-md sm:right-16" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center rounded-2xl border border-white/50 bg-white/75 p-1 shadow-[0_2px_24px_-4px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.02)] backdrop-blur-xl">
          {searchMode === 'poi' ? <form onSubmit={searchPoi} className="flex min-w-0 flex-1 items-center gap-1">
            <Search size={15} className="ml-2.5 shrink-0 text-slate-300" />
            <input ref={searchInputRef} data-testid="map-poi-search" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="在地图上搜索地点…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-300" />
            <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="城市" className="hidden w-20 rounded-lg bg-slate-50 px-2 text-[11px] outline-none sm:block" />
            <button disabled={busy} className="rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-blue-500/25 disabled:opacity-50 active:scale-[0.97] transition-all">搜索</button>
          </form> : <form onSubmit={resolveShare} className="flex min-w-0 flex-1 items-center gap-1">
            <Link2 size={15} className="ml-2.5 shrink-0 text-slate-300" />
            <input value={shareUrl} onChange={(event) => setShareUrl(event.target.value)} placeholder="粘贴高德或百度地图分享链接…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-300" />
            <button disabled={busy} className="rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-blue-500/25 disabled:opacity-50 active:scale-[0.97] transition-all">解析</button>
          </form>}
          <button type="button" onClick={() => { setSearchMode((current) => current === 'poi' ? 'share' : 'poi'); setPois([]); }} className="ml-0.5 rounded-xl p-2 text-slate-400 hover:bg-slate-100/80 hover:text-slate-600 active:scale-95 transition-all" title={searchMode === 'poi' ? '粘贴地图分享链接' : '搜索高德地点'}>{searchMode === 'poi' ? <Link2 size={15} /> : <Search size={15} />}</button>
          <button type="button" onClick={() => { setMessage('请在地图目标位置双击，随后可拖动蓝色标记微调。'); searchInputRef.current?.blur(); }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100/80 hover:text-slate-600 active:scale-95 transition-all" title="手动地图选点"><MapPin size={15} /></button>
        </div>

        {searchSlot && <div className="mt-2" onClick={(event) => event.stopPropagation()}>{searchSlot}</div>}

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
        <button onClick={fitAllPlaces} className="rounded-xl border bg-white p-2.5 text-slate-600 shadow-lg" title="显示全部地点"><LocateFixed size={18} /></button>
        <button onClick={() => void locateAndCenter()} className="rounded-xl border bg-white p-2.5 text-slate-600 shadow-lg" title="定位到当前位置"><Crosshair size={18} /></button>
      </div>

      {contextMenu && <div data-testid="marker-context-menu" style={{ left: Math.min(contextMenu.x, (rootRef.current?.clientWidth ?? 300) - 150), top: Math.min(contextMenu.y, (rootRef.current?.clientHeight ?? 300) - 100) }} className="absolute z-50 w-36 overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <p className="truncate px-2 py-1 text-[10px] font-bold text-slate-400">{contextMenu.place.name}</p>
        <button onClick={() => editPlace(contextMenu.place)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100"><Edit3 size={14} />编辑地点</button>
        <button onClick={() => void deletePlace(contextMenu.place)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={14} />删除地点</button>
      </div>}

      {draft && <form data-testid="map-place-editor" onSubmit={savePlace} onClick={(event) => event.stopPropagation()} className={`absolute left-3 right-3 z-40 overflow-hidden rounded-2xl border border-slate-100 bg-white/98 shadow-2xl backdrop-blur-md transition-all duration-300 ${draftExpanded ? 'bottom-3 max-h-[70vh] overflow-y-auto p-4 max-sm:bottom-auto max-sm:top-[18%] max-sm:max-h-[64vh]' : 'bottom-3 p-3 max-sm:bottom-auto max-sm:top-[38%]'}`}>
        {/* 收起态：一行紧凑操作栏，地图全露 */}
        {!draftExpanded ? (
          <div className="flex items-center gap-2">
            <input aria-label="地点名称" required value={draft.name ?? ''} onChange={(event) => updateDraft('name', event.target.value)} placeholder="地点名称" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-base outline-none focus:border-blue-400 sm:min-h-0 sm:text-xs" />
            <button type="button" onClick={() => setDraftExpanded(true)} className="min-h-11 shrink-0 rounded-lg bg-slate-100 px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-200 sm:min-h-0">填写</button>
            <button disabled={busy} type="submit" className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 sm:min-h-0"><Check size={13} />保存</button>
            {editingId && <button type="button" onClick={() => void deletePlace({ id: editingId, name: draft.name ?? '' })} title="删除地点" className="shrink-0 rounded-lg bg-red-50 p-2 text-red-500 hover:bg-red-100 active:scale-95 transition-all"><Trash2 size={14} /></button>}
            <button aria-label="取消地点录入" type="button" onClick={() => { setDraft(null); setEditingId(null); setMessage(''); endPhotoMode(); }} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 sm:min-h-0 sm:min-w-0"><X size={14} /></button>
          </div>
        ) : (
          <>
        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-black text-slate-800">{editingId ? '编辑地点' : '确认地图标记'}</h3><p className="mt-0.5 text-[10px] text-blue-600">{editingId ? '修改地点资料，拖动蓝色标记可调整坐标' : '先保存基本信息，详细资料可稍后编辑'}</p></div><div className="flex items-center gap-1.5"><button type="button" onClick={() => setDraftExpanded(false)} className="min-h-11 rounded-full bg-slate-100 px-3 text-[10px] font-bold text-slate-500 hover:bg-slate-200 sm:min-h-0 sm:px-2.5 sm:py-1.5">收起</button><button aria-label="取消地点录入" type="button" onClick={() => { setDraft(null); setEditingId(null); setDraftExpanded(false); setMessage(''); endPhotoMode(); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-100 p-2 text-slate-500 sm:min-h-0 sm:min-w-0"><X size={15} /></button></div></div>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">地点名称</span><input required value={draft.name ?? ''} onChange={(event) => updateDraft('name', event.target.value)} className={inputClass} /></label>
          <label className={editingId ? '' : 'col-span-2'}><span className="mb-1 block text-[10px] font-bold text-slate-400">分类</span><select value={draft.category_id} onChange={(event) => updateDraft('category_id', event.target.value)} className={inputClass}>{(Object.keys(categoryLabels) as PlaceCategory[]).map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label>
          {editingId && <label><span className="mb-1 block text-[10px] font-bold text-slate-400">门票</span><input value={draft.ticket_price ?? ''} onChange={(event) => updateDraft('ticket_price', event.target.value)} placeholder="如：80元" className={inputClass} /></label>}
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">地址</span><input value={draft.address ?? ''} onChange={(event) => updateDraft('address', event.target.value)} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">概览 / 核心亮点</span><textarea value={draft.summary ?? ''} onChange={(event) => updateDraft('summary', event.target.value)} rows={2} className={inputClass} /></label>
          {editingId && <>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">纬度</span><input type="number" step="any" required value={draft.latitude ?? ''} onChange={(event) => void reversePosition(Number(event.target.value), Number(draft.longitude))} className={`${inputClass} font-mono`} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">经度</span><input type="number" step="any" required value={draft.longitude ?? ''} onChange={(event) => void reversePosition(Number(draft.latitude), Number(event.target.value))} className={`${inputClass} font-mono`} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">推荐玩法与路线</span><textarea value={draft.overview_route ?? ''} onChange={(event) => updateDraft('overview_route', event.target.value)} rows={2} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">游玩提示</span><textarea value={draft.overview_tips ?? ''} onChange={(event) => updateDraft('overview_tips', event.target.value)} rows={2} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">安全与避坑</span><textarea value={draft.safety_notes ?? ''} onChange={(event) => updateDraft('safety_notes', event.target.value)} rows={2} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">必备物品（每行一项）</span><textarea value={draft.packing_list ?? ''} onChange={(event) => updateDraft('packing_list', event.target.value)} rows={3} className={inputClass} /></label>
          <label className="col-span-2"><span className="mb-1 block text-[10px] font-bold text-slate-400">附近保障与补给</span><textarea value={draft.nearby_services ?? ''} onChange={(event) => updateDraft('nearby_services', event.target.value)} rows={2} className={inputClass} /></label>
          <label><span className="mb-1 block text-[10px] font-bold text-slate-400">最佳季节</span><input value={draft.best_season ?? ''} onChange={(event) => updateDraft('best_season', event.target.value)} className={inputClass} /></label>
          <label><span className="mb-1 block text-[10px] font-bold text-slate-400">建议时长</span><input value={draft.suggested_duration ?? ''} onChange={(event) => updateDraft('suggested_duration', event.target.value)} className={inputClass} /></label>
          <label className="col-span-2 flex items-center gap-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"><span><input type="checkbox" checked={Boolean(draft.has_parking)} onChange={(event) => updateDraft('has_parking', event.target.checked)} className="mr-1.5" />有停车条件</span><span><input type="checkbox" checked={Boolean(draft.recommended)} onChange={(event) => updateDraft('recommended', event.target.checked)} className="mr-1.5" />重点推荐</span></label>
          </>}
        </div>
        {message && <p className="mt-2 text-[10px] font-semibold text-amber-600">{message}</p>}
        <button disabled={busy} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white disabled:opacity-50"><Check size={15} />{editingId ? '保存修改' : '保存并生成标记'}</button>
        {editingId && <button type="button" onClick={() => void deletePlace({ id: editingId, name: draft.name ?? '' })} disabled={busy} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-600 disabled:opacity-50 active:scale-[0.99] transition-all"><Trash2 size={14} />删除此地点</button>}
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
