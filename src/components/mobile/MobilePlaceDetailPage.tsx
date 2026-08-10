import React, { useState, useEffect, useRef } from 'react';
import { Place, PlaceCategory, Trip, TripDay, Media, Visit, Guide, type MediaUploadInput } from '../../types';
import MobileAddPlaceToTripSheet from './MobileAddPlaceToTripSheet';
import { photoLocationFields, preparePhotoForUpload } from '../../utils/photoUpload';
import { formatPlaceRating } from '../../utils/placeRating';
import { pickPlaceCover } from '../../utils/placeCover';
import { BackNavContext, useBackLayer } from '../../hooks/useMobileBackNavigation';
import { 
  Heart, Star, MapPin, X, ImageIcon, Clock, BookOpen, 
  DollarSign, Compass, Calendar, Check, User, Plus, 
  Upload, Sparkles, Cloud, Users, ChevronLeft, ArrowLeft, Edit3, Trash2
} from 'lucide-react';

interface MobilePlaceDetailPageProps {
  place: Place;
  trips: Trip[];
  tripDays: TripDay[];
  media: Media[];
  visits: Visit[];
  guides: Guide[];
  onBack: () => void;
  onToggleFavorite: (id: string) => void;
  onAddToTrip: (placeId: string, tripDayId: string, type: string, time: string, note: string) => void;
  onUploadPhoto?: (photoData: MediaUploadInput & { place_id: string }) => Promise<unknown>;
  onCreateVisit?: (visit: Partial<Visit>) => Promise<void>;
  onEditPlace?: (place: Place) => void;
  categoryColors: Record<PlaceCategory, { bg: string; text: string; iconBg: string; border: string }>;
  categoryLabels: Record<PlaceCategory, string>;
  categoryIcons: Record<PlaceCategory, React.ReactNode>;
  onNavigateToTrip?: () => void;
  onSetCover?: (placeId: string, photoUrl: string) => void;
  onDeletePhoto?: (id: string) => void;
  onToggleFavoritePhoto?: (id: string, fav: boolean) => void;
}

export default function MobilePlaceDetailPage({
  place,
  trips,
  tripDays,
  media,
  visits,
  guides,
  onBack,
  onToggleFavorite,
  onAddToTrip,
  onUploadPhoto,
  onCreateVisit,
  onEditPlace,
  categoryColors,
  categoryLabels,
  categoryIcons,
  onNavigateToTrip = () => {},
  onSetCover,
  onDeletePhoto,
  onToggleFavoritePhoto,
}: MobilePlaceDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'guide' | 'photos' | 'visit'>('overview');
  const [showAddTripModal, setShowAddTripModal] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [selectedDayId, setSelectedDayId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [scheduledNote, setScheduledNote] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  // Photo state
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState('');
  // 照片查看器：当前照片下标（null = 关闭）。单击开关全景，左右滑动切换。
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Visit logging state
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitRating, setVisitRating] = useState(5);
  const [visitCost, setVisitCost] = useState('');
  const [visitWeather, setVisitWeather] = useState('晴朗 ☀️');
  const [visitCompanions, setVisitCompanions] = useState('');
  const [visitNote, setVisitNote] = useState('');

  const colorConfig = categoryColors[place.category_id] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };

  // Filter trips & media
  const filteredDays = tripDays.filter(d => d.trip_id === selectedTripId);
  const placePhotos = media.filter(m => m.place_id === place.id);

  // 照片查看器纳入返回键层级：系统返回先关查看器，再关详情页
  const backNav = React.useContext(BackNavContext);
  useBackLayer(backNav, true, 'place-photo-viewer', lightboxIndex !== null, () => setLightboxIndex(null));

  const lightboxPhoto = lightboxIndex !== null ? placePhotos[lightboxIndex] ?? null : null;
  const stepLightbox = (delta: number) => {
    setLightboxIndex((current) => {
      if (current === null || placePhotos.length === 0) return current;
      return Math.min(placePhotos.length - 1, Math.max(0, current + delta));
    });
  };
  // 触摸结束：位移小视为单击（关闭全景），水平位移大视为滑动（切换上/下一张）
  const handleViewerTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      stepLightbox(dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      setLightboxIndex(null);
    }
  };
  // 有效封面：用户设置的 cover_image 优先，否则回退到最新关联照片（与 PC 端一致）
  const effectiveCover = pickPlaceCover(place, placePhotos);
  const placeVisits = visits.filter(v => v.place_id === place.id);

  useEffect(() => {
    if (trips.length > 0 && !selectedTripId) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips, selectedTripId]);

  useEffect(() => {
    if (filteredDays.length > 0 && !selectedDayId) {
      setSelectedDayId(filteredDays[0].id);
    }
  }, [filteredDays, selectedDayId]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDayId) return;
    onAddToTrip(place.id, selectedDayId, place.category_id, scheduledTime, scheduledNote);
    setAddSuccess(true);
    setTimeout(() => {
      setAddSuccess(false);
      setShowAddTripModal(false);
    }, 1200);
  };

  const handlePhotoUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadPhoto) return;
    setFeedback('');
    setIsUploading(true);
    try {
      const prepared = await preparePhotoForUpload(file);
      await onUploadPhoto({
        filename: prepared.fileName,
        file_size: prepared.fileSize,
        dataUrl: prepared.dataUrl,
        place_id: place.id,
        captured_at: prepared.exif.capturedAt,
        ...photoLocationFields(prepared.exif),
      });
      setIsUploading(false);
    } catch (err) {
      setFeedback('上传失败，请检查网络后重试。');
      setIsUploading(false);
    }
  };

  const handleVisitFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateVisit) return;
    setFeedback('');
    try {
      await onCreateVisit({
        place_id: place.id,
        visit_date: visitDate,
        companions: visitCompanions || '独自/自驾',
        weather: visitWeather,
        rating: visitRating,
        actual_cost: visitCost ? parseFloat(visitCost) : 0,
        revisit_intention: 'yes',
        note: visitNote
      });
      setShowVisitForm(false);
      setVisitNote('');
      setVisitCost('');
    } catch (err) {
      setFeedback('保存记录失败，请检查网络后重试。');
    }
  };

  const packingItems = (place.packing_list ?? '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const hasGuideOverview = Boolean(place.overview_route || place.overview_tips || place.safety_notes || packingItems.length || place.nearby_services);

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col h-full animate-fade-in select-none">
      {/* 1. Header with Cover */}
      <div className="relative h-56 bg-slate-900 shrink-0 select-none">
        {effectiveCover ? (
          <img 
            src={effectiveCover}
            alt={place.name} 
            className="w-full h-full object-cover opacity-80"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 text-sm font-bold">
            📍 {place.name}
          </div>
        )}
        
        {/* Navigation overlay */}
        <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10">
          <button 
            id="m_details_back"
            onClick={onBack}
            aria-label="返回地图"
            className="w-10 h-10 rounded-full bg-slate-900/40 backdrop-blur-md text-white flex items-center justify-center active:scale-90 transition-all outline-none"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex gap-2">
            {onEditPlace && <button aria-label="编辑地点" onClick={() => onEditPlace(place)} className="w-10 h-10 rounded-full bg-slate-900/40 backdrop-blur-md text-white flex items-center justify-center active:scale-90 transition-all outline-none" title="编辑地点"><Edit3 size={18} /></button>}
            <button id="m_details_fav" aria-label={place.favorite ? '取消收藏' : '添加收藏'} aria-pressed={place.favorite} onClick={() => onToggleFavorite(place.id)} className="w-10 h-10 rounded-full bg-slate-900/40 backdrop-blur-md text-white flex items-center justify-center active:scale-90 transition-all outline-none"><Heart size={20} className={place.favorite ? "fill-rose-500 text-rose-500" : ""} /></button>
          </div>
        </div>

        {/* Title Overlay in Cover bottom */}
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap flex items-center gap-1 bg-white/20 backdrop-blur-md text-white border border-white/20`}>
              <span>{categoryIcons[place.category_id]}</span>
              <span>{categoryLabels[place.category_id]}</span>
            </span>
            <div className="flex items-center gap-0.5 text-amber-400 font-extrabold text-xs">
              ★ {formatPlaceRating(place.rating)}
            </div>
          </div>
          <h1 className="text-lg font-black mt-1.5 drop-shadow-md truncate">{place.name}</h1>
        </div>
      </div>

      {/* 2. Scrollable Tabs Section */}
      <div className="bg-white border-b border-slate-100 flex justify-around text-center shrink-0">
        {(['overview', 'guide', 'photos', 'visit'] as const).map(tab => (
          <button
            key={tab}
            id={`m_tab_${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3.5 font-bold text-xs relative ${activeTab === tab ? 'text-blue-600 font-black' : 'text-slate-500'}`}
          >
            <span>{tab === 'overview' ? '概览' : tab === 'guide' ? '攻略' : tab === 'photos' ? '照片' : '到访'}</span>
            {activeTab === tab && (
              <div className="absolute bottom-0 inset-x-6 h-0.5 bg-blue-600 rounded-full"></div>
            )}
          </button>
        ))}
      </div>

      {/* 3. Tab Contents */}
      <div className="flex-1 overflow-y-auto p-5 pb-24 space-y-4">
        {feedback && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold leading-relaxed text-rose-700">{feedback}</p>}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {/* Info Grid Card */}
            <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-xs tracking-wider uppercase border-b border-slate-50 pb-1.5">🔍 核心参数与基本信息</h3>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">参考位置</span>
                  <p className="font-bold text-slate-700 truncate">{place.address}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">门票预算</span>
                  <p className="font-bold text-slate-700">{place.ticket_price || '未录入'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">自驾停车</span>
                  <p className="font-bold text-slate-700">{place.has_parking === undefined ? '未录入' : place.has_parking ? '有停车条件' : '无停车条件'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">最佳季节</span>
                  <p className="font-bold text-slate-700">{place.best_season || '未录入'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">建议时长</span>
                  <p className="font-bold text-slate-700">{place.suggested_duration || '未录入'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">风险防范</span>
                  <p className="font-bold text-red-500">{!place.risk_level ? '未录入' : place.risk_level === 'high' ? '⚠️ 高风险' : place.risk_level === 'medium' ? '⚡ 中风险' : '低风险'}</p>
                </div>
              </div>
            </div>

            {/* 一句话描述 */}
            <div className="bg-blue-50/40 rounded-2xl p-4 border border-blue-100/50">
              <div className="flex items-center gap-1.5 text-blue-600 font-black text-xs mb-1.5">
                <Sparkles size={13} />
                <span>核心亮点推荐</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {place.summary || '尚未录入地点概览，可从地图标记的编辑入口补充。'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {!hasGuideOverview && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                尚未录入路线、提示、装备或补给信息
              </div>
            )}
            {/* 玩法方案 */}
            {place.overview_route && <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-xs space-y-2">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <span>推荐玩法与路线</span>
              </h3>
              <p className="whitespace-pre-line text-xs text-slate-600 leading-relaxed">{place.overview_route}</p>
              {place.overview_tips && <div className="p-2.5 bg-amber-50 rounded-xl text-[11px] text-amber-800 whitespace-pre-line leading-relaxed font-medium mt-2">💡 贴士：{place.overview_tips}</div>}
            </div>}

            {/* 避坑 & 风险 */}
            {place.safety_notes && <div className="bg-red-50/30 rounded-2xl p-4.5 border border-red-100/50 space-y-2">
              <h3 className="font-extrabold text-red-800 text-sm">防坑与安全小贴士</h3>
              <p className="whitespace-pre-line text-xs text-slate-600 leading-relaxed">{place.safety_notes}</p>
            </div>}

            {/* 必备物品 */}
            {packingItems.length > 0 && <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-xs space-y-2">
              <h3 className="font-extrabold text-slate-800 text-sm">游玩必备</h3>
              <div className="space-y-2">
                {packingItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 leading-none">
                    <span className="text-blue-500 font-extrabold">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>}

            {/* 附近补给 */}
            {place.nearby_services && <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              <div className="p-4 space-y-1">
                <h3 className="font-extrabold text-slate-800 text-sm">附近保障与补给建议</h3>
                <p className="whitespace-pre-line text-xs text-slate-500 leading-relaxed">{place.nearby_services}</p>
              </div>
            </div>}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {/* Upload form block */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">地点照片足迹 ({placePhotos.length} 张)</span>
              {onUploadPhoto && (
                <label className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all outline-none cursor-pointer">
                  <Upload size={13} />
                  <span>{isUploading ? '保存中...' : '上传照片'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUploadChange} 
                    className="hidden" 
                    disabled={isUploading}
                  />
                </label>
              )}
            </div>

            {placePhotos.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-xs">
                <ImageIcon size={36} className="text-slate-300 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">暂无本地点实拍照片，欢迎首位上传打卡！</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {placePhotos.map((photo, photoIndex) => (
                  <div
                    key={photo.id}
                    className="relative rounded-xl overflow-hidden aspect-square bg-slate-100 shadow-xs group"
                    onClick={() => setLightboxIndex(photoIndex)}
                  >
                    <img 
                      src={photo.file_path} 
                      alt="Place photo" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-2 left-2 right-2 bg-slate-900/40 backdrop-blur-md px-2 py-1 rounded text-[9px] text-white font-medium truncate">
                      {photo.captured_at ? photo.captured_at.substring(0, 10) : '近期上传'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'visit' && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {/* Quick Record header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">到访与打卡记录 ({placeVisits.length} 次)</span>
              {onCreateVisit && !showVisitForm && (
                <button
                  onClick={() => setShowVisitForm(true)}
                  className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all outline-none"
                >
                  <Plus size={13} />
                  <span>记录到访</span>
                </button>
              )}
            </div>

            {/* Visit Form */}
            {showVisitForm && (
              <form onSubmit={handleVisitFormSubmit} className="bg-white rounded-2xl p-4.5 border border-blue-100 bg-blue-50/5 space-y-3.5 text-xs animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <h4 className="font-extrabold text-slate-800">📝 新增到访打卡表单</h4>
                  <button 
                    type="button" 
                    onClick={() => setShowVisitForm(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    取消
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">到访日期</label>
                    <input 
                      type="date" 
                      value={visitDate}
                      onChange={e => setVisitDate(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">同伴</label>
                    <input 
                      type="text" 
                      placeholder="例如：全家、好友"
                      value={visitCompanions}
                      onChange={e => setVisitCompanions(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">开销预算 (元)</label>
                    <input 
                      type="number" 
                      placeholder="例如：120"
                      value={visitCost}
                      onChange={e => setVisitCost(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">当天天气</label>
                    <input 
                      type="text" 
                      placeholder="例如：晴朗、微风"
                      value={visitWeather}
                      onChange={e => setVisitWeather(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400">打卡综合评分</label>
                  <div className="flex gap-2.5 mt-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setVisitRating(star)}
                        className="text-amber-400 text-lg active:scale-125 transition-transform"
                      >
                        {star <= visitRating ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400">备忘和体验小记</label>
                  <textarea 
                    placeholder="水流特别清澈，适合带小鸭子，不过一定要穿厚底鞋..."
                    value={visitNote}
                    onChange={e => setVisitNote(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl h-16 outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 hover:bg-blue-700"
                >
                  确认保存打卡记录
                </button>
              </form>
            )}

            {placeVisits.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-xs">
                <Compass size={36} className="text-slate-300 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">暂无打卡到访时间，点击右上角快速添加！</p>
              </div>
            ) : (
              <div className="space-y-3">
                {placeVisits.map(visit => (
                  <div key={visit.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{visit.visit_date}</span>
                      <div className="flex gap-0.5 text-amber-500">
                        {Array.from({ length: visit.rating }).map((_, i) => (
                          <Star key={i} size={11} fill="currentColor" />
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-0.5"><Cloud size={11} /> {visit.weather}</span>
                      <span className="flex items-center gap-0.5"><Users size={11} /> {visit.companions}</span>
                      {visit.actual_cost && visit.actual_cost > 0 ? (
                        <span className="flex items-center gap-0.5 text-blue-600 font-bold"><DollarSign size={11} /> {visit.actual_cost}元</span>
                      ) : null}
                    </div>

                    {visit.note && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl leading-relaxed border border-slate-100/50">
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

      {/* 4. Bottom Sticky Add Trip Button */}
      <div className="absolute bottom-0 inset-x-0 bg-white border-t border-slate-100 p-4 flex gap-3 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] select-none" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <button
          id="m_details_add_trip_bottom"
          onClick={() => {
            if (trips.length > 0) {
              setSelectedTripId(trips[0].id);
              setShowAddTripModal(true);
            } else {
              setFeedback('请先在“行程”模块创建一条行程，再安排地点。');
            }
          }}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 outline-none"
        >
          <Calendar size={14} />
          <span>+ 安排加入自驾日程计划</span>
        </button>
      </div>

      {/* Photo Viewer：单击关闭，左右滑动切换 */}
      {lightboxPhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-slate-950 z-[60] flex flex-col animate-fade-in select-none"
          onTouchStart={(e) => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
          onTouchEnd={handleViewerTouchEnd}
        >
          <div
            className="px-4 py-4 flex items-center justify-between shrink-0"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-bold text-white/50">
              {lightboxIndex + 1} / {placePhotos.length} · {lightboxPhoto.captured_at ? lightboxPhoto.captured_at.substring(0, 10) : '近期上传'}
            </span>
            <div className="flex items-center gap-2">
              {onToggleFavoritePhoto && (
                <button
                  id="m_place_photo_fav"
                  onClick={() => onToggleFavoritePhoto(lightboxPhoto.id, !lightboxPhoto.favorite)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/40 text-white outline-none backdrop-blur-md transition-all active:scale-90"
                  aria-label="收藏照片"
                >
                  <Heart size={18} className={lightboxPhoto.favorite ? 'fill-rose-500 text-rose-500' : ''} />
                </button>
              )}
              {onSetCover && place.cover_image !== lightboxPhoto.file_path && (
                <button
                  id="m_place_photo_set_cover"
                  onClick={() => {
                    onSetCover(place.id, lightboxPhoto.file_path);
                    setLightboxIndex(null);
                    setFeedback('已设为封面');
                  }}
                  className="flex h-11 items-center gap-1 rounded-full bg-blue-600/80 px-3.5 text-[11px] font-bold text-white outline-none backdrop-blur-md transition-all active:scale-90"
                >
                  <ImageIcon size={14} />
                  设为封面
                </button>
              )}
              {onDeletePhoto && (
                <button
                  id="m_place_photo_delete"
                  onClick={() => {
                    if (confirm('确认永久删除这张照片吗？此操作不可撤销。')) {
                      onDeletePhoto(lightboxPhoto.id);
                      setLightboxIndex(null);
                    }
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/40 text-slate-300 outline-none backdrop-blur-md transition-all active:scale-90 hover:text-red-500"
                  aria-label="删除照片"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                id="m_place_photo_lightbox_close"
                onClick={() => setLightboxIndex(null)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/40 text-white outline-none backdrop-blur-md transition-all active:scale-90"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
            <img
              key={lightboxPhoto.id}
              src={lightboxPhoto.file_path}
              alt="放大查看"
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
              draggable={false}
            />
          </div>
          <div className="shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[10px] font-bold text-white/30">
            单击关闭 · 左右滑动切换
          </div>
        </div>
      )}

      {/* Add To Itinerary Picker Panel Overlay */}
      <MobileAddPlaceToTripSheet
        isOpen={showAddTripModal}
        onClose={() => setShowAddTripModal(false)}
        place={place}
        trips={trips}
        tripDays={tripDays}
        onAddToTrip={async (placeId, data) => {
          onAddToTrip(placeId, data.trip_day_id, data.type || place.category_id, data.start_time || '10:00', data.note || '');
        }}
        onNavigateToTrip={onNavigateToTrip}
      />
    </div>
  );
}

