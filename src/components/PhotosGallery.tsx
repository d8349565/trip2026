/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Media, Place, Trip, type MediaUploadInput } from '../types';
import { api } from '../api';
import { type PhotoExif } from '../utils/photoExif';
import { photoLocationFields, preparePhotoForUpload } from '../utils/photoUpload';
import { CATEGORY_OPTIONS } from '../utils/categories';
import { formatMediaDate, getMediaDateKey, sortMediaByDateDesc } from '../utils/mediaTimeline';
import { formatLocalDate } from '../utils/tripDates';
import {
  Camera, Trash2, Heart, Calendar, MapPin, UploadCloud, X,
  Clock, Compass, Info, ZoomIn, Star, Filter, Image as ImageIcon
} from 'lucide-react';

interface PhotosGalleryProps {
  media: Media[];
  places: Place[];
  trips: Trip[];
  onUploadMedia: (data: MediaUploadInput) => Promise<Media | void> | void;
  onDeleteMedia: (id: string) => void;
  onToggleFavoriteMedia: (id: string, fav: boolean) => void;
  onCreatePlaceFromPhoto: (seed: { mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string }) => void;
  onAutoCreatePlaceFromPhoto: (seed: { mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string; category_id?: string }) => void;
  initialSelectedPlaceId?: string | null;
}

export default function PhotosGallery({
  media,
  places,
  trips,
  onUploadMedia,
  onDeleteMedia,
  onToggleFavoriteMedia,
  onCreatePlaceFromPhoto,
  onAutoCreatePlaceFromPhoto,
  initialSelectedPlaceId
}: PhotosGalleryProps) {
  const [selectedPlaceId, setSelectedPlaceId] = useState(initialSelectedPlaceId || '');
  const [selectedTripId, setSelectedTripId] = useState('');
  const [photoFilter, setPhotoFilter] = useState<'all' | 'favorites'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<Media | null>(null);

  // Upload state
  const [uploadPlaceId, setUploadPlaceId] = useState('');
  const [uploadTripId, setUploadTripId] = useState('');
  const [uploadCapturedDate, setUploadCapturedDate] = useState(() => formatLocalDate(new Date()));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [pendingExif, setPendingExif] = useState<PhotoExif>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [photoPrompt, setPhotoPrompt] = useState<{ mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string; recognized: boolean } | null>(null);
  // 照片带 GPS 时，先让用户选地点类型再自动建点
  const [pendingCategorySeed, setPendingCategorySeed] = useState<{ mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string } | null>(null);

  // Sync initial selected place ID if redirected from other views
  useEffect(() => {
    if (initialSelectedPlaceId) {
      setSelectedPlaceId(initialSelectedPlaceId);
    }
  }, [initialSelectedPlaceId]);

  // Filters logic
  const filteredMedia = sortMediaByDateDesc(media.filter(m => {
      if (photoFilter === 'favorites' && !m.favorite) return false;
      if (selectedPlaceId && m.place_id !== selectedPlaceId) return false;
      if (selectedTripId && m.trip_id !== selectedTripId) return false;
      return true;
    }));

  // Group media by date
  const groupedMedia: Record<string, Media[]> = {};
  filteredMedia.forEach(photo => {
    const dateStr = getMediaDateKey(photo);
    if (!groupedMedia[dateStr]) {
      groupedMedia[dateStr] = [];
    }
    groupedMedia[dateStr].push(photo);
  });

  const sortedDates = Object.keys(groupedMedia).sort((a, b) => b.localeCompare(a));

  // Format Date for timeline node
  const formatTimelineDate = (dateStr: string) => formatMediaDate(dateStr);

  // Helper: check if a date matches any trip day, prioritizing trip_id if available
  const getTripDayLabel = (dateStr: string, dayPhotos?: Media[]) => {
    if (dayPhotos && dayPhotos.length > 0) {
      const photoWithTrip = dayPhotos.find(p => p.trip_id);
      if (photoWithTrip && photoWithTrip.trip_id) {
        const trip = trips.find(t => t.id === photoWithTrip.trip_id);
        if (trip) {
          const start = new Date(trip.start_date);
          const target = new Date(dateStr);
          if (!isNaN(start.getTime()) && !isNaN(target.getTime())) {
            const diffTime = target.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return {
              tripTitle: trip.title,
              dayNum: diffDays
            };
          }
        }
      }
    }

    for (const t of trips) {
      // Typically, trips would have start/end dates. We can estimate.
      const start = new Date(t.start_date);
      const target = new Date(dateStr);
      if (!isNaN(start.getTime()) && !isNaN(target.getTime())) {
        const diffTime = target.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays >= 1 && diffDays <= 10) { // arbitrary bound
          return {
            tripTitle: t.title,
            dayNum: diffDays
          };
        }
      }
    }
    return null;
  };

  // Handle local image file load & compress
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    allowBrowserLocationFallback = false,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    try {
      // Read EXIF from the original and compress via the shared pipeline.
      const prepared = await preparePhotoForUpload(file, { allowBrowserLocationFallback });
      setFileName(prepared.fileName);
      setFileSize(prepared.fileSize);
      setPendingExif(prepared.exif);
      if (prepared.exif.capturedAt) {
        setUploadCapturedDate(prepared.exif.capturedAt.split('T')[0]);
      }
      setPreviewUrl(prepared.dataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '照片处理失败，请重新选择。');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl || isUploading) return;
    setIsUploading(true);
    setUploadError('');

    // Auto-match trip if trip not set but date matches
    let finalTripId = uploadTripId;
    if (!finalTripId) {
      const matchedTrip = trips.find(t => {
        return uploadCapturedDate >= t.start_date && uploadCapturedDate <= t.end_date;
      });
      if (matchedTrip) {
        finalTripId = matchedTrip.id;
      }
    }

    try {
      const created = await onUploadMedia({
        filename: fileName,
        file_size: fileSize,
        dataUrl: previewUrl,
        place_id: uploadPlaceId || undefined,
        trip_id: finalTripId || undefined,
        captured_at: new Date(uploadCapturedDate).toISOString(),
        ...photoLocationFields(pendingExif),
      });

      // 上传后未手动关联地点：有 GPS 就自动建标记，无 GPS 才引导手动选点。
      if (created && !uploadPlaceId) {
        if (Number.isFinite(created.display_latitude) && Number.isFinite(created.display_longitude)) {
          let address = '';
          let name: string | undefined;
          try {
            const location = await api.reverseGeocode(created.display_latitude as number, created.display_longitude as number);
            address = location.address;
            name = location.name;
          } catch {
            // 坐标仍可用，自动建点时名称会回退为「照片拍摄点」。
          }
          // 先弹出分类选择，用户确认后再自动建点
          setPendingCategorySeed({
            mediaId: created.id,
            latitude: created.display_latitude,
            longitude: created.display_longitude,
            name,
            address,
          });
        } else {
          setPhotoPrompt({ mediaId: created.id, recognized: false });
        }
      }
      setPreviewUrl(null);
      setFileName('');
      setFileSize(0);
      setUploadPlaceId('');
      setUploadTripId('');
      setPendingExif({});
      setShowUploadModal(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败，请检查网络后重试。');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full overflow-hidden">
      {/* Photo location recognition prompt */}
      {photoPrompt && (
        <div data-testid="photo-place-prompt" className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 shrink-0">
          <MapPin size={16} className="text-blue-600 shrink-0" />
          <p className="min-w-0 flex-1 text-xs font-semibold text-blue-800">
            {photoPrompt.recognized
              ? `已识别拍摄地点：${photoPrompt.address || '地图位置'}。是否为这里创建标记点？`
              : (
                <>
                  这张照片未检测到位置信息，可以在地图上手动选点创建标记。
                  <span className="mt-1 block text-[10px] font-medium text-blue-500/90">
                    常见原因：手机系统分享照片时会抹掉位置（小米：相册设置 → 隐私保护 → 关闭「去除位置信息」）；微信内置浏览器上传也会抹掉位置。下次可试用「拍照上传」，相机直出保留位置。
                  </span>
                </>
              )}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              data-testid="photo-place-create"
              onClick={() => {
                onCreatePlaceFromPhoto({
                  mediaId: photoPrompt.mediaId,
                  latitude: photoPrompt.latitude,
                  longitude: photoPrompt.longitude,
                  name: photoPrompt.name,
                  address: photoPrompt.address
                });
                setPhotoPrompt(null);
              }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              {photoPrompt.recognized ? '去创建标记' : '去地图选点'}
            </button>
            <button
              onClick={() => setPhotoPrompt(null)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              忽略
            </button>
          </div>
        </div>
      )}

      {/* Photo Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-800">旅行照片 · 记忆足迹</h2>
          <p className="text-[11px] text-slate-500">通过时间轴编排展示全家自驾、溯溪及美食复盘大图。支持关联行程与具体地点。</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setUploadError('');
              setShowUploadModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/15"
          >
            <UploadCloud size={14} />
            <span>上传实地照片</span>
          </button>
        </div>
      </div>

      {/* Aesthetic Filters Row */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 bg-slate-50 p-3 rounded-2xl border border-slate-100 shrink-0">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/60 shadow-2xs">
          <button
            onClick={() => setPhotoFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              photoFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            全部归档 ({media.length})
          </button>
          <button
            onClick={() => setPhotoFilter('favorites')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              photoFilter === 'favorites'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-500 hover:text-amber-600'
            }`}
          >
            <Star size={11} fill={photoFilter === 'favorites' ? 'currentColor' : 'none'} />
            <span>精选珍藏 ({media.filter(m => m.favorite).length})</span>
          </button>
        </div>

        {/* Association Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Trip selection */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">关联行程</span>
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="text-xs p-2 bg-white border border-slate-200 rounded-xl outline-none max-w-[150px] font-medium"
            >
              <option value="">全部行程...</option>
              {trips.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          {/* Places selection */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">关联地点</span>
            <select
              value={selectedPlaceId}
              onChange={(e) => setSelectedPlaceId(e.target.value)}
              className="text-xs p-2 bg-white border border-slate-200 rounded-xl outline-none max-w-[150px] font-medium"
            >
              <option value="">全部标记点...</option>
              {places.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {(selectedPlaceId || selectedTripId) && (
            <button 
              onClick={() => { setSelectedPlaceId(''); setSelectedTripId(''); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 text-xs font-bold"
              title="重置过滤"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Timeline Scrollable Body */}
      <div className="flex-1 overflow-y-auto pr-1 py-2 scrollbar-thin">
        {sortedDates.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-2xl border border-slate-100 p-8 space-y-3 shadow-xs">
            <Camera size={36} className="mx-auto text-slate-300 animate-pulse" />
            <h4 className="font-bold text-slate-700 text-sm">暂未检索到旅行记忆</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              您尚未在此过滤条件下归档相册。请立即上传一张高像素、自动压缩、带GPS经纬度的美照吧！
            </p>
          </div>
        ) : (
          <div className="relative pl-4 sm:pl-8 border-l-2 border-slate-100 ml-4 sm:ml-8 space-y-10 py-4">
            {sortedDates.map((dateStr) => {
              const dayPhotos = groupedMedia[dateStr];
              const tripDayInfo = getTripDayLabel(dateStr, dayPhotos);

              return (
                <div key={dateStr} className="relative space-y-4 animate-in fade-in-50 duration-250">
                  {/* Timeline circular node marker */}
                  <div className="absolute -left-[25px] sm:-left-[41px] top-1.5 w-6 h-6 rounded-full bg-blue-50 border-4 border-blue-600 shadow-md flex items-center justify-center z-10">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  </div>

                  {/* Header node representing a specific Date group */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-100/60">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">
                        📅 {formatTimelineDate(dateStr)}
                      </h3>
                      {tripDayInfo && (
                        <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-black rounded-md shadow-3xs">
                          {tripDayInfo.tripTitle.substring(0, 4)}... Day {tripDayInfo.dayNum}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold tracking-wider">
                      该日归档照片 {dayPhotos.length} 张
                    </span>
                  </div>

                  {/* Photogrid under this Date */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {dayPhotos.map((photo) => {
                      const matchedPlace = places.find(p => p.id === photo.place_id);
                      const matchedTrip = trips.find(t => t.id === photo.trip_id);

                      return (
                        <div 
                          key={photo.id}
                          className="group relative bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col h-56 cursor-pointer"
                          onClick={() => setActiveLightboxPhoto(photo)}
                        >
                          {/* Image box */}
                          <div className="relative flex-1 bg-slate-950 overflow-hidden">
                            <img 
                              src={photo.file_path} 
                              alt={matchedPlace?.name || '旅行足迹照片'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />

                            {/* Top action bar buttons on hover */}
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => onToggleFavoriteMedia(photo.id, !photo.favorite)}
                                className={`p-1.5 rounded-lg backdrop-blur-md text-white transition-all ${
                                  photo.favorite ? 'bg-amber-500' : 'bg-slate-900/40 hover:bg-slate-900/60'
                                }`}
                                title={photo.favorite ? '取消精选' : '设为精选'}
                              >
                                <Heart size={11} fill={photo.favorite ? 'currentColor' : 'none'} />
                              </button>
                              <button
                                onClick={() => onDeleteMedia(photo.id)}
                                className="p-1.5 rounded-lg bg-slate-900/40 hover:bg-red-600 text-white backdrop-blur-md transition-all"
                                title="删除图片"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>

                            {/* Click to expand hover overlay */}
                            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="p-2 bg-white/90 rounded-full text-slate-800 shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-200">
                                <ZoomIn size={14} />
                              </span>
                            </div>

                            {/* Static banner badge if favorited */}
                            {photo.favorite && (
                              <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500 text-white rounded text-[8px] font-black tracking-wide shadow-sm">
                                ★ 精选
                              </span>
                            )}
                          </div>

                          {/* Footer details info */}
                          <div className="p-3 space-y-1.5 bg-white border-t border-slate-100 shrink-0">
                            {matchedPlace ? (
                              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 truncate">
                                <MapPin size={9} className="text-blue-500 shrink-0" />
                                <span className="truncate" title={matchedPlace.name}>{matchedPlace.name}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">📂 普通日常随拍</span>
                            )}
                            
                            {matchedTrip && (
                              <div className="text-[9px] text-slate-400 font-bold truncate">
                                📅 {matchedTrip.title}
                              </div>
                            )}

                            <div className="text-[8px] text-slate-400 font-medium">
                              {(photo.file_size / 1024).toFixed(0)} KB · 压缩原图已存
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FULLSCREEN LIGHTBOX DIALOG */}
      {activeLightboxPhoto && (() => {
        const matchedPlace = places.find(p => p.id === activeLightboxPhoto.place_id);
        const matchedTrip = trips.find(t => t.id === activeLightboxPhoto.trip_id);
        const dateString = activeLightboxPhoto.captured_at || activeLightboxPhoto.created_at;

        return (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-100 flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200">
            {/* Top Close Bar */}
            <div className="flex items-center justify-between text-white shrink-0 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Compass className="text-blue-400 animate-spin-slow" size={18} />
                <h4 className="text-xs font-black tracking-wide">旅行记忆原图复盘</h4>
              </div>
              <button 
                onClick={() => setActiveLightboxPhoto(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title="关闭大图"
              >
                <X size={18} />
              </button>
            </div>

            {/* Middle: Scaled Image viewport */}
            <div className="flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden">
              <img 
                src={activeLightboxPhoto.file_path} 
                alt="旅行大图"
                className="max-w-full max-h-[60vh] sm:max-h-[70vh] object-contain rounded-xl shadow-2xl border border-white/5"
              />
            </div>

            {/* Bottom Info Sheet with metadata info */}
            <div className="max-w-xl mx-auto w-full bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 text-white/90 space-y-3 shadow-2xl shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  {matchedPlace ? (
                    <div className="flex items-center gap-1.5 text-sm font-bold text-blue-300">
                      <MapPin size={13} fill="currentColor" />
                      <span>{matchedPlace.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-white/50 italic">日常/自驾随手拍</span>
                  )}
                  {matchedTrip && (
                    <p className="text-xs font-semibold text-white/70">
                      🚗 归属行程: <span className="font-bold text-white">{matchedTrip.title}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onToggleFavoriteMedia(activeLightboxPhoto.id, !activeLightboxPhoto.favorite);
                      setActiveLightboxPhoto(prev => prev ? { ...prev, favorite: !prev.favorite } : null);
                    }}
                    className={`p-2.5 rounded-xl border transition-all ${
                      activeLightboxPhoto.favorite
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Star size={14} fill={activeLightboxPhoto.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('确定要永久删除这张照片吗？此操作不可撤销')) {
                        onDeleteMedia(activeLightboxPhoto.id);
                        setActiveLightboxPhoto(null);
                      }
                    }}
                    className="p-2.5 rounded-xl bg-red-600/20 border border-red-500/30 hover:bg-red-600 text-red-200 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Photo statistics / fake EXIF log details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-white/10 text-[10px] text-white/60">
                <div className="flex items-center gap-1.5">
                  <Clock size={11} className="text-white/30" />
                  <span>拍摄时间: {dateString.replace('T', ' ').substring(0, 16)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Info size={11} className="text-white/30" />
                  <span>大小: {(activeLightboxPhoto.file_size / 1024).toFixed(0)} KB (压缩格式)</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                  <Compass size={11} className="text-white/30" />
                  <span>地理位置: {matchedPlace ? `${matchedPlace.latitude.toFixed(4)}, ${matchedPlace.longitude.toFixed(4)}` : (Number.isFinite(activeLightboxPhoto.display_latitude) && Number.isFinite(activeLightboxPhoto.display_longitude) ? `${activeLightboxPhoto.display_latitude!.toFixed(4)}, ${activeLightboxPhoto.display_longitude!.toFixed(4)}（未创建标记）` : '无 EXIF 经纬度')}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CATEGORY PICKER — 照片带 GPS 时先选地点类型再自动建点 */}
      {pendingCategorySeed && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm">📍 这是什么类型的地点？</h4>
              <button
                onClick={() => {
                  onAutoCreatePlaceFromPhoto({ ...pendingCategorySeed, category_id: 'scenic' });
                  setPendingCategorySeed(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                title="跳过，默认按景点处理"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              已识别拍摄位置：<span className="font-bold text-slate-700">{pendingCategorySeed.name || pendingCategorySeed.address || '地图位置'}</span>。选择一个分类后会自动在地图上建立标记。
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onAutoCreatePlaceFromPhoto({ ...pendingCategorySeed, category_id: cat.id });
                    setPendingCategorySeed(null);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-slate-700 transition-all hover:border-blue-400 hover:bg-blue-50 hover:scale-[1.03] active:scale-95"
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[11px] font-bold">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD DIALOG POPOVER */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm">📸 上传精选旅行实景照片</h4>
              <button 
                aria-label="关闭照片上传"
                onClick={() => {
                  setPreviewUrl(null);
                  setUploadError('');
                  setShowUploadModal(false);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {uploadError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold leading-relaxed text-rose-700">
                  {uploadError}
                </p>
              )}
              {/* File Dropzone */}
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">选取照片文件</label>
                {previewUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 h-44 bg-slate-50 flex items-center justify-center">
                    <img src={previewUrl} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(null)}
                      className="absolute top-2 right-2 p-1 bg-slate-900/65 hover:bg-slate-950 text-white rounded-full"
                    >
                      <X size={14} />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-slate-900/70 text-white px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm">
                      {fileName} ({(fileSize/1024).toFixed(0)} KB)
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-200 rounded-xl h-36 bg-blue-50/60 hover:bg-blue-100/50 hover:border-blue-300 cursor-pointer transition-all">
                      <Camera size={28} className="text-blue-500 mb-1" />
                      <span className="text-xs font-bold text-blue-700">拍照上传</span>
                      <span className="text-[10px] text-blue-400 mt-1 text-center leading-tight px-2">调用摄像头直出，保留位置信息</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => void handleFileChange(event, true)}
                        className="hidden"
                      />
                    </label>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl h-36 bg-slate-50 hover:bg-slate-100/50 hover:border-slate-300 cursor-pointer transition-all">
                      <UploadCloud size={28} className="text-slate-400 mb-1" />
                      <span className="text-xs font-bold text-slate-600">选择照片文件</span>
                      <span className="text-[10px] text-slate-400 mt-1 text-center leading-tight px-2">JPG / PNG 原图，自动压缩存储</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => void handleFileChange(event, false)}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">拍摄日期</label>
                <input 
                  type="date"
                  value={uploadCapturedDate}
                  onChange={(e) => setUploadCapturedDate(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Trip linkage */}
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">关联行程 (可选)</label>
                  <select
                    value={uploadTripId}
                    onChange={(e) => setUploadTripId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="">自动根据日期识别...</option>
                    {trips.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>

                {/* Place linkage */}
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">关联地图地点 (可选)</label>
                  <select
                    value={uploadPlaceId}
                    onChange={(e) => setUploadPlaceId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="">不关联 / 日常随拍...</option>
                    {places.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null);
                    setShowUploadModal(false);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!previewUrl || isUploading}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md disabled:bg-slate-100 disabled:text-slate-400 hover:bg-blue-700 transition-colors"
                >
                  {isUploading ? '正在上传并识别位置…' : '确认保存上传'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
