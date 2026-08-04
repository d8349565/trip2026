import React, { useState } from 'react';
import { MapLocation, Media, Place, PlaceCategory } from '../../types';
import MapContainer from '../MapContainer';
import MobilePlaceMiniCard from './MobilePlaceMiniCard';
import { pickPlaceCover } from '../../utils/placeCover';
import { MapPin, X, Heart, Sparkles, LayoutList, Crosshair, LocateFixed, Search, SlidersHorizontal, UserRound } from 'lucide-react';

interface MobileMapPageProps {
  places: Place[];
  media: Media[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place | null) => void;
  onViewPlaceDetails: (place: Place) => void;
  onCreatePlace: (place: Partial<Place>) => Promise<Place>;
  onUpdatePlace: (id: string, place: Partial<Place>) => Promise<Place>;
  onDeletePlace: (id: string) => Promise<void>;
  onRequestEditor: () => void;
  editorRequest: number;
  editRequest: { token: number; place: Place } | null;
  photoDraft: { token: number; mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string } | null;
  onPhotoDraftEnd: () => void;
  onToggleFavorite: (id: string) => void;
  onAddToTrip: (placeId: string) => void;
  onOpenProfile: () => void;
  profileLabel: string;
  onLocationChange?: (location: MapLocation) => void;
  categoryColors: Record<PlaceCategory, { bg: string; text: string; iconBg: string; border: string }>;
  categoryLabels: Record<PlaceCategory, string>;
  categoryIcons: Record<PlaceCategory, React.ReactNode>;
}

export default function MobileMapPage({
  places,
  media,
  selectedPlace,
  onSelectPlace,
  onViewPlaceDetails,
  onCreatePlace,
  onUpdatePlace,
  onDeletePlace,
  onRequestEditor,
  editorRequest,
  editRequest,
  photoDraft,
  onPhotoDraftEnd,
  onToggleFavorite,
  onAddToTrip,
  onOpenProfile,
  profileLabel,
  onLocationChange,
  categoryColors,
  categoryLabels,
  categoryIcons,
}: MobileMapPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(''); // empty means all
  const [showMapSearch, setShowMapSearch] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showListView, setShowListView] = useState(false);
  const [locateRequest, setLocateRequest] = useState(0);
  const [fitAllRequest, setFitAllRequest] = useState(0);

  // States from Filter sheet
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [wetFilter, setWetFilter] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [recommendedOnly, setRecommendedOnly] = useState(false);

  // Filter computation
  const filteredPlaces = places.filter(p => {
    // Top category selection
    if (activeCategory && p.category_id !== activeCategory) return false;
    
    // Detailed sheet filters
    if (selectedDifficulty && p.difficulty !== selectedDifficulty) return false;
    if (wetFilter && !p.is_wet) return false;
    if (favoritesOnly && !p.favorite) return false;
    if (recommendedOnly && !p.recommended) return false;
    
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchAddress = p.address.toLowerCase().includes(q);
      const matchSummary = p.summary?.toLowerCase().includes(q) || false;
      return matchName || matchAddress || matchSummary;
    }
    return true;
  });

  const hasActiveFilters = Boolean(
    activeCategory || selectedDifficulty || wetFilter || favoritesOnly || recommendedOnly,
  );

  const resetFilters = () => {
    setActiveCategory('');
    setSelectedDifficulty('');
    setWetFilter(false);
    setFavoritesOnly(false);
    setRecommendedOnly(false);
  };

  const showAllPlaces = () => {
    setSearchQuery('');
    resetFilters();
    onSelectPlace(null);
    setFitAllRequest((request) => request + 1);
  };


  return (
    <div className="flex-1 h-full w-full relative flex flex-col overflow-hidden select-none">

      {/* 3. Fullscreen Map View */}
      <div className="absolute inset-0 z-10 w-full h-full">
        <MapContainer
          places={filteredPlaces}
          media={media}
          selectedPlace={selectedPlace}
          onSelectPlace={onSelectPlace}
          onCreatePlace={onCreatePlace}
          onUpdatePlace={onUpdatePlace}
          onDeletePlace={onDeletePlace}
          editorRequest={editorRequest}
          editRequest={editRequest}
          photoDraft={photoDraft}
          onPhotoDraftEnd={onPhotoDraftEnd}
          locateRequest={locateRequest}
          onLocationChange={onLocationChange}
          fitAllRequest={fitAllRequest}
          onShowAllPlaces={showAllPlaces}
          categoryColors={categoryColors}
          categoryLabels={categoryLabels}
          categoryIcons={categoryIcons}
          mobileSearchExpanded={showMapSearch}
        />
      </div>

      <button
        id="m_btn_open_profile"
        type="button"
        onClick={onOpenProfile}
        aria-label="打开我的"
        className="absolute right-3 top-16 z-30 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-white/95 text-sm font-black text-blue-600 shadow-lg backdrop-blur-md outline-none transition-transform active:scale-95"
      >
        {profileLabel ? <span aria-hidden="true">{profileLabel.slice(0, 1).toUpperCase()}</span> : <UserRound size={18} />}
      </button>

      {/* 4. 手机端地图工具集中在拇指区；仅保留搜索、筛选、显示全部与定位。 */}
      <div className="absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-30 flex flex-col gap-2">
        <button
          id="m_btn_open_search"
          type="button"
          onClick={() => setShowMapSearch((open) => !open)}
          aria-expanded={showMapSearch}
          aria-label={showMapSearch ? '收起地图搜索' : '打开地图搜索'}
          title={showMapSearch ? '收起搜索' : '搜索地点'}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-white/95 text-slate-600 shadow-lg backdrop-blur-md outline-none transition-all hover:bg-slate-50 active:scale-95"
        >
          {showMapSearch ? <X size={18} /> : <Search size={18} />}
        </button>
        <button
          id="m_btn_open_filter"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={showFilterSheet}
          onClick={() => setShowFilterSheet(true)}
          aria-label="打开地图筛选"
          title="筛选地点"
          className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg backdrop-blur-md outline-none transition-all hover:bg-blue-50 active:scale-95 ${
            hasActiveFilters
              ? 'border-blue-500 bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-blue-500/25'
              : 'border-slate-100 bg-white/95 text-slate-600'
          }`}
        >
          <SlidersHorizontal size={18} />
          {hasActiveFilters && <span aria-label="已启用筛选" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-white" />}
        </button>
        <button
          id="m_btn_show_all"
          type="button"
          onClick={showAllPlaces}
          aria-label="显示全部地点"
          title="显示全部地点"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-white/95 text-blue-600 shadow-lg backdrop-blur-md outline-none transition-all hover:bg-blue-50 active:scale-95"
        >
          <LocateFixed size={18} />
        </button>
        <button
          id="m_btn_locate"
          type="button"
          onClick={() => setLocateRequest(Date.now())}
          aria-label="定位到当前位置"
          title="当前位置"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-white/95 text-blue-600 shadow-lg backdrop-blur-md outline-none transition-all hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-95"
        >
          <Crosshair size={18} />
        </button>
      </div>

      {/* 5. Miniature Place Card (when place is selected) */}
      {selectedPlace && (
        <MobilePlaceMiniCard
          place={selectedPlace}
          coverUrl={pickPlaceCover(selectedPlace, media.filter(m => m.place_id === selectedPlace.id))}
          onClose={() => onSelectPlace(null)}
          onViewDetails={() => onViewPlaceDetails(selectedPlace)}
          onAddToTrip={() => onAddToTrip(selectedPlace.id)}
          categoryColors={categoryColors}
          categoryLabels={categoryLabels}
          categoryIcons={categoryIcons}
        />
      )}

      {/* 6. Filter Sheet Panel Overlay (Bottom Sheet) */}
      {showFilterSheet && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end animate-fade-in">
          <div className="absolute inset-0" onClick={() => setShowFilterSheet(false)}></div>
          <div className="relative z-10 max-h-[80vh] w-full space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-slide-up">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-base">高级检索与分类筛选</h4>
                <p className="text-xs text-slate-400 mt-0.5">选择分类类别或旅行到访状态过滤</p>
              </div>
              <button
                type="button"
                aria-label="关闭地图筛选"
                onClick={() => setShowFilterSheet(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 outline-none hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Category Grid Section */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">所有地点类别</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(categoryLabels) as PlaceCategory[]).map(cat => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveCategory(isActive ? '' : cat);
                        onSelectPlace(null);
                      }}
                      className={`p-2 rounded-xl text-xs font-bold border text-center transition-all flex flex-col items-center gap-1 outline-none ${
                        isActive
                          ? 'bg-blue-50 border-blue-200 text-blue-600 font-extrabold'
                          : 'bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-lg">{categoryIcons[cat]}</span>
                      <span className="text-[11px] truncate w-full">{categoryLabels[cat]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visit & Favorite Status Filters */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">到访与收藏状态</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFavoritesOnly(!favoritesOnly)}
                  className={`p-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 outline-none ${
                    favoritesOnly ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50/50 border-slate-100 text-slate-600'
                  }`}
                >
                  <Heart size={14} className={favoritesOnly ? 'fill-amber-500 text-amber-500' : ''} />
                  <span>精选收藏</span>
                </button>
                <button
                  onClick={() => setRecommendedOnly(!recommendedOnly)}
                  className={`p-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 outline-none ${
                    recommendedOnly ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50/50 border-slate-100 text-slate-600'
                  }`}
                >
                  <Sparkles size={14} className={recommendedOnly ? 'text-rose-500' : ''} />
                  <span>强烈推荐</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setWetFilter(!wetFilter)}
                  className={`p-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 outline-none ${
                    wetFilter ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-slate-50/50 border-slate-100 text-slate-600'
                  }`}
                >
                  <span>🌊</span>
                  <span>戏水涉水</span>
                </button>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl text-xs font-bold outline-none text-slate-600"
                >
                  <option value="">🥾 徒步难度不限</option>
                  <option value="easy">轻松徒步</option>
                  <option value="moderate">中等溯溪</option>
                  <option value="hard">硬核穿越</option>
                </select>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  resetFilters();
                }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
              >
                重置所有
              </button>
              <button
                onClick={() => setShowFilterSheet(false)}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md"
              >
                查看结果 ({filteredPlaces.length} 处)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Secondary map actions are grouped to keep the map canvas clear. */}
      {showActionSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="absolute inset-0" onClick={() => setShowActionSheet(false)}></div>
          <div role="dialog" aria-modal="true" aria-label="地图操作" className="relative z-10 w-full space-y-3 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-extrabold text-slate-800">地图操作</h4>
                <p className="mt-0.5 text-xs text-slate-400">将视野与列表集中在这里</p>
              </div>
              <button type="button" aria-label="关闭地图操作" onClick={() => setShowActionSheet(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 outline-none active:scale-90">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button id="m_action_show_all" type="button" onClick={() => { setShowActionSheet(false); showAllPlaces(); }} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-2 text-xs font-bold text-slate-700 active:scale-[0.97]">
                <LocateFixed size={19} className="text-blue-600" />
                <span>显示全图</span>
              </button>
              <button id="m_action_show_list" type="button" onClick={() => { setShowActionSheet(false); setShowListView(true); }} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-2 text-xs font-bold text-slate-700 active:scale-[0.97]">
                <LayoutList size={19} className="text-violet-600" />
                <span>地点列表</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Places List View Overlay Modal */}
      {showListView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center animate-fade-in">
          <div className="absolute inset-0" onClick={() => setShowListView(false)}></div>
          <div className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:max-w-md sm:rounded-2xl">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-800 text-base">采集打卡点检索清单</h4>
                <p className="text-xs text-slate-400 mt-0.5">当前筛选出 {filteredPlaces.length} 个足迹标记点</p>
              </div>
              <button
                type="button"
                aria-label="关闭地点列表"
                onClick={() => setShowListView(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 outline-none hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable list of places */}
            <div className="flex-1 space-y-2.5 overflow-y-auto p-4 pb-8">
              {filteredPlaces.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin size={36} className="text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">暂无匹配到任何足迹，请尝试调整筛选条件</p>
                </div>
              ) : (
                filteredPlaces.map(p => {
                  const colors = categoryColors[p.category_id] || { bg: 'bg-slate-100', text: 'text-slate-700' };
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectPlace(p);
                        setShowListView(false);
                      }}
                      className="w-full flex gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all text-left outline-none bg-white cursor-pointer"
                    >
                      {p.cover_image ? (
                        <img 
                          src={p.cover_image} 
                          alt={p.name} 
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300 shrink-0 border border-slate-100">
                          <span>📍</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${colors.bg} ${colors.text}`}>
                              {categoryLabels[p.category_id]}
                            </span>
                            <span className="font-extrabold text-slate-800 text-xs truncate block">{p.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{p.address}</p>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{p.summary || '暂无描述信息'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
