/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Media, Place, Trip } from '../types';
import { 
  Camera, Trash2, Heart, Calendar, MapPin, UploadCloud, X, 
  Clock, Compass, Info, ZoomIn, Star, Filter, Image as ImageIcon
} from 'lucide-react';

interface PhotosGalleryProps {
  media: Media[];
  places: Place[];
  trips: Trip[];
  onUploadMedia: (data: { filename: string; file_size: number; dataUrl: string; place_id?: string; trip_id?: string; captured_at?: string }) => void;
  onDeleteMedia: (id: string) => void;
  onToggleFavoriteMedia: (id: string, fav: boolean) => void;
  initialSelectedPlaceId?: string | null;
}

export default function PhotosGallery({
  media,
  places,
  trips,
  onUploadMedia,
  onDeleteMedia,
  onToggleFavoriteMedia,
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
  const [uploadCapturedDate, setUploadCapturedDate] = useState(new Date().toISOString().split('T')[0]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);

  // Sync initial selected place ID if redirected from other views
  useEffect(() => {
    if (initialSelectedPlaceId) {
      setSelectedPlaceId(initialSelectedPlaceId);
    }
  }, [initialSelectedPlaceId]);

  // Filters logic
  const filteredMedia = media
    .filter(m => {
      if (photoFilter === 'favorites' && !m.favorite) return false;
      if (selectedPlaceId && m.place_id !== selectedPlaceId) return false;
      if (selectedTripId && m.trip_id !== selectedTripId) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = a.captured_at || a.created_at;
      const dateB = b.captured_at || b.created_at;
      return dateB.localeCompare(dateA); // Chronological descending (newest first)
    });

  // Group media by date
  const groupedMedia: Record<string, Media[]> = {};
  filteredMedia.forEach(photo => {
    const dateStr = (photo.captured_at || photo.created_at).substring(0, 10);
    if (!groupedMedia[dateStr]) {
      groupedMedia[dateStr] = [];
    }
    groupedMedia[dateStr].push(photo);
  });

  const sortedDates = Object.keys(groupedMedia).sort((a, b) => b.localeCompare(a));

  // Format Date for timeline node
  const formatTimelineDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      return `${months[d.getMonth()]}${d.getDate()}日`;
    } catch {
      return dateStr;
    }
  };

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
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadAndCompressFile(file);
  };

  const loadAndCompressFile = (file: File) => {
    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPreviewUrl(dataUrl);
      };
      img.src = uploadEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl) return;

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

    onUploadMedia({
      filename: fileName,
      file_size: fileSize,
      dataUrl: previewUrl,
      place_id: uploadPlaceId || undefined,
      trip_id: finalTripId || undefined,
      captured_at: new Date(uploadCapturedDate).toISOString()
    });

    setPreviewUrl(null);
    setFileName('');
    setFileSize(0);
    setUploadPlaceId('');
    setUploadTripId('');
    setShowUploadModal(false);
  };

  return (
    <div className="space-y-6 flex flex-col h-full overflow-hidden">
      {/* Photo Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-800">旅行照片 · 记忆足迹</h2>
          <p className="text-[11px] text-slate-500">通过时间轴编排展示全家自驾、溯溪及美食复盘大图。支持关联行程与具体地点。</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowUploadModal(true)}
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
                  <span>地理位置: {matchedPlace ? `${matchedPlace.latitude.toFixed(4)}, ${matchedPlace.longitude.toFixed(4)}` : '无 EXIF 经纬度'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* UPLOAD DIALOG POPOVER */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm">📸 上传精选旅行实景照片</h4>
              <button 
                onClick={() => {
                  setPreviewUrl(null);
                  setShowUploadModal(false);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
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
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl h-36 bg-slate-50 hover:bg-slate-100/50 hover:border-slate-300 cursor-pointer transition-all">
                    <UploadCloud size={28} className="text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-600">点击上传或拖拽文件到这里</span>
                    <span className="text-[10px] text-slate-400 mt-1">支持 JPG / PNG，系统自动高速压缩在 1MB 内</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                  </label>
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
                  disabled={!previewUrl}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md disabled:bg-slate-100 disabled:text-slate-400 hover:bg-blue-700 transition-colors"
                >
                  确认保存上传
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
