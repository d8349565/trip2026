import React from 'react';
import { X, Calendar, Route, Check } from 'lucide-react';
import { TripDay, TripItem } from '../../types';

interface MobileDaySelectorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  days: TripDay[];
  allItems: TripItem[];
  activeDayId: string | null;
  onSelectDay: (dayId: string) => void;
}

export default function MobileDaySelectorSheet({
  isOpen,
  onClose,
  days,
  allItems,
  activeDayId,
  onSelectDay,
}: MobileDaySelectorSheetProps) {
  if (!isOpen) return null;

  const getDayItemsCount = (dayId: string) => {
    return allItems.filter(item => item.trip_day_id === dayId).length;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end animate-fade-in">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full bg-slate-50/95 rounded-t-3xl shadow-2xl z-10 flex flex-col max-h-[75vh] animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-white rounded-t-3xl flex items-center justify-between shadow-xs shrink-0">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base font-sans">选择日程天数</h3>
            <p className="text-xs text-slate-400 mt-0.5">切换查看当日计划与已编排自驾路线</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 active:scale-95 transition-all outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 pb-10">
          {days.map((day) => {
            const isSelected = day.id === activeDayId;
            const itemsCount = getDayItemsCount(day.id);

            return (
              <button
                key={day.id}
                id={`m_select_day_item_${day.day_number}`}
                onClick={() => {
                  onSelectDay(day.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-4.5 p-4 rounded-xl border text-left transition-all outline-none ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50/35 ring-1 ring-blue-500/10' 
                    : 'border-slate-100 bg-white hover:bg-slate-50'
                }`}
              >
                {/* Day Marker Bubble */}
                <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 font-sans ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <span className="text-[9px] font-black leading-none tracking-wider opacity-85 uppercase">Day</span>
                  <span className="text-base font-extrabold leading-none mt-1">{day.day_number}</span>
                </div>

                {/* Day Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-slate-400 flex items-center gap-1">
                      <Calendar size={11} />
                      <span>{day.date}</span>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50/70 px-1.5 py-0.5 rounded-md">
                      {itemsCount} 个自驾卡点
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-[14px] leading-snug mt-1 truncate">
                    {day.title}
                  </h4>
                  {day.departure_place && day.destination_place && (
                    <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1 font-semibold truncate">
                      <Route size={11} className="text-slate-400 shrink-0" />
                      <span>{day.departure_place} ➔ {day.destination_place}</span>
                    </p>
                  )}
                </div>

                {/* Checked icon */}
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}

          {days.length === 0 && (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
              <span className="text-3xl">📭</span>
              <p className="text-sm font-extrabold text-slate-800 mt-2">此行程暂无日程天数</p>
              <p className="text-xs text-slate-400 mt-1">请至“日程规划 ⚙️”标签页添加天数 (Day)。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
