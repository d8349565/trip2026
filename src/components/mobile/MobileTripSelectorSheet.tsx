import React from 'react';
import { X, Calendar, Compass, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Trip, TripDay } from '../../types';

interface MobileTripSelectorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  trips: Trip[];
  tripDays: TripDay[];
  activeTripId: string | null;
  onSelectTrip: (tripId: string) => void;
}

export default function MobileTripSelectorSheet({
  isOpen,
  onClose,
  trips,
  tripDays,
  activeTripId,
  onSelectTrip,
}: MobileTripSelectorSheetProps) {
  if (!isOpen) return null;

  // Categorize trips
  const ongoingTrips = trips.filter(t => t.status === 'ongoing' || (t.status as string) === 'in_progress');
  const upcomingTrips = trips.filter(t => t.status === 'upcoming' || t.status === 'draft');
  const completedTrips = trips.filter(t => t.status === 'completed' || t.status === 'cancelled');

  const getDayCount = (tripId: string) => {
    return tripDays.filter(d => d.trip_id === tripId).length;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ongoing':
      case 'in_progress':
        return { label: '进行中', bg: 'bg-emerald-500/10 text-emerald-600' };
      case 'upcoming':
        return { label: '待出发', bg: 'bg-blue-500/10 text-blue-600' };
      case 'draft':
        return { label: '草稿箱', bg: 'bg-slate-100 text-slate-500' };
      case 'completed':
        return { label: '已完成', bg: 'bg-purple-500/10 text-purple-600' };
      default:
        return { label: '已取消', bg: 'bg-slate-100 text-slate-400' };
    }
  };

  const renderTripCard = (t: Trip) => {
    const isSelected = t.id === activeTripId;
    const statusInfo = getStatusLabel(t.status);
    const dayCount = getDayCount(t.id);

    return (
      <button
        key={t.id}
        id={`m_select_trip_item_${t.id}`}
        onClick={() => {
          onSelectTrip(t.id);
          onClose();
        }}
        className={`w-full flex items-center gap-3.5 p-4.5 rounded-2xl border text-left outline-none transition-all ${
          isSelected 
            ? 'border-blue-500 bg-blue-50/20 shadow-xs ring-1 ring-blue-500/10' 
            : 'border-slate-100 bg-white hover:bg-slate-50'
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}>
          <Compass size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${statusInfo.bg}`}>
              {statusInfo.label}
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {dayCount} 天行程
            </span>
          </div>
          <h4 className="font-extrabold text-slate-800 text-[14px] leading-snug mt-1 truncate">
            {t.title}
          </h4>
          <p className="text-[12px] text-slate-400 mt-0.5 font-semibold flex items-center gap-1">
            <Calendar size={11} className="shrink-0" />
            <span>{t.start_date} 至 {t.end_date}</span>
          </p>
        </div>
        {isSelected && (
          <CheckCircle2 size={18} className="text-blue-600 shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end animate-fade-in">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full bg-slate-50/95 rounded-t-3xl shadow-2xl z-10 flex flex-col max-h-[85vh] animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4.5 border-b border-slate-100 bg-white rounded-t-3xl flex items-center justify-between shadow-xs shrink-0">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">切换当前旅行路线</h3>
            <p className="text-xs text-slate-400 mt-0.5">选择您当前处于进行中、备选或已完成的行程</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 outline-none transition-all hover:bg-slate-200 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
          {/* Ongoing Section */}
          {ongoingTrips.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                进行中行程
              </span>
              <div className="space-y-2.5">
                {ongoingTrips.map(renderTripCard)}
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          {upcomingTrips.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                未来日程安排
              </span>
              <div className="space-y-2.5">
                {upcomingTrips.map(renderTripCard)}
              </div>
            </div>
          )}

          {/* Completed Section */}
          {completedTrips.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-xs font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                已结旅行足迹
              </span>
              <div className="space-y-2.5">
                {completedTrips.map(renderTripCard)}
              </div>
            </div>
          )}

          {trips.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 p-5">
              <span className="text-3xl">🏜️</span>
              <p className="text-sm font-extrabold text-slate-800 mt-2">暂无可用行程</p>
              <p className="text-xs text-slate-400 mt-1">请通过主页面的 "+" 按钮创建一条精彩的旅行日程吧！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
