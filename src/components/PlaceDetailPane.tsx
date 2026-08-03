/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { IMAGE_PLACEHOLDER, MapLocation, Place, Trip, TripDay, Media, Guide, TripItem, Visit, type MediaUploadInput } from '../types';
import { photoLocationFields, preparePhotoForUpload } from '../utils/photoUpload';
import { calculateDistanceKm } from '../utils/distance';
import { pickPlaceCover } from '../utils/placeCover';
import { 
  Heart, CheckSquare, Star, MapPin, AlertTriangle, Lightbulb, 
  Layers, ChevronRight, X, Image as ImageIcon, Sparkles, Clock, 
  DollarSign, Compass, CalendarPlus, Check, User, BookOpen,
  Plus, Calendar, Cloud, CloudRain, Users, PenSquare, Upload, Trash
} from 'lucide-react';

interface PlaceDetailPaneProps {
  place: Place;
  trips: Trip[];
  tripDays: TripDay[];
  tripItems?: TripItem[];
  media?: Media[];
  guides?: Guide[];
  visits?: Visit[]; // added
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onToggleVisited: (id: string) => void;
  onAddToTrip: (placeId: string, tripDayId: string, type: string, time: string, note: string) => void | Promise<void>;
  categoryColors: Record<string, { bg: string; text: string; iconBg: string; border: string }>;
  categoryLabels: Record<string, string>;
  onNavigateToView?: (view: 'map' | 'trip' | 'photos' | 'checklist' | 'guide', id?: string) => void;
  onCreateVisit?: (visit: Partial<Visit>) => Promise<void>; // added
  onCreateGuide?: (guide: Partial<Guide>) => Promise<void>; // added
  onUploadPhoto?: (photoData: MediaUploadInput & { place_id: string }) => Promise<unknown>; // added
  onEditPlace?: (place: Place) => void;
  onSetCover?: (placeId: string, photoUrl: string) => void;
  userLocation?: MapLocation | null;
}

export default function PlaceDetailPane({
  place,
  trips,
  tripDays,
  tripItems = [],
  media = [],
  guides = [],
  visits = [],
  onClose,
  onToggleFavorite,
  onToggleVisited,
  onAddToTrip,
  categoryColors,
  categoryLabels,
  onNavigateToView,
  onCreateVisit,
  onCreateGuide,
  onUploadPhoto,
  onEditPlace,
  onSetCover,
  userLocation = null,
}: PlaceDetailPaneProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'guide' | 'photos' | 'visit'>('overview');
  const [lightboxPhoto, setLightboxPhoto] = useState<Media | null>(null);
  const [showAddTripModal, setShowAddTripModal] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [selectedDayId, setSelectedDayId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [scheduledNote, setScheduledNote] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  // Guide creation form state
  const [showAddGuideForm, setShowAddGuideForm] = useState(false);
  const [guideTitle, setGuideTitle] = useState('');
  const [guideSource, setGuideSource] = useState('原创记录');
  const [guideContent, setGuideContent] = useState('');
  const [guideSuccess, setGuideSuccess] = useState(false);
  const [actionError, setActionError] = useState('');

  // Photo upload form state
  const [uploadProgress, setUploadProgress] = useState(false);
  const [fileError, setFileError] = useState('');
  const [showPhotoForm, setShowPhotoForm] = useState(false);

  // Visit creation form state
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitCompanions, setVisitCompanions] = useState('全家自驾');
  const [visitWeather, setVisitWeather] = useState('☀️ 晴');
  const [visitRating, setVisitRating] = useState(5);
  const [visitCost, setVisitCost] = useState('0');
  const [visitRevisit, setVisitRevisit] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [visitNote, setVisitNote] = useState('');
  const [visitSuccess, setVisitSuccess] = useState(false);

  const [essentialItems, setEssentialItems] = useState<{ id: string; name: string; checked: boolean }[]>([]);

  useEffect(() => {
    setEssentialItems(
      (place.packing_list ?? '')
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name, index) => ({ id: String(index + 1), name, checked: false }))
    );
    setActiveTab('overview');
  }, [place.id, place.packing_list]);

  const hasOverview = Boolean(
    place.summary || place.overview_route || place.overview_tips || place.safety_notes ||
    place.packing_list || place.nearby_services || place.ticket_price || place.best_season ||
    place.suggested_duration || place.open_hours || place.has_parking !== undefined,
  );

  const toggleCheck = (id: string) => {
    setEssentialItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  // Find associated guides (specifically for this place, or city-level if matching place city)
  const relatedGuides = guides.filter(g => 
    (g.target_type === 'place' && g.target_id === place.id) ||
    (g.target_type === 'city' && place.city && g.target_id === place.city)
  );

  // Find real uploaded or seeded photos linked to this place
  const relatedPhotos = media.filter(m => m.place_id === place.id);
  // 有效封面：用户设置的 cover_image 优先，否则回退到最新关联照片（与手机端一致）
  const effectiveCover = pickPlaceCover(place, relatedPhotos);

  // Find actual visits linked to this place
  const relatedVisits = visits.filter(v => v.place_id === place.id);

  // Find scheduled records for this place in existing itinerary items
  const scheduledRecords = tripItems
    .filter(item => item.place_id === place.id)
    .map(item => {
      const day = tripDays.find(d => d.id === item.trip_day_id);
      const trip = trips.find(t => t.id === day?.trip_id);
      return { item, day, trip };
    })
    .filter(record => record.day && record.trip);

  const distance = userLocation
    ? calculateDistanceKm(userLocation, { latitude: place.latitude, longitude: place.longitude })
    : undefined;

  const filteredDays = tripDays.filter(d => d.trip_id === selectedTripId);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    if (!selectedDayId) {
      setActionError('请先选择要加入的日程日期。');
      return;
    }
    try {
      await onAddToTrip(place.id, selectedDayId, place.category_id, scheduledTime, scheduledNote);
      setAddSuccess(true);
      setTimeout(() => {
        setAddSuccess(false);
        setShowAddTripModal(false);
      }, 1500);
    } catch (err) {
      setActionError('加入行程失败，请检查网络后重试。');
    }
  };

  // Guide Submission Handler
  const handleGuideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guideTitle || !guideContent || !onCreateGuide) return;
    setActionError('');
    try {
      await onCreateGuide({
        title: guideTitle,
        summary: guideContent.substring(0, 80) + '...',
        content: guideContent,
        source: guideSource,
        target_type: 'place',
        target_id: place.id,
        verified_at: new Date().toISOString().split('T')[0]
      });
      setGuideSuccess(true);
      setGuideTitle('');
      setGuideContent('');
      setTimeout(() => {
        setGuideSuccess(false);
        setShowAddGuideForm(false);
      }, 1200);
    } catch (err) {
      setActionError('保存攻略失败，请检查网络后重试。');
    }
  };

  // Visit Submission Handler
  const handleVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateVisit) return;
    setActionError('');
    try {
      await onCreateVisit({
        place_id: place.id,
        visit_date: visitDate,
        companions: visitCompanions,
        weather: visitWeather,
        rating: visitRating,
        actual_cost: parseFloat(visitCost) || 0,
        revisit_intention: visitRevisit,
        note: visitNote
      });
      setVisitSuccess(true);
      setVisitNote('');
      setTimeout(() => {
        setVisitSuccess(false);
        setShowVisitForm(false);
      }, 1200);
    } catch (err) {
      setActionError('到访打卡保存失败，请检查网络后重试。');
    }
  };

  // Physical Photo File Handler
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFileError('照片大小不能超过 5MB！');
      return;
    }
    setFileError('');
    setUploadProgress(true);
    try {
      const prepared = await preparePhotoForUpload(file);
      if (!onUploadPhoto) return;
      await onUploadPhoto({
        filename: prepared.fileName,
        file_size: prepared.fileSize,
        dataUrl: prepared.dataUrl,
        place_id: place.id,
        captured_at: prepared.exif.capturedAt,
        ...photoLocationFields(prepared.exif),
      });
      setShowPhotoForm(false);
    } catch (err) {
      setFileError('上传失败，请重新尝试');
    } finally {
      setUploadProgress(false);
    }
  };

  const checkedCount = essentialItems.filter(item => item.checked).length;

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Detail Header Actions */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <button 
          onClick={onClose}
          aria-label="关闭地点详情"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="关闭详情"
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-2">
          {onEditPlace && <button aria-label="编辑地点" onClick={() => onEditPlace(place)} className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition-all hover:bg-slate-100" title="编辑地点"><PenSquare size={15} /></button>}
          {/* visited check */}
          <button
            onClick={() => onToggleVisited(place.id)}
            aria-pressed={place.status === 'visited'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              place.status === 'visited'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckSquare size={14} />
            <span>{place.status === 'visited' ? '已去过' : '想去这儿'}</span>
          </button>

          {/* favorite star */}
          <button
            onClick={() => onToggleFavorite(place.id)}
            aria-label={place.favorite ? '取消收藏' : '添加收藏'}
            className={`p-1.5 rounded-full border transition-all ${
              place.favorite
                ? 'bg-amber-50 text-amber-500 border-amber-200'
                : 'text-slate-400 border-slate-200 hover:bg-slate-50'
            }`}
            title="添加收藏"
          >
            <Heart size={16} fill={place.favorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      {/* Cover Photo Banner */}
      <div className="relative w-full h-40 bg-slate-100 overflow-hidden shrink-0">
        <img 
          src={effectiveCover || IMAGE_PLACEHOLDER} 
          alt={place.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-black text-slate-800 shadow-sm border border-slate-200/40">
          {categoryLabels[place.category_id]}
        </div>
      </div>

      {/* Core Title, Rating & Location Info (Always Visible below Cover) */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-100 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-sm font-black text-slate-900 leading-snug">{place.name}</h1>
          <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-xs font-bold shrink-0">
            <Star size={12} fill="currentColor" />
            <span>{place.rating ?? '未评分'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1.5">
          <MapPin size={11} className="text-slate-400 shrink-0" />
          <span className="truncate max-w-[150px]" title={place.address}>{place.address}</span>
          <span className="text-slate-300 mx-1 shrink-0">|</span>
          {distance !== undefined ? (
            <span className="text-blue-500 font-bold shrink-0">距您 {distance} km</span>
          ) : (
            <span className="text-slate-400 font-semibold shrink-0" title="在地图上点击定位后显示距离">距离待定位</span>
          )}
        </div>
      </div>

      {/* Tab bar container */}
      <div className="flex border-b border-slate-100 shrink-0 bg-white sticky top-0 z-10">
        {(['overview', 'guide', 'photos', 'visit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-center text-xs font-black transition-all border-b-2 relative ${
              activeTab === tab
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            {tab === 'overview' && '📌 概览'}
            {tab === 'guide' && `📖 攻略 (${relatedGuides.length})`}
            {tab === 'photos' && `📷 照片 (${relatedPhotos.length})`}
            {tab === 'visit' && `✓ 打卡 (${relatedVisits.length})`}
          </button>
        ))}
      </div>

      {actionError && (
        <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1 leading-relaxed">{actionError}</span>
          <button type="button" aria-label="关闭错误提示" onClick={() => setActionError('')} className="shrink-0 rounded-md p-0.5 text-rose-500 hover:bg-rose-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main tab scroll area */}
      <div className="flex-1 overflow-y-auto pb-24 scrollbar-thin">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-5 animate-in fade-in duration-200">
            {/* Split: Distinct Category badge + Feature tags */}
            <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-slate-100">
              <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded shadow-sm">
                📁 {categoryLabels[place.category_id] || '普通分类'}
              </span>
              
              {place.is_wet && (
                <span className="px-2 py-0.5 bg-cyan-50 text-cyan-600 text-[10px] font-bold rounded border border-cyan-150">
                  🌊 避暑涉水
                </span>
              )}
              {place.need_hiking && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded border border-amber-150">
                  🥾 需要徒步
                </span>
              )}
              {place.difficulty && (
                <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded border border-rose-150">
                  📊 难度: {place.difficulty === 'easy' ? '轻松' : place.difficulty === 'moderate' ? '中等' : '硬核'}
                </span>
              )}
              {place.favorite && (
                <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 text-[10px] font-bold rounded border border-yellow-200">
                  ★ 强烈推荐
                </span>
              )}
            </div>

            {/* Place Summary */}
            {place.summary && (
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {place.summary}
              </p>
            )}

            {/* Dynamic Section: Itinerary Cross-Reference */}
            {scheduledRecords.length > 0 && (
              <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2">
                <p className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                  📅 已编排至您的行程计划
                </p>
                <div className="space-y-1.5 text-xs text-slate-600">
                  {scheduledRecords.map((rec, i) => (
                    <div key={i} className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-50 shadow-xs">
                      <span className="font-bold text-slate-800 truncate max-w-[150px]">{rec.trip.title}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        Day {rec.day.day_number} ({rec.item.start_time})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasOverview && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-xs font-bold text-slate-600">尚未录入地点概览</p>
                <p className="mt-1 text-[10px] leading-5 text-slate-400">可从地图标记的“编辑”入口补充路线、提示、装备和实用信息。</p>
              </div>
            )}

            {place.overview_route && <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-blue-500 rounded-full"></span>
                推荐玩法与路线
              </h3>
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex gap-2">
                  <span className="font-bold text-blue-600 shrink-0">🚶 路线：</span>
                  <span className="flex-1 whitespace-pre-line leading-relaxed">{place.overview_route}</span>
                </div>
                {place.overview_tips && <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100/50">
                  <Clock size={11} className="text-slate-300" />
                  <span className="whitespace-pre-line">{place.overview_tips}</span>
                </div>}
              </div>
            </div>}

            {place.safety_notes && <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-red-500 rounded-full"></span>
                防坑与安全小贴士
              </h3>
              <div className="p-3 bg-rose-50/30 rounded-xl border border-rose-150 flex gap-2.5 text-xs text-rose-800">
                <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[11px] whitespace-pre-line leading-relaxed text-rose-800/90">
                    {place.safety_notes}
                  </p>
                </div>
              </div>
            </div>}

            {essentialItems.length > 0 && <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-indigo-500 rounded-full"></span>
                  游玩必备
                </h3>
                <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  装箱 {checkedCount} / {essentialItems.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {essentialItems.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => toggleCheck(item.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer select-none transition-all ${
                      item.checked 
                        ? 'bg-blue-50/20 border-blue-200 text-slate-800 font-medium' 
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                      item.checked ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'
                    }`}>
                      {item.checked && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="text-xs">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>}

            {/* Dynamic Section: Practical Info Grid */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-amber-500 rounded-full"></span>
                地点实用指标
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">🚗 停车条件</p>
                  <p className="text-[11px] font-bold text-slate-800 mt-1">
                    {place.has_parking === undefined ? '未录入' : place.has_parking ? '有停车条件' : '无停车条件'}
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">🎫 门票价格</p>
                  <p className="text-[11px] font-bold text-slate-800 mt-1">
                    {place.ticket_price || '未录入'}
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">📅 最佳游玩时间</p>
                  <p className="text-[11px] font-bold text-slate-800 mt-1">
                    {place.best_season || '未录入'}
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">⏱️ 建议逗留</p>
                  <p className="text-[11px] font-bold text-slate-800 mt-1">
                    {place.suggested_duration || '未录入'}
                  </p>
                </div>
              </div>
            </div>

            {place.nearby_services && <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-teal-500 rounded-full"></span>
                附近保障与补给建议
              </h3>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                <p className="whitespace-pre-line text-[11px] leading-relaxed text-slate-500">{place.nearby_services}</p>
              </div>
            </div>}
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="p-4 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                <BookOpen size={13} className="text-blue-500" />
                <span>实地自驾防坑攻略 ({relatedGuides.length})</span>
              </h3>
              <button
                onClick={() => setShowAddGuideForm(!showAddGuideForm)}
                className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
              >
                <PenSquare size={11} />
                <span>{showAddGuideForm ? '取消编写' : '✍️ 撰写攻略'}</span>
              </button>
            </div>

            {/* Inline Guide write form */}
            {showAddGuideForm && (
              <form onSubmit={handleGuideSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs animate-in slide-in-from-top-2 duration-150">
                <p className="font-bold text-slate-800 text-xs">✍️ 记录您在此地点的独特玩法、避坑建议：</p>
                
                {guideSuccess ? (
                  <div className="py-4 text-center text-emerald-600 font-bold">
                    ✓ 攻略发布成功！已实时收录。
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-black">攻略标题</label>
                      <input 
                        type="text" 
                        placeholder="例如：双坑村溯溪下午茶及深潭避坑攻略"
                        value={guideTitle}
                        onChange={(e) => setGuideTitle(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-black">记录来源</label>
                        <select 
                          value={guideSource} 
                          onChange={(e) => setGuideSource(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="成员原创记录">成员原创记录</option>
                          <option value="群友路书推荐">群友路书推荐</option>
                          <option value="小红书指南">小红书指南</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-black">可见性</label>
                        <span className="block text-xs p-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg font-bold">
                          受邀团队共享
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-400 font-black">攻略详情内容 (支持Markdown)</label>
                        <span className="text-[9px] text-slate-400 font-medium">使用 ### 标题，{">"} 💡 贴士，{">"} ⚠️ 警告</span>
                      </div>
                      <textarea 
                        placeholder="### 游玩路线&#10;1. 先到达停车场...&#10;&#10;> ⚠️ 警告: 深潭水深超过 2 米，儿童玩水必须全程看护并穿着救生衣！&#10;&#10;> 💡 贴士: 农家乐的甘草水果和土鸡煲绝佳，推荐在饭点前电话订餐。"
                        value={guideContent}
                        onChange={(e) => setGuideContent(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg h-32 outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                        required
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700"
                    >
                      发布新攻略
                    </button>
                  </>
                )}
              </form>
            )}

            {/* Related Guides List */}
            {relatedGuides.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs space-y-2">
                <BookOpen size={24} className="mx-auto text-slate-300" />
                <p>暂无此地点的自驾游玩攻略指南。</p>
                <p className="text-[10px] text-slate-400/85">欢迎点击上方 “撰写攻略” 按钮，添加首条避坑干货！</p>
              </div>
            ) : (
              <div className="space-y-3">
                {relatedGuides.map(guide => (
                  <div key={guide.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-xs leading-snug">{guide.title}</h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-500">{guide.source}</span>
                          <span>|</span>
                          <span>发布于 {guide.verified_at || guide.created_at?.split('T')[0]}</span>
                        </div>
                      </div>
                    </div>

                    {/* Styled Markdown content */}
                    <div className="text-slate-600">
                      <MarkdownRenderer text={guide.content} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="p-4 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                <ImageIcon size={13} className="text-pink-500" />
                <span>实地照片足迹 ({relatedPhotos.length})</span>
              </h3>
              
              <button
                onClick={() => setShowPhotoForm(!showPhotoForm)}
                className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
              >
                <Upload size={11} />
                <span>{showPhotoForm ? '关闭上传' : '➕ 上传照片'}</span>
              </button>
            </div>

            {/* Custom Photo Upload Dialog */}
            {showPhotoForm && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs animate-in slide-in-from-top-2 duration-150">
                <p className="font-bold text-slate-800 text-xs">📸 上传在此地点拍摄的真实照片：</p>
                
                {fileError && (
                  <div className="p-2 bg-red-50 text-red-600 rounded border border-red-100 text-[10px] font-bold">
                    ⚠️ {fileError}
                  </div>
                )}

                {uploadProgress ? (
                  <div className="py-6 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-[10px] text-slate-400 font-bold">照片正在压缩上传中，请稍后...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Real Physical File Upload Button */}
                    <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-white text-center hover:bg-slate-50 cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handlePhotoFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Upload size={18} className="mx-auto text-slate-400 mb-1" />
                      <p className="text-[11px] font-bold text-slate-700">选择本地设备中的真实照片</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">支持 JPG/PNG，小于 5MB (自动在服务器压缩)</p>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* Photo Grid list */}
            {relatedPhotos.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs space-y-2">
                <ImageIcon size={24} className="mx-auto text-slate-300" />
                <p>暂无此地点的实地照片足迹。</p>
                <p className="text-[10px] text-slate-400/85">点击 “上传照片” 记录你们在这里踩下的第一枚脚印吧！</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {relatedPhotos.map(photo => {
                  const isCover = effectiveCover !== undefined && effectiveCover === photo.file_path;
                  return (
                    <div key={photo.id} className="relative rounded-xl overflow-hidden aspect-4/3 bg-slate-100 border border-slate-200 shadow-2xs group">
                      <img 
                        src={photo.file_path} 
                        alt="实地照"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                        loading="lazy"
                        onClick={() => setLightboxPhoto(photo)}
                      />
                      {isCover && (
                        <span className="absolute top-1.5 left-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">封面</span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white flex items-end justify-between gap-1 text-[10px]">
                        <p className="font-extrabold truncate">📸 {photo.captured_at?.split('T')[0]}</p>
                        {!isCover && onSetCover && (
                          <button
                            onClick={() => onSetCover(place.id, photo.file_path)}
                            className="shrink-0 rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-black text-blue-600 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            设为封面
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'visit' && (
          <div className="p-4 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                <CheckSquare size={13} className="text-emerald-500" />
                <span>实地打卡足迹日志 ({relatedVisits.length})</span>
              </h3>
              
              <button
                onClick={() => setShowVisitForm(!showVisitForm)}
                className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
              >
                <PenSquare size={11} />
                <span>{showVisitForm ? '收起登记' : '📝 新登记打卡'}</span>
              </button>
            </div>

            {/* Visit Logging Form */}
            {showVisitForm && (
              <form onSubmit={handleVisitSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs animate-in slide-in-from-top-2 duration-150">
                <p className="font-bold text-slate-800 text-xs">📝 登记真实的出行足迹与花费开销：</p>
                
                {visitSuccess ? (
                  <div className="py-4 text-center text-emerald-600 font-bold">
                    ✓ 打卡成功！自动标记本标记点为“已去过”。
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-black">到访日期</label>
                        <input 
                          type="date"
                          value={visitDate}
                          onChange={(e) => setVisitDate(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-black">到访天气</label>
                        <select 
                          value={visitWeather} 
                          onChange={(e) => setVisitWeather(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                        >
                          <option value="☀️ 晴">☀️ 晴</option>
                          <option value="☁️ 阴">☁️ 阴</option>
                          <option value="🌧️ 阵雨">🌧️ 阵雨</option>
                          <option value="🌫️ 薄雾">🌫️ 薄雾</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-black">出行伙伴</label>
                        <input 
                          type="text"
                          value={visitCompanions}
                          onChange={(e) => setVisitCompanions(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          placeholder="例如：全家、和爱人"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-black">实地实际花费 (元)</label>
                        <input 
                          type="number"
                          value={visitCost}
                          onChange={(e) => setVisitCost(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          placeholder="例如：120"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-black">评分 (1-5 星)</label>
                        <select 
                          value={visitRating} 
                          onChange={(e) => setVisitRating(parseInt(e.target.value))}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none text-amber-500 font-bold"
                        >
                          <option value="5">★★★★★ 极佳</option>
                          <option value="4">★★★★ 不错</option>
                          <option value="3">★★★ 一般</option>
                          <option value="2">★★ 避坑</option>
                          <option value="1">★ 极差</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-black">重访意向</label>
                        <select 
                          value={visitRevisit} 
                          onChange={(e) => setVisitRevisit(e.target.value as any)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none font-bold"
                        >
                          <option value="yes">👍 强烈推荐再去</option>
                          <option value="maybe">🤔 有空可以再去</option>
                          <option value="no">👎 不想再去第二次</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-black">游玩体验备忘录</label>
                      <textarea 
                        value={visitNote}
                        onChange={(e) => setVisitNote(e.target.value)}
                        placeholder="记录您在此处的真实游玩体验，比如：这里的土鸡煲极佳但下午3点就打烊了；溯溪建议水枪带够..."
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg h-16 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700"
                    >
                      提交登记足迹
                    </button>
                  </>
                )}
              </form>
            )}

            {/* Visit Logs List */}
            {relatedVisits.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs space-y-2">
                <CheckSquare size={24} className="mx-auto text-slate-300" />
                <p>暂无此地点的打卡足迹日记。</p>
                <p className="text-[10px] text-slate-400/85">记录真实打卡，可以自动关联统计您的自驾花费与路线！</p>
              </div>
            ) : (
              <div className="space-y-2">
                {relatedVisits.map(visit => (
                  <div key={visit.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-xs space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                      <div className="flex items-center gap-1 text-slate-700">
                        <Calendar size={11} className="text-slate-400" />
                        <span>{visit.visit_date}</span>
                        <span className="text-slate-300 font-medium">({visit.weather})</span>
                      </div>
                      <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {visit.revisit_intention === 'yes' ? '👍 极力推荐' : visit.revisit_intention === 'maybe' ? '🤔 可再访' : '👎 避坑不推荐'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-t border-b border-slate-50 text-[10px] text-slate-600">
                      <div className="flex items-center gap-1">
                        <Users size={11} className="text-slate-400" />
                        <span>同伴：{visit.companions || '独自/自驾'}</span>
                      </div>
                      {visit.actual_cost !== undefined && visit.actual_cost > 0 && (
                        <div className="flex items-center text-blue-600 font-black">
                          <DollarSign size={11} />
                          <span>开销：{visit.actual_cost} 元</span>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: visit.rating || 5 }).map((_, idx) => (
                          <Star key={idx} size={9} fill="currentColor" />
                        ))}
                      </div>
                    </div>

                    {visit.note && (
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {visit.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persistent Bottom Action Bar */}
      <div className="absolute bottom-0 inset-x-0 bg-white border-t border-slate-100 p-4 flex gap-3 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <button
          onClick={() => {
            if (trips.length > 0) {
              setSelectedTripId(trips[0].id);
              setShowAddTripModal(true);
            } else {
              setActionError('请先创建一条行程，再把地点加入日程。');
            }
          }}
          className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <CalendarPlus size={15} />
          <span>+ 加入自驾日程计划</span>
        </button>
      </div>

      {/* Add To Itinerary Picker Popover */}
      {showAddTripModal && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-slate-100 space-y-4 animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm">选择要把该地点加入哪天</h4>
              <button 
                onClick={() => setShowAddTripModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {addSuccess ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl font-extrabold shadow-sm">
                  ✓
                </div>
                <p className="font-bold text-slate-800 text-xs">成功加入行程！</p>
              </div>
            ) : (
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">选择行程</label>
                  <select 
                    value={selectedTripId}
                    onChange={(e) => {
                      setSelectedTripId(e.target.value);
                      setSelectedDayId('');
                    }}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="">请选择...</option>
                    {trips.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">选择日期天数</label>
                  <select 
                    value={selectedDayId}
                    onChange={(e) => setSelectedDayId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="">请选择哪一天...</option>
                    {filteredDays.map(d => (
                      <option key={d.id} value={d.id}>Day {d.day_number} | {d.title} ({d.date})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">预定开始时间</label>
                    <input 
                      type="time" 
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">活动项类别</label>
                    <span className="block text-xs p-2.5 bg-slate-100 text-slate-500 rounded-xl font-bold">
                      {categoryLabels[place.category_id] || '游玩'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">备忘备注 (可选)</label>
                  <textarea 
                    placeholder="例如：准备换洗衣物，带防蚊喷雾等..."
                    value={scheduledNote}
                    onChange={(e) => setScheduledNote(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl h-16 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedDayId}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md disabled:bg-slate-200 disabled:shadow-none hover:bg-blue-700 transition-colors"
                >
                  确定加入
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-100 flex flex-col animate-in fade-in duration-200"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="flex items-center justify-between p-4 shrink-0">
            <span className="text-[10px] font-black text-white/50 tracking-widest">📸 {lightboxPhoto.captured_at?.split('T')[0] || '实地照片'}</span>
            <button
              onClick={() => setLightboxPhoto(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="关闭大图"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-6 pb-6 overflow-hidden">
            <img
              src={lightboxPhoto.file_path}
              alt="放大查看"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Simple internal Markdown Renderer Component
function MarkdownRenderer({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-xs text-slate-700">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) {
          return <h5 key={idx} className="text-xs font-black text-slate-800 mt-3 pt-1">{trimmed.replace('###', '').trim()}</h5>;
        }
        if (trimmed.startsWith('##')) {
          return <h4 key={idx} className="text-xs font-black text-slate-800 mt-4 pt-1 border-b border-slate-50 pb-0.5">{trimmed.replace('##', '').trim()}</h4>;
        }
        if (trimmed.startsWith('>') && (trimmed.includes('💡') || trimmed.includes('贴士'))) {
          return (
            <div key={idx} className="p-2.5 bg-amber-50/50 border-l-4 border-amber-500 rounded-r-lg text-[11px] text-amber-900 leading-relaxed my-1">
              {trimmed.substring(1).trim()}
            </div>
          );
        }
        if (trimmed.startsWith('>') && (trimmed.includes('⚠️') || trimmed.includes('警告'))) {
          return (
            <div key={idx} className="p-2.5 bg-red-50/40 border-l-4 border-red-500 rounded-r-lg text-[11px] text-red-950 leading-relaxed my-1">
              {trimmed.substring(1).trim()}
            </div>
          );
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 ml-1 my-0.5">
              <span className="text-blue-500 font-extrabold text-[10px] mt-0.5">•</span>
              <span className="text-[11px] text-slate-600 leading-relaxed">{trimmed.substring(1).trim()}</span>
            </div>
          );
        }
        if (trimmed === '') return <div key={idx} className="h-1" />;
        return <p key={idx} className="text-[11px] text-slate-600 leading-relaxed">{trimmed}</p>;
      })}
    </div>
  );
}

