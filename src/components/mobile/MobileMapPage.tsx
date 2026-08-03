import React, { useState } from 'react';
import { MapLocation, Media, Place, PlaceCategory } from '../../types';
import MapContainer from '../MapContainer';
import MobilePlaceMiniCard from './MobilePlaceMiniCard';
import { pickPlaceCover } from '../../utils/placeCover';
import { MapPin, X, Heart, Sparkles, LayoutList, MapPinPlus, Waves, Mountain, UtensilsCrossed, LayoutGrid, Crosshair } from 'lucide-react';

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
  onLocationChange,
  categoryColors,
  categoryLabels,
  categoryIcons,
}: MobileMapPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(''); // empty means all
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showListView, setShowListView] = useState(false);
  const [locateRequest, setLocateRequest] = useState(0);

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

  const hotCategories = [
    { key: '', label: '全部', icon: <LayoutGrid size={14} /> },
    { key: 'stream', label: '溯溪', icon: <Waves size={14} /> },
    { key: 'scenic', label: '景点', icon: <Mountain size={14} /> },
    { key: 'food', label: '美食', icon: <UtensilsCrossed size={14} /> },
  ];


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
          categoryColors={categoryColors}
          categoryLabels={categoryLabels}
          categoryIcons={categoryIcons}
          searchSlot={
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none" onClick={(e) => e.stopPropagation()}>
              {hotCategories.map(cat => {
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    id={`m_cat_${cat.key || 'all'}`}
                    onClick={() => { setActiveCategory(cat.key); onSelectPlace(null); }}
                    className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap border transition-all duration-200 flex items-center gap-1.5 shrink-0 outline-none active:scale-[0.96] ${
                      isActive
                        ? 'bg-gradient-to-b from-blue-500 to-blue-600 border-transparent text-white shadow-md shadow-blue-500/25'
                        : 'bg-white/70 border-white/50 text-slate-500 backdrop-blur-sm hover:bg-white/90 shadow-sm'
                    }`}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
              <button
                id="m_cat_more"
                onClick={() => setShowFilterSheet(true)}
                className="px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap border border-white/50 bg-white/70 text-slate-500 backdrop-blur-sm outline-none shrink-0 flex items-center gap-1.5 shadow-sm hover:bg-white/90 active:scale-[0.96] transition-all duration-200"
              >
                <Sparkles size={13} className="text-violet-400" />
                <span>筛选</span>
              </button>

              <button
                id="m_btn_toggle_list"
                onClick={() => setShowListView(!showListView)}
                className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap border outline-none shrink-0 flex items-center gap-1.5 active:scale-[0.96] transition-all duration-200 ${
                  showListView
                    ? 'bg-gradient-to-b from-blue-500 to-blue-600 border-transparent text-white shadow-md shadow-blue-500/25'
                    : 'bg-white/70 border-white/50 text-slate-500 backdrop-blur-sm hover:bg-white/90 shadow-sm'
                }`}
              >
                <LayoutList size={13} />
                <span>列表</span>
              </button>

              <button
                id="m_btn_add_place"
                onClick={onRequestEditor}
                className="px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap border border-transparent bg-gradient-to-b from-blue-500 to-blue-600 text-white outline-none shrink-0 flex items-center gap-1.5 shadow-md shadow-blue-500/25 active:scale-[0.96] transition-all duration-200"
              >
                <MapPinPlus size={13} />
                <span>添加</span>
              </button>
            </div>
          }
        />
      </div>

      {/* 4. Current location is an independent primary map control. */}
      {!showListView && (
        <button
          id="m_btn_locate"
          type="button"
          onClick={() => setLocateRequest(Date.now())}
          aria-label="定位到当前位置"
          className="absolute right-3 top-28 z-30 flex min-h-11 items-center gap-2 rounded-2xl border border-blue-100 bg-white/95 px-3.5 text-xs font-bold text-blue-600 shadow-lg backdrop-blur-md outline-none transition-colors duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-400 active:bg-blue-100"
        >
          <Crosshair size={17} />
          <span>当前位置</span>
        </button>
      )}

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
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl z-10 p-5 space-y-4 max-h-[80vh] overflow-y-auto animate-slide-up">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-base">高级检索与分类筛选</h4>
                <p className="text-xs text-slate-400 mt-0.5">选择分类类别或旅行到访状态过滤</p>
              </div>
              <button 
                onClick={() => setShowFilterSheet(false)}
                className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 outline-none"
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
                  setActiveCategory('');
                  setSelectedDifficulty('');
                  setWetFilter(false);
                  setFavoritesOnly(false);
                  setRecommendedOnly(false);
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

      {/* 7. Places List View Overlay Modal */}
      {showListView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center animate-fade-in">
          <div className="absolute inset-0" onClick={() => setShowListView(false)}></div>
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 flex flex-col max-h-[85vh] overflow-hidden">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-800 text-base">采集打卡点检索清单</h4>
                <p className="text-xs text-slate-400 mt-0.5">当前筛选出 {filteredPlaces.length} 个足迹标记点</p>
              </div>
              <button 
                onClick={() => setShowListView(false)}
                className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 outline-none"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable list of places */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 pb-8">
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
