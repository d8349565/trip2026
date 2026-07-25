import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Sparkles, MapPin, Tag, AlertCircle, ArrowRight } from 'lucide-react';
import { Place, Trip, TripDay, TripItemType } from '../../types';

interface MobileAddPlaceToTripSheetProps {
  isOpen: boolean;
  onClose: () => void;
  place: Place;
  trips: Trip[];
  tripDays: TripDay[];
  onAddToTrip: (placeId: string, data: { trip_day_id: string; type?: string; start_time?: string; note?: string }) => Promise<any>;
  onNavigateToTrip: () => void;
}

export default function MobileAddPlaceToTripSheet({
  isOpen,
  onClose,
  place,
  trips,
  tripDays,
  onAddToTrip,
  onNavigateToTrip,
}: MobileAddPlaceToTripSheetProps) {
  if (!isOpen) return null;

  // Auto-suggest category/item type
  const getSuggestItemType = (category: string): TripItemType => {
    switch (category) {
      case 'food':
        return 'food';
      case 'accommodation':
      case 'camp':
        return 'accommodation';
      case 'parking':
        return 'parking';
      case 'charging':
        return 'charging';
      case 'stream':
      case 'scenic':
      case 'play':
      case 'hiking':
      case 'viewpoint':
      case 'family':
      default:
        return 'play';
    }
  };

  const [selectedTripId, setSelectedTripId] = useState<string>(trips[0]?.id || '');
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [itemType, setItemType] = useState<TripItemType>(getSuggestItemType(place.category_id));
  const [startTime, setStartTime] = useState('10:00');
  const [note, setNote] = useState(place.summary || '');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const activeTripDays = tripDays
    .filter(d => d.trip_id === selectedTripId)
    .sort((a, b) => a.day_number - b.day_number);

  useEffect(() => {
    if (activeTripDays.length > 0) {
      setSelectedDayId(activeTripDays[0].id);
    } else {
      setSelectedDayId('');
    }
  }, [selectedTripId, tripDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDayId) {
      alert('请先选择日程天数（Day）');
      return;
    }

    try {
      await onAddToTrip(place.id, {
        trip_day_id: selectedDayId,
        type: itemType,
        start_time: startTime,
        note: note,
      });

      const selectedTrip = trips.find(t => t.id === selectedTripId);
      const selectedDay = activeTripDays.find(d => d.id === selectedDayId);

      setSuccessMessage(`已成功加入「${selectedTrip?.title || ''}」Day ${selectedDay?.day_number || 1}`);
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert('加入行程失败，请重试');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end animate-fade-in">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl z-10 flex flex-col max-h-[85vh] animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base font-sans">加入旅行行程</h3>
            <p className="text-xs text-slate-400 mt-0.5">规划此地点进入您的某天自驾旅行线路</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 active:scale-95 transition-all outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 pb-[max(2rem,env(safe-area-inset-bottom))] font-sans">
          {isSuccess ? (
            <div className="text-center py-8 space-y-5">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                <Sparkles size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-slate-800 text-base">规划成功！</h4>
                <p className="text-sm font-bold text-slate-500">{successMessage}</p>
                <p className="text-xs text-slate-400 mt-1">您现在可以在今日行程列表中查看并更新它的打卡状态。</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl outline-none"
                >
                  留在原处
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToTrip();
                    onClose();
                  }}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-1 outline-none"
                >
                  <span>查看行程</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Place Card preview */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  <MapPin size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-xs text-slate-800 truncate">{place.name}</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{place.address}</p>
                </div>
              </div>

              {/* 1. Trip Selector */}
              <div className="space-y-1">
                <label className="text-[12px] font-black text-slate-700 flex items-center gap-1">
                  <Tag size={13} className="text-slate-400" />
                  <span>选择旅行路线 <span className="text-red-500">*</span></span>
                </label>
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white font-sans"
                >
                  {trips.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.start_date})</option>
                  ))}
                  {trips.length === 0 && (
                    <option value="">-- 请先创建一条行程规划 --</option>
                  )}
                </select>
              </div>

              {/* 2. Day Selector */}
              <div className="space-y-1">
                <label className="text-[12px] font-black text-slate-700 flex items-center gap-1">
                  <Calendar size={13} className="text-slate-400" />
                  <span>选择具体哪天日程 <span className="text-red-500">*</span></span>
                </label>
                <select
                  value={selectedDayId}
                  onChange={(e) => setSelectedDayId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white font-sans"
                >
                  {activeTripDays.map(d => (
                    <option key={d.id} value={d.id}>Day {d.day_number} - {d.title} ({d.date})</option>
                  ))}
                  {activeTripDays.length === 0 && (
                    <option value="">-- 当前行程没有日程天数，请先创建 --</option>
                  )}
                </select>
              </div>

              {/* 3. Item Type & Start Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-slate-700">项目类别</label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as TripItemType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white font-sans"
                  >
                    <option value="play">景点游玩 🎪</option>
                    <option value="food">饕餮美食 🍲</option>
                    <option value="accommodation">酒店/营地 🛌</option>
                    <option value="parking">停车补给 🅿️</option>
                    <option value="charging">充电加油 ⚡</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-black text-slate-700 flex items-center gap-1">
                    <Clock size={13} className="text-slate-400" />
                    <span>预计开始时间</span>
                  </label>
                  <input
                    type="text"
                    placeholder="例如 09:30"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white font-sans text-center font-mono"
                  />
                </div>
              </div>

              {/* 4. Memo */}
              <div className="space-y-1">
                <label className="text-[12px] font-black text-slate-700">自驾备忘 (选填)</label>
                <textarea
                  placeholder="可录入预计停留时长、行车提醒、门票等注意事项..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white resize-none font-sans"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={trips.length === 0 || activeTripDays.length === 0}
                className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all outline-none"
              >
                确认加入日程
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
