import React, { useState } from 'react';
import { X, ArrowLeft, Calendar, DollarSign, Cloud, Users, Star, ThumbsUp, MapPin, Compass, Search } from 'lucide-react';
import { Visit, Place, Trip } from '../../types';

interface MobileVisitListPageProps {
  visits: Visit[];
  places: Place[];
  trips: Trip[];
  onBack: () => void;
  onNavigateToPlaceDetail: (place: Place) => void;
}

export default function MobileVisitListPage({
  visits,
  places,
  trips,
  onBack,
  onNavigateToPlaceDetail,
}: MobileVisitListPageProps) {
  const [filterType, setFilterType] = useState<'all' | 'month' | 'trip' | 'place'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTripFilter, setSelectedTripFilter] = useState('');
  const [selectedPlaceFilter, setSelectedPlaceFilter] = useState('');

  const getPlace = (placeId: string) => {
    return places.find(p => p.id === placeId);
  };

  const getTripTitle = (tripId?: string) => {
    if (!tripId) return '';
    return trips.find(t => t.id === tripId)?.title || '';
  };

  // Filter visits
  const filteredVisits = visits.filter(v => {
    const place = getPlace(v.place_id);
    if (!place) return false;

    // Search query matches place name or note
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchesPlace = place.name.toLowerCase().includes(q);
      const matchesNote = v.note?.toLowerCase().includes(q) || false;
      if (!matchesPlace && !matchesNote) return false;
    }

    if (filterType === 'month') {
      // Current month & year
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const yearMonthPrefix = `${year}-${month}`;
      if (!v.visit_date.startsWith(yearMonthPrefix)) return false;
    }

    if (filterType === 'trip' && selectedTripFilter) {
      if (v.trip_id !== selectedTripFilter) return false;
    }

    if (filterType === 'place' && selectedPlaceFilter) {
      if (v.place_id !== selectedPlaceFilter) return false;
    }

    return true;
  }).sort((a, b) => b.visit_date.localeCompare(a.visit_date));

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50 pb-[calc(4rem+env(safe-area-inset-bottom))] font-sans select-none">
      {/* Header */}
      <header className="bg-white px-4 py-4.5 border-b border-slate-100 flex items-center justify-between shadow-xs shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-all outline-none"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-extrabold text-[16px] text-slate-800">打卡到访记录</h2>
        </div>
        <span className="text-[12px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
          共 {visits.length} 次打卡
        </span>
      </header>

      {/* Tabs and Filters */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 shrink-0 space-y-3">
        {/* Quick Tabs */}
        <div className="flex bg-slate-100 p-0.5 rounded-xl">
          {(['all', 'month', 'trip', 'place'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setFilterType(tab);
                setSearchQuery('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all outline-none ${
                filterType === tab ? 'bg-white text-blue-600 shadow-xs font-black' : 'text-slate-500'
              }`}
            >
              {tab === 'all' ? '全部打卡' : tab === 'month' ? '本月记录' : tab === 'trip' ? '按行程' : '按地点'}
            </button>
          ))}
        </div>

        {/* Conditional filter settings */}
        {filterType === 'all' && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索到访地点或记录心得内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-base outline-none focus:border-blue-500 focus:bg-white font-sans"
            />
          </div>
        )}

        {filterType === 'trip' && (
          <select
            value={selectedTripFilter}
            onChange={(e) => setSelectedTripFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold outline-none font-sans"
          >
            <option value="">选择关联行程规划过滤...</option>
            {trips.map(t => (
              <option key={t.id} value={t.id}>{t.title} ({t.start_date})</option>
            ))}
          </select>
        )}

        {filterType === 'place' && (
          <select
            value={selectedPlaceFilter}
            onChange={(e) => setSelectedPlaceFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold outline-none font-sans"
          >
            <option value="">选择特定地点过滤...</option>
            {places.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-12">
        {filteredVisits.map((v) => {
          const place = getPlace(v.place_id)!;
          const tripTitle = getTripTitle(v.trip_id);

          return (
            <div
              key={v.id}
              onClick={() => onNavigateToPlaceDetail(place)}
              className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-xs hover:border-blue-100 transition-all cursor-pointer space-y-3.5"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h4 className="font-extrabold text-[15px] text-slate-800 truncate leading-snug">
                    {place.name}
                  </h4>
                  <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-slate-400">
                    <MapPin size={10} className="shrink-0" />
                    <span className="truncate">{place.address}</span>
                  </div>
                </div>

                {/* Date */}
                <span className="text-[11px] font-black font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                  <Calendar size={10} />
                  <span>{v.visit_date}</span>
                </span>
              </div>

              {/* Grid Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-y border-slate-100/70 py-3 text-[12px] font-semibold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-500">★</span>
                  <span className="font-bold text-slate-700">评分：{v.rating} / 5</span>
                </div>

                {v.actual_cost !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={12} className="text-emerald-500 shrink-0" />
                    <span className="font-bold text-slate-700">花费：{v.actual_cost} 元</span>
                  </div>
                )}

                {v.weather && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Cloud size={12} className="text-blue-400 shrink-0" />
                    <span className="font-bold text-slate-700 truncate">天气：{v.weather}</span>
                  </div>
                )}

                {v.companions && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Users size={12} className="text-purple-400 shrink-0" />
                    <span className="font-bold text-slate-700 truncate">同行：{v.companions}</span>
                  </div>
                )}
              </div>

              {/* Note / Revisit Intention */}
              <div className="space-y-2">
                {v.note && (
                  <p className="text-[13px] text-slate-600 bg-slate-50 p-3 rounded-xl leading-relaxed border border-slate-100/50">
                    💡 <span className="font-medium">{v.note}</span>
                  </p>
                )}

                <div className="flex justify-between items-center text-[11px] font-bold">
                  {tripTitle && (
                    <span className="text-slate-400 flex items-center gap-0.5 truncate max-w-[200px]">
                      🚗 关联行程：{tripTitle}
                    </span>
                  )}
                  
                  <span className={`px-2 py-0.5 rounded-full shrink-0 font-extrabold ${
                    v.revisit_intention === 'yes' ? 'bg-emerald-50 text-emerald-600' :
                    v.revisit_intention === 'maybe' ? 'bg-amber-50 text-amber-600' :
                    'bg-red-50 text-red-600'
                  }`}>
                    {v.revisit_intention === 'yes' ? '极力推崇' :
                     v.revisit_intention === 'maybe' ? '视情况定' :
                     '不推荐再去'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredVisits.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 p-6 space-y-2">
            <span className="text-3xl block">🧭</span>
            <p className="text-sm font-extrabold text-slate-800">暂无符合条件的到访记录</p>
            <p className="text-xs text-slate-400">去过的新地点在添加打卡记录后会同步在列表中展示。</p>
          </div>
        )}
      </div>
    </div>
  );
}
