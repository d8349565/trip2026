import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Smile, MapPin, Tag, ThumbsUp, DollarSign, Cloud, Users, Star } from 'lucide-react';
import { Place, Trip, TripDay, Visit } from '../../types';

interface MobileQuickVisitSheetProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  trips: Trip[];
  tripDays: TripDay[];
  activeTrip: Trip | null;
  activeDay: TripDay | null;
  onCreateVisit: (visitData: Partial<Visit>) => Promise<any>;
  onMarkVisited: (placeId: string) => Promise<any>;
}

export default function MobileQuickVisitSheet({
  isOpen,
  onClose,
  places,
  trips,
  tripDays,
  activeTrip,
  activeDay,
  onCreateVisit,
  onMarkVisited,
}: MobileQuickVisitSheetProps) {
  if (!isOpen) return null;

  // Search places
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  
  // Form values
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedTripId, setSelectedTripId] = useState<string>(activeTrip?.id || '');
  const [selectedDayId, setSelectedDayId] = useState<string>(activeDay?.id || '');
  const [weather, setWeather] = useState('晴朗');
  const [companions, setCompanions] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [actualCost, setActualCost] = useState<string>('');
  const [revisitIntention, setRevisitIntention] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [note, setNote] = useState('');

  // Suggestions for places
  const filteredPlaces = searchQuery.trim() === ''
    ? places.slice(0, 5) // Default list
    : places.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.address.toLowerCase().includes(searchQuery.toLowerCase()));

  // Available days for selected trip
  const availableDays = selectedTripId
    ? tripDays.filter(d => d.trip_id === selectedTripId).sort((a, b) => a.day_number - b.day_number)
    : [];

  useEffect(() => {
    // Sync day when trip changes
    if (selectedTripId) {
      const days = tripDays.filter(d => d.trip_id === selectedTripId).sort((a, b) => a.day_number - b.day_number);
      if (days.length > 0) {
        setSelectedDayId(days[0].id);
      } else {
        setSelectedDayId('');
      }
    } else {
      setSelectedDayId('');
    }
  }, [selectedTripId, tripDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlace) {
      alert('请先选择一个地点');
      return;
    }

    try {
      const visitData: Partial<Visit> = {
        place_id: selectedPlace.id,
        visit_date: visitDate,
        trip_id: selectedTripId || undefined,
        rating: rating,
        weather: weather || undefined,
        companions: companions || undefined,
        actual_cost: actualCost ? parseFloat(actualCost) : undefined,
        revisit_intention: revisitIntention,
        note: note || undefined,
      };

      // 1. Create visit record
      await onCreateVisit(visitData);

      // 2. Automatically mark place as visited
      if (selectedPlace.status !== 'visited') {
        await onMarkVisited(selectedPlace.id);
      }

      alert(`成功记录到访「${selectedPlace.name}」并已标记为已去过！`);
      onClose();
    } catch (err) {
      console.error(err);
      alert('记录失败，请重试');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end animate-fade-in">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl z-10 flex flex-col max-h-[90vh] animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base font-sans">快速记录到访</h3>
            <p className="text-xs text-slate-400 mt-0.5">签到打卡并录入本次出行的实际到访数据</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 active:scale-95 transition-all outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4.5 pb-8 font-sans">
          
          {/* 1. Place Selector */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
              <MapPin size={14} className="text-blue-500" />
              <span>选择打卡地点 <span className="text-red-500">*</span></span>
            </label>
            
            {selectedPlace ? (
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-[14px] text-slate-800">{selectedPlace.name}</h4>
                  <p className="text-[12px] text-slate-400 mt-0.5 truncate max-w-[240px]">{selectedPlace.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPlace(null)}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg text-[11px] font-bold"
                >
                  重选
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="搜索现有地点或选择下方推荐..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
                />
                
                {/* Search Results Suggestions */}
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-40 overflow-y-auto bg-white">
                  {filteredPlaces.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlace(p);
                        setSearchQuery('');
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-[13px] hover:bg-slate-50 flex items-center justify-between font-sans outline-none"
                    >
                      <span className="font-extrabold text-slate-700 truncate mr-2">{p.name}</span>
                      <span className="text-[11px] text-slate-400 shrink-0 truncate max-w-[140px]">{p.address}</span>
                    </button>
                  ))}
                  {filteredPlaces.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">未找到对应地点</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Visit Date */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
              <Calendar size={14} className="text-blue-500" />
              <span>到访日期 <span className="text-red-500">*</span></span>
            </label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:border-blue-500 focus:bg-white font-sans"
            />
          </div>

          {/* 3. Trip & Day (Optional Linkage) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
                <Tag size={14} className="text-slate-400" />
                <span>关联行程</span>
              </label>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:border-blue-500 focus:bg-white font-sans"
              >
                <option value="">不关联具体行程</option>
                {trips.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
                <Clock size={14} className="text-slate-400" />
                <span>所属日程</span>
              </label>
              <select
                value={selectedDayId}
                onChange={(e) => setSelectedDayId(e.target.value)}
                disabled={!selectedTripId}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:border-blue-500 focus:bg-white disabled:opacity-50 font-sans"
              >
                <option value="">不关联具体天数</option>
                {availableDays.map(d => (
                  <option key={d.id} value={d.id}>Day {d.day_number} - {d.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Weather & Companions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
                <Cloud size={14} className="text-slate-400" />
                <span>天气状况</span>
              </label>
              <input
                type="text"
                placeholder="晴朗/下雨/微风 32℃"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:border-blue-500 focus:bg-white font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
                <Users size={14} className="text-slate-400" />
                <span>同行人员</span>
              </label>
              <input
                type="text"
                placeholder="例如：独自/朋友/家人"
                value={companions}
                onChange={(e) => setCompanions(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:border-blue-500 focus:bg-white font-sans"
              />
            </div>
          </div>

          {/* 5. Rating & Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
                <Star size={14} className="text-blue-500" />
                <span>个人体验评分</span>
              </label>
              <div className="flex gap-1.5 items-center py-2.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-0.5 outline-none"
                  >
                    <Star
                      size={20}
                      fill={star <= rating ? '#eab308' : 'none'}
                      className={star <= rating ? 'text-yellow-500' : 'text-slate-300'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
                <DollarSign size={14} className="text-slate-400" />
                <span>实际费用 (元)</span>
              </label>
              <input
                type="number"
                placeholder="0"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:border-blue-500 focus:bg-white font-sans"
              />
            </div>
          </div>

          {/* 6. Revisit Intention */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
              <ThumbsUp size={14} className="text-slate-400" />
              <span>是否愿意再去？</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['yes', 'maybe', 'no'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setRevisitIntention(opt)}
                  className={`py-2 px-3 rounded-xl border text-center text-xs font-bold transition-all outline-none ${
                    revisitIntention === opt
                      ? 'border-blue-500 bg-blue-50/40 text-blue-600'
                      : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {opt === 'yes' ? '极力推崇' : opt === 'maybe' ? '视情况定' : '不推荐去'}
                </button>
              ))}
            </div>
          </div>

          {/* 7. Note */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-black text-slate-700 flex items-center gap-1">
              <Smile size={14} className="text-slate-400" />
              <span>记录到访心得</span>
            </label>
            <textarea
              placeholder="水质好不好？路况如何？分享一点本次出行的避坑/打卡实况吧..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:border-blue-500 focus:bg-white resize-none font-sans"
            />
          </div>

          {/* Action Button */}
          <button
            type="submit"
            id="m_btn_submit_quick_visit"
            className="w-full py-3 px-5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-[14px] rounded-xl shadow-md shadow-blue-500/20 transition-all outline-none"
          >
            保存并记录足迹
          </button>
        </form>
      </div>
    </div>
  );
}
