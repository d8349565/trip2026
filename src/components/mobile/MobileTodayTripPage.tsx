import React from 'react';
import { Trip, TripDay, TripItem, Place } from '../../types';
import { 
  Calendar, CheckCircle, Circle, MapPin, Clock, Navigation, 
  Check, ArrowRight, ShieldAlert, Sparkles, ChevronDown, HelpCircle 
} from 'lucide-react';

interface MobileTodayTripPageProps {
  activeTrip: Trip | null;
  activeDay: TripDay | null;
  items: TripItem[];
  places: Place[];
  onUpdateItemStatus: (itemId: string, status: 'pending' | 'completed' | 'skipped') => void;
  onNavigateToPlace: (placeId: string) => void;
  onOpenTripSelector: () => void;
  onOpenDaySelector: () => void;
  allDays: TripDay[];
}

export default function MobileTodayTripPage({
  activeTrip,
  activeDay,
  items,
  places,
  onUpdateItemStatus,
  onNavigateToPlace,
  onOpenTripSelector,
  onOpenDaySelector,
  allDays,
}: MobileTodayTripPageProps) {
  if (!activeTrip) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-5 bg-white rounded-2xl border border-slate-100 shadow-sm font-sans">
        <Calendar size={40} className="text-slate-300" />
        <p className="text-[15px] font-extrabold text-slate-800 mt-3">暂无行程</p>
        <p className="text-[12px] text-slate-400 mt-1 text-center">点底部「+」→ 创建行程，开始规划路线</p>
        <button
          type="button"
          onClick={onOpenTripSelector}
          className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
        >
          创建行程
        </button>
      </div>
    );
  }

  if (!activeDay) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-5 bg-white rounded-2xl border border-slate-100 shadow-sm font-sans">
        <MapPin size={40} className="text-slate-300" />
        <p className="text-[15px] font-extrabold text-slate-800 mt-3">未添加日程</p>
        <p className="text-[12px] text-slate-400 mt-1 text-center">为行程「{activeTrip.title}」添加 Day 编排路线</p>
        <button
          type="button"
          onClick={onOpenTripSelector}
          className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
        >
          管理日程
        </button>
      </div>
    );
  }

  // Get current active item (first pending one)
  const currentActiveItem = items.find(item => item.status === 'pending') || items[items.length - 1];

  // Helper to find place coordinates or address
  const getPlaceInfo = (placeId?: string) => {
    if (!placeId) return null;
    return places.find(p => p.id === placeId) || null;
  };

  return (
    <div className="space-y-4 select-none font-sans">
      
      {/* 0. Trip & Day Quick-Selector Bar */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <button
          type="button"
          id="m_btn_open_trip_select"
          onClick={onOpenTripSelector}
          className="flex items-center justify-between px-4 py-2.5 bg-white border border-slate-100 rounded-xl shadow-xs active:scale-98 transition-all text-left outline-none min-h-[46px]"
        >
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">正在进行的行程</p>
            <p className="text-[13px] font-black text-slate-800 truncate mt-0.5">{activeTrip.title}</p>
          </div>
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          id="m_btn_open_day_select"
          onClick={onOpenDaySelector}
          className="flex items-center justify-between px-4 py-2.5 bg-white border border-slate-100 rounded-xl shadow-xs active:scale-98 transition-all text-left outline-none min-h-[46px]"
        >
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">执行日程天数</p>
            <p className="text-[13px] font-black text-slate-800 truncate mt-0.5">Day {activeDay.day_number} - {activeDay.title}</p>
          </div>
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </button>
      </div>
      
      {/* 1. Primary Highlight Card (Today's Executive Dashboard) */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-4.5 shadow-md space-y-4">
        {/* Header Metadata */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <span className="text-[11px] font-black tracking-widest bg-white/20 px-2 py-0.5 rounded-md text-blue-50">
              DAY {activeDay.day_number}
            </span>
            <h3 className="font-extrabold text-[16px] mt-1.5 leading-snug truncate max-w-[200px]">{activeDay.title}</h3>
            <p className="text-[12px] text-blue-100 mt-0.5 font-semibold">{activeDay.date}</p>
          </div>
          
          <div className="text-right">
            <span className="text-[12px] font-bold text-amber-300 flex items-center gap-0.5 justify-end">
              ☀️ {activeDay.weather_note || '晴朗 32℃'}
            </span>
            <span className="text-[11px] font-bold text-blue-200 block mt-1.5">
              强度：{activeDay.intensity === 'easy' ? '轻松舒适' : activeDay.intensity === 'hard' ? '硬核拉练' : '中等强度'}
            </span>
          </div>
        </div>

        {/* Big Dashboard Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/10 text-center">
          <div>
            <p className="text-[11px] text-blue-200">预计里程</p>
            <p className="text-[14px] font-black mt-0.5">{activeDay.planned_distance || 0} km</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-200">自驾车程</p>
            <p className="text-[14px] font-black mt-0.5">{activeDay.planned_drive_time || 0} min</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-200">当日预算</p>
            <p className="text-[14px] font-black mt-0.5">{activeDay.planned_cost || 0} 元</p>
          </div>
        </div>

        {/* Current Station Focus & Main Action Panel */}
        {currentActiveItem ? (
          <div className="bg-white/10 rounded-xl p-3 flex items-center justify-between gap-3 min-h-[56px]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-md shrink-0">下一站</span>
                <span className="text-blue-100 text-[12px] font-mono font-bold shrink-0">{currentActiveItem.start_time || '09:00'}</span>
              </div>
              <p className="font-extrabold text-[13px] text-white truncate mt-1">{currentActiveItem.title}</p>
            </div>

            <div className="flex gap-1.5 shrink-0">
              {currentActiveItem.place_id && (
                <button
                  id="m_exe_nav"
                  onClick={() => onNavigateToPlace(currentActiveItem.place_id!)}
                  className="px-2.5 py-2 bg-white text-blue-600 rounded-lg text-[11px] font-black flex items-center gap-0.5 shadow-sm outline-none min-h-[34px]"
                >
                  <Navigation size={11} className="rotate-45" />
                  <span>导航</span>
                </button>
              )}
              <button
                id="m_exe_skip"
                onClick={() => onUpdateItemStatus(currentActiveItem.id, 'skipped')}
                className="px-2 py-2 bg-white/20 text-white hover:bg-white/30 rounded-lg text-[11px] font-black outline-none min-h-[34px]"
              >
                跳过
              </button>
              <button
                id="m_exe_done"
                onClick={() => onUpdateItemStatus(currentActiveItem.id, 'completed')}
                className="px-2.5 py-2 bg-amber-400 text-slate-900 rounded-lg text-[11px] font-black flex items-center gap-0.5 shadow-sm outline-none min-h-[34px]"
              >
                <Check size={11} strokeWidth={3} />
                <span>完成</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-2.5 text-xs text-blue-100 font-bold">
            🎉 今日全部自驾行程均已打卡完成！
          </div>
        )}
      </div>

      {/* 2. Timeline List View */}
      <div className="space-y-3.5 pt-1">
        <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">今日自驾节点路线 ({items.length})</span>
        
        <div className="relative border-l border-slate-200 ml-3 pl-4 space-y-4 py-1">
          {items.map((item, index) => {
            const placeInfo = getPlaceInfo(item.place_id);
            const isCompleted = item.status === 'completed';
            const isSkipped = item.status === 'skipped';

            return (
              <div key={item.id} className="relative">
                {/* Timeline node icon */}
                <span className="absolute -left-7 top-1 w-6 h-6 rounded-full flex items-center justify-center border bg-white z-10 shadow-xs select-none">
                  {isCompleted ? (
                    <span className="w-5 h-5 bg-emerald-500 border-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">✓</span>
                  ) : isSkipped ? (
                    <span className="w-5 h-5 bg-slate-200 border-slate-200 text-slate-500 rounded-full flex items-center justify-center text-[10px] font-bold">✕</span>
                  ) : (
                    <button
                      id={`m_status_check_${item.id}`}
                      onClick={() => onUpdateItemStatus(item.id, 'completed')}
                      className="w-5 h-5 bg-white border border-slate-300 text-slate-400 rounded-full hover:border-blue-500 flex items-center justify-center text-xs outline-none"
                    >
                      ○
                    </button>
                  )}
                </span>

                {/* Timeline Item Card */}
                <div className={`rounded-xl border p-3.5 bg-white transition-all ${isCompleted ? 'border-emerald-100 opacity-80 shadow-xs' : isSkipped ? 'border-slate-100 opacity-60 shadow-none' : 'border-slate-100 shadow-sm'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[12px] font-black text-slate-800">{item.start_time || '09:00'}</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                          item.priority === 'must' ? 'bg-red-50 text-red-600 border border-red-100' :
                          item.priority === 'optional' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          'bg-slate-50 text-slate-500 border border-slate-100'
                        }`}>
                          {item.priority === 'must' ? '必打卡' : item.priority === 'optional' ? '自选点' : '备用'}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-[14px] mt-1.5 leading-snug truncate">
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {isCompleted ? (
                        <button
                          id={`m_undo_${item.id}`}
                          onClick={() => onUpdateItemStatus(item.id, 'pending')}
                          className="text-[12px] font-bold text-blue-500 px-2.5 py-1.5 bg-blue-50/50 rounded-lg outline-none min-h-[30px]"
                        >
                          撤销
                        </button>
                      ) : (
                        <>
                          <button
                            id={`m_compl_${item.id}`}
                            onClick={() => onUpdateItemStatus(item.id, 'completed')}
                            className="text-[12px] font-bold text-emerald-600 px-2.5 py-1.5 bg-emerald-50 rounded-lg outline-none min-h-[30px]"
                          >
                            完成
                          </button>
                          <button
                            id={`m_skip_${item.id}`}
                            onClick={() => onUpdateItemStatus(item.id, 'skipped')}
                            className="text-[12px] font-bold text-slate-400 px-2.5 py-1.5 bg-slate-50 rounded-lg outline-none min-h-[30px]"
                          >
                            跳过
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Place description address */}
                  {placeInfo && (
                    <div className="mt-1.5 text-[12px] text-slate-400 flex items-center gap-1 font-semibold">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{placeInfo.address}</span>
                    </div>
                  )}

                  {/* Notes & Essential checklist */}
                  {item.note && (
                    <p className="text-[13px] text-slate-600 bg-slate-50 p-2.5 rounded-lg leading-relaxed mt-2 border border-slate-100/50">
                      📝 {item.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
