/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trip, TripDay, TripItem, Place, Visit, Media, Checklist, ChecklistItem } from '../types';
import { 
  Plus, Calendar, MapPin, Check, Trash2, ArrowUpDown, Clock, 
  Car, ShieldAlert, Sparkles, Navigation, CheckCircle2, Circle, HelpCircle, AlertCircle,
  Edit, Save, CheckSquare, Image as ImageIcon
} from 'lucide-react';
import { getDefaultTripDateRange, isValidTripDateRange } from '../utils/tripDates';
import EmptyState from './EmptyState';

interface TripPlannerProps {
  trips: Trip[];
  tripDays: TripDay[];
  tripItems: TripItem[];
  places: Place[];
  checklists?: Checklist[];
  checklistItems?: ChecklistItem[];
  media?: Media[];
  visits?: Visit[];
  onCreateTrip: (trip: Partial<Trip>) => void;
  onDeleteTrip: (id: string) => void;
  onUpdateTripItem: (itemId: string, data: Partial<TripItem>) => void;
  onAddTripItem: (dayId: string, item: Partial<TripItem>) => void;
  onDeleteTripItem: (itemId: string) => void;
  onUpdateTripDay?: (dayId: string, data: Partial<TripDay>) => void;
  onUpdateChecklistItem?: (id: string, data: Partial<ChecklistItem>) => void;
}

export default function TripPlanner({
  trips,
  tripDays,
  tripItems,
  places,
  checklists = [],
  checklistItems = [],
  media = [],
  visits = [],
  onCreateTrip,
  onDeleteTrip,
  onUpdateTripItem,
  onAddTripItem,
  onDeleteTripItem,
  onUpdateTripDay,
  onUpdateChecklistItem
}: TripPlannerProps) {
  const [activeTripId, setActiveTripId] = useState<string | null>(trips[0]?.id || null);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(-1); // Default to -1 (Overview) for premium landing experience
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [mobileFullEditor, setMobileFullEditor] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({
    '车辆': false, '衣物': true, '药品': true, '亲子': false, '户外': false, '其他': true
  });

  const currentDaysTemp = tripDays.filter(d => d.trip_id === activeTripId);

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && activeDayIndex === -1 && currentDaysTemp.length > 0) {
        setActiveDayIndex(0); // Default to today (Day 1) on mobile
      }
    };
    window.addEventListener('resize', handleResize);
    // On mount check if mobile
    if (window.innerWidth < 768 && activeDayIndex === -1 && currentDaysTemp.length > 0) {
      setActiveDayIndex(0);
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [currentDaysTemp.length]);

  // Form states
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => getDefaultTripDateRange().startDate);
  const [endDate, setEndDate] = useState(() => getDefaultTripDateRange().endDate);
  const [origin, setOrigin] = useState('广州市');
  const [destSummary, setDestSummary] = useState('潮州市');
  const [vehicle, setVehicle] = useState('新能源汽车');
  const [budget, setBudget] = useState('2500');
  const [dateError, setDateError] = useState('');

  // Trip Day Summary Editing State
  const [isEditingDay, setIsEditingDay] = useState(false);
  const [editDayTitle, setEditDayTitle] = useState('');
  const [editDayDistance, setEditDayDistance] = useState('');
  const [editDayDriveTime, setEditDayDriveTime] = useState('');
  const [editDayCost, setEditDayCost] = useState('');
  const [editDayIntensity, setEditDayIntensity] = useState<'easy'|'moderate'|'hard'>('easy');
  const [editDayWeather, setEditDayWeather] = useState('');
  const [editDayNotes, setEditDayNotes] = useState('');

  // Trip Item Form State
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemType, setItemType] = useState<'play'|'food'|'drive'|'accommodation'|'rest'>('play');
  const [itemTitle, setItemTitle] = useState('');
  const [itemTime, setItemTime] = useState('09:00');
  const [itemNote, setItemNote] = useState('');

  const activeTrip = trips.find(t => t.id === activeTripId) || null;
  const currentDays = tripDays.filter(d => d.trip_id === activeTripId);
  const currentDay = currentDays[activeDayIndex] || null;
  const currentItems = currentDay ? tripItems.filter(item => item.trip_day_id === currentDay.id).sort((a,b) => a.sort_order - b.sort_order) : [];

  const handleCreateTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) return;
    if (!isValidTripDateRange(startDate, endDate)) {
      setDateError('结束日期不能早于开始日期，请重新选择。');
      return;
    }
    setDateError('');
    onCreateTrip({
      title,
      start_date: startDate,
      end_date: endDate,
      origin,
      destination_summary: destSummary,
      vehicle,
      budget: parseFloat(budget),
      status: 'upcoming'
    });
    setShowCreateTripModal(false);
  };

  const openCreateTripModal = () => {
    const defaults = getDefaultTripDateRange();
    setTitle('');
    setStartDate(defaults.startDate);
    setEndDate(defaults.endDate);
    setDateError('');
    setShowCreateTripModal(true);
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDay || !itemTitle) return;
    onAddTripItem(currentDay.id, {
      title: itemTitle,
      type: itemType,
      start_time: itemTime,
      note: itemNote,
      priority: 'must',
      status: 'pending'
    });
    setItemTitle('');
    setItemNote('');
    setShowAddItem(false);
  };

  const startEditDay = () => {
    if (!currentDay) return;
    setEditDayTitle(currentDay.title || '');
    setEditDayDistance(currentDay.planned_distance?.toString() || '');
    setEditDayDriveTime(currentDay.planned_drive_time?.toString() || '');
    setEditDayCost(currentDay.planned_cost?.toString() || '');
    setEditDayIntensity(currentDay.intensity || 'easy');
    setEditDayWeather(currentDay.weather_note || '');
    setEditDayNotes(currentDay.notes || '');
    setIsEditingDay(true);
  };

  const handleSaveDaySummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDay || !onUpdateTripDay) return;
    onUpdateTripDay(currentDay.id, {
      title: editDayTitle,
      planned_distance: editDayDistance ? parseFloat(editDayDistance) : undefined,
      planned_drive_time: editDayDriveTime ? parseInt(editDayDriveTime) : undefined,
      planned_cost: editDayCost ? parseFloat(editDayCost) : undefined,
      intensity: editDayIntensity,
      weather_note: editDayWeather,
      notes: editDayNotes
    });
    setIsEditingDay(false);
  };

  const toggleCat = (cat: string) => {
    setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (isMobile && !mobileFullEditor && activeTrip) {
    const nextStop = currentItems.find(item => item.status !== 'completed' && item.status !== 'skipped');
    
    // Find active trip checklist
    const relatedChecklists = checklists.filter(cl => cl.trip_id === activeTrip.id);
    const activeTripChecklist = relatedChecklists[0] || checklists[0] || null;
    const activeTripChecklistItems = activeTripChecklist ? checklistItems.filter(item => item.checklist_id === activeTripChecklist.id) : [];

    // Group activeTripChecklistItems by category
    const checkCats: Record<string, ChecklistItem[]> = {};
    activeTripChecklistItems.forEach(item => {
      const cat = item.category || '其他';
      if (!checkCats[cat]) checkCats[cat] = [];
      checkCats[cat].push(item);
    });

    return (
      <div className="h-full flex flex-col overflow-hidden space-y-4">
        {/* Mobile Header with Day Selector & Editor Toggle */}
        <div className="shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <span>🚗</span>
                <span className="truncate max-w-[150px]">{activeTrip.title}</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold">{activeTrip.start_date} ~ {activeTrip.end_date}</p>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMobileFullEditor(true)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all"
              >
                <Edit size={11} />
                <span>编辑日程</span>
              </button>
              <button
                onClick={() => setShowCreateTripModal(true)}
                className="p-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100"
                title="创建新行程"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Quick switcher tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none border-b border-slate-100">
            {currentDays.map((day, idx) => (
              <button
                key={day.id}
                onClick={() => setActiveDayIndex(idx)}
                className={`px-3.5 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap transition-all ${
                  activeDayIndex === idx
                    ? 'bg-blue-600 text-white shadow-sm font-extrabold scale-102'
                    : 'bg-slate-50 text-slate-500 border border-slate-150 hover:bg-slate-100'
                }`}
              >
                Day {day.day_number}
              </button>
            ))}
            <button
              onClick={() => setActiveDayIndex(-1)}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap transition-all ${
                activeDayIndex === -1
                  ? 'bg-blue-600 text-white shadow-sm font-extrabold scale-102'
                  : 'bg-slate-50 text-slate-500 border border-slate-150 hover:bg-slate-100'
              }`}
            >
              📊 总览
            </button>
          </div>
        </div>

        {/* Dynamic content area */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1 scrollbar-thin">
          {activeDayIndex === -1 ? (
            <TripOverviewDashboard 
              trip={activeTrip}
              days={currentDays}
              items={tripItems}
              places={places}
              checklists={checklists}
              checklistItems={checklistItems}
              media={media}
              visits={visits}
            />
          ) : currentDay ? (
            <>
              {/* Day info strip card */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-slate-800">
                    Day {currentDay.day_number}: {currentDay.title}
                  </h4>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                    currentDay.intensity === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                    currentDay.intensity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                    currentDay.intensity === 'hard' ? 'bg-rose-100 text-rose-700' : 'bg-slate-150 text-slate-500'
                  }`}>
                    {currentDay.intensity === 'easy' ? '🟢 轻松' :
                     currentDay.intensity === 'moderate' ? '🟡 中等' :
                     currentDay.intensity === 'hard' ? '🔴 硬核' : '未设置'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-[9px] text-slate-500">
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                    <p className="text-[8px] text-slate-400 font-extrabold uppercase">🛣️ 里程</p>
                    <p className="font-extrabold text-slate-700">{currentDay.planned_distance ? `${currentDay.planned_distance}km` : '--'}</p>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                    <p className="text-[8px] text-slate-400 font-extrabold uppercase">⏱️ 驾驶</p>
                    <p className="font-extrabold text-slate-700">{currentDay.planned_drive_time ? `${currentDay.planned_drive_time}m` : '--'}</p>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                    <p className="text-[8px] text-slate-400 font-extrabold uppercase">💰 预计</p>
                    <p className="font-extrabold text-slate-700 font-mono">¥{currentDay.planned_cost || '0'}</p>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                    <p className="text-[8px] text-slate-400 font-extrabold uppercase">☀️ 天气</p>
                    <p className="font-extrabold text-slate-700 truncate px-0.5">{currentDay.weather_note || '晴'}</p>
                  </div>
                </div>

                {currentDay.notes && (
                  <p className="text-[10px] text-amber-800 bg-amber-50/75 p-2.5 rounded-xl border border-amber-100 font-medium">
                    🔑 <b>本日备忘：</b>{currentDay.notes}
                  </p>
                )}
              </div>

              {/* Next stop indicator card */}
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl shadow-md space-y-1 animate-in fade-in duration-200">
                <span className="text-[9px] font-black text-blue-100 uppercase tracking-wider block">ROUTE PROGRESS · 下一站</span>
                {nextStop ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold">{nextStop.title}</p>
                      <p className="text-[10px] text-blue-100">预计到达: {nextStop.start_time || '待定'}</p>
                    </div>
                    <button
                      onClick={() => onUpdateTripItem(nextStop.id, { status: 'completed' })}
                      className="px-3 py-1 bg-white text-blue-600 hover:bg-blue-50 text-[10px] font-black rounded-lg active:scale-95 transition-all shadow-sm"
                    >
                      打卡去过
                    </button>
                  </div>
                ) : (
                  <p className="text-xs font-extrabold py-1">🎉 今日打卡任务已全部完成！</p>
                )}
              </div>

              {/* Actionable timeline of current day */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">本日时间线计划</p>
                {currentItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    今天还没有任何安排项，可点击右上角“编辑日程”进行添加
                  </div>
                ) : (
                  <div className="relative pl-3 border-l border-slate-200 space-y-3.5">
                    {currentItems.map(item => {
                      const isCompleted = item.status === 'completed';
                      return (
                        <div 
                          key={item.id}
                          className={`relative p-3 rounded-xl border select-none transition-all ${
                            isCompleted ? 'bg-emerald-50/20 border-emerald-100/70 text-slate-400' : 'bg-white border-slate-150'
                          }`}
                        >
                          {/* Chrono dot button */}
                          <div className="absolute -left-[17px] top-4 bg-white p-0.5 rounded-full">
                            <button
                              onClick={() => onUpdateTripItem(item.id, { status: isCompleted ? 'pending' : 'completed' })}
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                                isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200 hover:bg-blue-500'
                              }`}
                            >
                              {isCompleted && <Check size={8} strokeWidth={4} />}
                            </button>
                          </div>

                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-extrabold text-slate-400 bg-slate-50 px-1 py-0.5 rounded leading-none">
                                  ⏱ {item.start_time || '待定'}
                                </span>
                                <span className={`text-[8px] font-black uppercase px-1 rounded ${
                                  item.type === 'food' ? 'bg-amber-50 text-amber-600' :
                                  item.type === 'drive' ? 'bg-blue-50 text-blue-600' :
                                  'bg-indigo-50 text-indigo-600'
                                }`}>
                                  {item.type === 'food' ? '美食' : item.type === 'drive' ? '自驾' : '景点'}
                                </span>
                              </div>
                              <h5 className={`font-bold text-xs mt-1 ${isCompleted ? 'line-through text-slate-400 font-medium' : 'text-slate-800'}`}>
                                {item.title}
                              </h5>
                              {item.note && <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{item.note}</p>}
                            </div>
                            
                            <button
                              onClick={() => {
                                const nextStat = item.status === 'skipped' ? 'pending' : 'skipped';
                                onUpdateTripItem(item.id, { status: nextStat });
                              }}
                              className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded hover:bg-slate-100 shrink-0"
                            >
                              {item.status === 'skipped' ? '还原' : '跳过'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Foldable checklist item verification matching instructions */}
              {activeTripChecklist && (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">本日物品折叠核对</p>
                    <span className="text-[9px] font-bold text-blue-600">📋 {activeTripChecklist.title}</span>
                  </div>

                  <div className="bg-white border border-slate-150 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {Object.entries(checkCats).map(([catName, items]) => {
                      const collapsed = collapsedCats[catName];
                      const compCount = items.filter(i => i.completed).length;
                      return (
                        <div key={catName} className="flex flex-col">
                          {/* Collapsible header */}
                          <button
                            type="button"
                            onClick={() => toggleCat(catName)}
                            className="w-full px-4 py-3 bg-slate-50/60 hover:bg-slate-50 flex items-center justify-between transition-colors text-left"
                          >
                            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                              <span>{catName === '车辆' ? '🚗' : catName === '衣物' ? '👕' : catName === '药品' ? '💊' : catName === '亲子' ? '👶' : catName === '户外' ? '🏕️' : '📦'}</span>
                              <span>{catName}类物资</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-150">
                                {compCount} / {items.length} 装包
                              </span>
                              <svg 
                                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
                                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
                              >
                                <path d="m9 18 6-6-6-6" />
                              </svg>
                            </div>
                          </button>

                          {/* Items body */}
                          {!collapsed && (
                            <div className="p-3 bg-white grid grid-cols-1 gap-1.5 animate-in fade-in duration-150">
                              {items.map(item => (
                                <div 
                                  key={item.id}
                                  onClick={() => onUpdateChecklistItem(item.id, { completed: !item.completed })}
                                  className={`flex items-center justify-between p-2 rounded-lg border transition-all text-xs cursor-pointer select-none ${
                                    item.completed 
                                      ? 'bg-slate-50 border-slate-100 text-slate-400 line-through' 
                                      : 'bg-white border-slate-150 text-slate-700 hover:border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                      item.completed ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white'
                                    }`}>
                                      {item.completed && <Check size={10} strokeWidth={4} />}
                                    </div>
                                    <span className="font-medium">{item.name}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-bold">x {item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              正在加载日程计划...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Top action header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800">按天行程计划</h2>
          <p className="text-[11px] text-slate-500">在地图添加地点后将其编排为每日有序行程，自驾、游玩心中有数</p>
        </div>
        <div className="flex items-center gap-2">
          {isMobile && (
            <button
              onClick={() => setMobileFullEditor(false)}
              className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
            >
              📅 返回今日日程
            </button>
          )}
          <button
            onClick={openCreateTripModal}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-500/20"
          >
            <Plus size={14} />
            <span>创建新行程</span>
          </button>
        </div>
      </div>

      {/* Trips list pill selectors */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
        {trips.map(trip => (
          <button
            key={trip.id}
            onClick={() => {
              setActiveTripId(trip.id);
              setActiveDayIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeTripId === trip.id
                ? 'bg-blue-50 text-blue-600 border-blue-200 ring-1 ring-blue-500/30'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            🗺️ {trip.title}
          </button>
        ))}
      </div>

      {activeTrip ? (
        <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
          {/* LEFT: Travel Details & Daily Navigation */}
          <div className="w-full md:w-64 flex flex-col gap-4 shrink-0 overflow-y-auto pr-1">
            {/* Active trip summary card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <h3 className="font-bold text-slate-800 text-xs truncate">{activeTrip.title}</h3>
              
              <div className="space-y-1.5 text-[10px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-slate-400" />
                  <span>{activeTrip.start_date} ~ {activeTrip.end_date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-400" />
                  <span>起点: {activeTrip.origin} ➔ 终点: {activeTrip.destination_summary}</span>
                </div>
                {activeTrip.vehicle && (
                  <div className="flex items-center gap-1.5">
                    <Car size={12} className="text-slate-400" />
                    <span>车辆: {activeTrip.vehicle}</span>
                  </div>
                )}
              </div>

              {activeTrip.budget && (
                <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-bold">预算费用</span>
                  <span className="text-xs font-black text-rose-600">¥ {activeTrip.budget}</span>
                </div>
              )}

              <button
                onClick={() => onDeleteTrip(activeTrip.id)}
                className="w-full py-1.5 bg-red-50 text-red-600 hover:bg-red-100/70 text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 size={11} />
                <span>删除此行程</span>
              </button>
            </div>

            {/* Daily plans navigation list */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">日程与全程选择</p>
              
              {/* Trip Overview Select Button */}
              <button
                onClick={() => {
                  setActiveDayIndex(-1);
                  setIsEditingDay(false);
                }}
                className={`w-full p-3 rounded-xl text-left border transition-all flex justify-between items-center ${
                  activeDayIndex === -1
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/15 font-bold scale-[1.01]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50/80'
                }`}
              >
                <div className="space-y-0.5 truncate pr-2">
                  <p className={`text-[10px] font-bold ${activeDayIndex === -1 ? 'text-blue-100' : 'text-slate-400'}`}>
                    TRIP DASHBOARD
                  </p>
                  <p className="text-xs truncate font-extrabold">📊 行程大盘总览</p>
                </div>
                <Sparkles size={14} className={activeDayIndex === -1 ? 'text-white' : 'text-blue-500'} />
              </button>

              {currentDays.map((day, idx) => (
                <button
                  key={day.id}
                  onClick={() => {
                    setActiveDayIndex(idx);
                    setIsEditingDay(false);
                  }}
                  className={`w-full p-3 rounded-xl text-left border transition-all flex justify-between items-center ${
                    activeDayIndex === idx
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/15 font-bold scale-[1.01]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="space-y-0.5 truncate pr-2">
                    <p className={`text-[10px] font-bold ${activeDayIndex === idx ? 'text-blue-100' : 'text-slate-400'}`}>
                      Day {day.day_number} | {day.date}
                    </p>
                    <p className="text-xs truncate font-extrabold">{day.title}</p>
                  </div>
                  <ChevronRightIcon size={14} className={activeDayIndex === idx ? 'text-white' : 'text-slate-400'} />
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Selected Day Tasks timeline & control OR Overview Dashboard */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-5 flex flex-col h-full overflow-hidden">
            {activeDayIndex === -1 ? (
              <TripOverviewDashboard 
                trip={activeTrip}
                days={currentDays}
                items={tripItems}
                places={places}
                checklists={checklists}
                checklistItems={checklistItems}
                media={media}
                visits={visits}
              />
            ) : currentDay ? (
              <div className="flex flex-col h-full space-y-4 overflow-hidden">
                {/* Day metadata header / Form for editing */}
                {isEditingDay ? (
                  <form onSubmit={handleSaveDaySummary} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shrink-0 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <h4 className="text-xs font-black text-slate-700">⚙️ 编辑 Day {currentDay.day_number} 日程摘要</h4>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsEditingDay(false)}
                          className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-[10px] font-bold rounded-md"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-md flex items-center gap-1 shadow-sm"
                        >
                          <Save size={10} />
                          <span>保存</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">日程标题</label>
                        <input
                          type="text"
                          value={editDayTitle}
                          onChange={(e) => setEditDayTitle(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">预计里程 (km)</label>
                        <input
                          type="number"
                          value={editDayDistance}
                          onChange={(e) => setEditDayDistance(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          placeholder="例如: 85"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">驾驶耗时 (分钟)</label>
                        <input
                          type="number"
                          value={editDayDriveTime}
                          onChange={(e) => setEditDayDriveTime(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          placeholder="例如: 90"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">预计通用费用 (元)</label>
                        <input
                          type="number"
                          value={editDayCost}
                          onChange={(e) => setEditDayCost(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          placeholder="例如: 150"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">强度级别</label>
                        <select
                          value={editDayIntensity}
                          onChange={(e: any) => setEditDayIntensity(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                        >
                          <option value="easy">🟢 轻松慢游</option>
                          <option value="moderate">🟡 中等强度</option>
                          <option value="hard">🔴 极限野路</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">天气预报</label>
                        <input
                          type="text"
                          value={editDayWeather}
                          onChange={(e) => setEditDayWeather(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          placeholder="例如: ☀️ 晴转多云 28°C"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">出行备忘/避坑预警</label>
                        <input
                          type="text"
                          value={editDayNotes}
                          onChange={(e) => setEditDayNotes(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          placeholder="例如: 溪谷内没有移动信号"
                        />
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="pb-3 border-b border-slate-100 shrink-0">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-md">
                            Day {currentDay.day_number}
                          </span>
                          <h4 className="text-sm font-bold text-slate-800">{currentDay.title}</h4>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">{currentDay.date} 行程明细</span>
                      </div>

                      <button
                        onClick={startEditDay}
                        className="px-2.5 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 hover:border-blue-300 text-[10px] font-black rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Edit size={10} />
                        <span>编辑今日摘要</span>
                      </button>
                    </div>

                    {/* Aesthetic parameters metrics row (distance, drive time, cost, intensity, weather) */}
                    <div className="grid grid-cols-5 gap-2 mt-3 p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <div className="space-y-0.5 border-r border-slate-200/50">
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase">🛣️ 路程里程</p>
                        <p className="text-[11px] font-extrabold text-slate-700">{currentDay.planned_distance ? `${currentDay.planned_distance} km` : '--'}</p>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-200/50">
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase">⏱️ 驾驶耗时</p>
                        <p className="text-[11px] font-extrabold text-slate-700">{currentDay.planned_drive_time ? `${currentDay.planned_drive_time} 分钟` : '--'}</p>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-200/50">
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase">💰 预计开支</p>
                        <p className="text-[11px] font-extrabold text-slate-700">¥ {currentDay.planned_cost || '0'}</p>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-200/50">
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase">📊 强度级别</p>
                        <p className={`text-[11px] font-extrabold ${
                          currentDay.intensity === 'easy' ? 'text-emerald-600' :
                          currentDay.intensity === 'moderate' ? 'text-amber-600' :
                          currentDay.intensity === 'hard' ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {currentDay.intensity === 'easy' ? '轻松' :
                           currentDay.intensity === 'moderate' ? '中等' :
                           currentDay.intensity === 'hard' ? '硬核' : '未设置'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase">☀️ 天气预报</p>
                        <p className="text-[11px] font-extrabold text-slate-700 truncate px-1" title={currentDay.weather_note || '多云'}>
                          {currentDay.weather_note || '多云'}
                        </p>
                      </div>
                    </div>

                    {/* Day Notes summary */}
                    {currentDay.notes && (
                      <p className="text-[10px] text-slate-500 bg-amber-50/40 p-2 rounded-lg border border-amber-100 mt-2 flex items-center gap-1">
                        🔑 <b>当日备忘：</b><span className="text-slate-600 font-medium truncate">{currentDay.notes}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Timeline Tasks list */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
                  {currentItems.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                      <HelpCircle size={24} className="mx-auto text-slate-300" />
                      <p>当天还没有安排行程项</p>
                      <p className="text-[10px] text-slate-300">您可以在地图页选中标记点并“加入今日行程”，或在下方手动添加！</p>
                    </div>
                  ) : (
                    <div className="relative pl-3 border-l-2 border-slate-100 space-y-4">
                      {currentItems.map((item) => {
                        const isCompleted = item.status === 'completed';
                        const isSkipped = item.status === 'skipped';
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`relative group p-3.5 rounded-xl border transition-all ${
                              isCompleted 
                                ? 'bg-emerald-50/20 border-emerald-100 text-slate-500' 
                                : isSkipped 
                                ? 'bg-slate-50 border-slate-100 text-slate-400 line-through'
                                : 'bg-white border-slate-150 text-slate-800 hover:shadow-md hover:border-slate-300 shadow-sm'
                            }`}
                          >
                            {/* Chronological bullet marker */}
                            <div className="absolute -left-[19px] top-4 bg-white p-0.5 rounded-full z-10">
                              <button 
                                onClick={() => {
                                  const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
                                  onUpdateTripItem(item.id, { status: nextStatus });
                                }}
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-white transition-all ${
                                  isCompleted 
                                    ? 'bg-emerald-500' 
                                    : 'bg-slate-200 hover:bg-blue-500'
                                }`}
                              >
                                {isCompleted && <Check size={10} strokeWidth={3} />}
                              </button>
                            </div>

                            {/* Itinerary details */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {item.start_time && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                      <Clock size={10} />
                                      {item.start_time}
                                    </span>
                                  )}
                                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                                    item.type === 'food' ? 'bg-amber-100 text-amber-700' :
                                    item.type === 'drive' ? 'bg-blue-100 text-blue-700' :
                                    item.type === 'accommodation' ? 'bg-rose-100 text-rose-700' :
                                    'bg-indigo-100 text-indigo-700'
                                  }`}>
                                    {item.type === 'food' ? '美食' :
                                     item.type === 'drive' ? '自驾' :
                                     item.type === 'accommodation' ? '住宿' : '游玩'}
                                  </span>
                                </div>
                                <h5 className={`font-bold text-xs ${isCompleted ? 'text-slate-400 font-medium' : ''}`}>
                                  {item.title}
                                </h5>
                                {item.note && (
                                  <p className="text-[10px] text-slate-500 leading-relaxed max-w-lg">
                                    {item.note}
                                  </p>
                                )}
                              </div>

                              {/* Right Actions inside task */}
                              <div className="flex items-center gap-2">
                                {item.cost && (
                                  <span className="text-[10px] font-black text-slate-500 shrink-0">
                                    ¥{item.cost}
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    const nextStatus = item.status === 'skipped' ? 'pending' : 'skipped';
                                    onUpdateTripItem(item.id, { status: nextStatus });
                                  }}
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-slate-100 ${
                                    isSkipped ? 'text-blue-500 bg-blue-50' : 'text-slate-400'
                                  }`}
                                >
                                  {isSkipped ? '还原' : '跳过'}
                                </button>
                                <button
                                  onClick={() => onDeleteTripItem(item.id)}
                                  className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="移除"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Add Quick Daily Item Form inline collapse */}
                <div className="border-t border-slate-100 pt-3 shrink-0">
                  {showAddItem ? (
                    <form onSubmit={handleAddItemSubmit} className="p-3.5 bg-slate-50 rounded-xl border border-slate-150 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">类别</label>
                          <select 
                            value={itemType}
                            onChange={(e: any) => setItemType(e.target.value)}
                            className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg outline-none"
                          >
                            <option value="play">游玩地点</option>
                            <option value="food">餐饮美食</option>
                            <option value="drive">自驾路线</option>
                            <option value="accommodation">酒店住宿</option>
                            <option value="rest">休闲小憩</option>
                          </select>
                        </div>

                        <div className="space-y-0.5 col-span-2">
                          <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">时间（格式如 08:30）</label>
                          <input 
                            type="time" 
                            value={itemTime}
                            onChange={(e) => setItemTime(e.target.value)}
                            className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">活动标题</label>
                        <input 
                          type="text" 
                          placeholder="例如：牌坊街漫步吃小吃"
                          value={itemTitle}
                          onChange={(e) => setItemTitle(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                          required
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">备忘要点（可选）</label>
                        <input 
                          type="text" 
                          placeholder="例如：建议尝试老胡荣泉的鸭母捻"
                          value={itemNote}
                          onChange={(e) => setItemNote(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAddItem(false)}
                          className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-150 text-xs font-semibold rounded-lg"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                        >
                          保存添加
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowAddItem(true)}
                      className="w-full py-2.5 border border-dashed border-slate-200 rounded-xl text-slate-500 hover:text-blue-500 hover:bg-blue-50/50 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                    >
                      <Plus size={14} />
                      <span>手动插入新日程子项</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                正在加载天数计划中...
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Calendar size={26} />}
          title="还没有行程足迹"
          description="先创建一条旅行路线，再从地图把想去的地点加入每天的时间线；日期、预算和装备都可以继续补充。"
          actionLabel="创建首个行程"
          onAction={openCreateTripModal}
        />
      )}

      {/* CREATE TRIP DIALOG POPOVER */}
      {showCreateTripModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm">🎒 规划全新旅行行程</h4>
              <button 
                onClick={() => setShowCreateTripModal(false)}
                aria-label="关闭创建行程"
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <XIcon size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTripSubmit} className="space-y-3">
              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">行程标题 / 名称</label>
                <input
                  type="text" 
                  aria-label="行程标题 / 名称"
                  placeholder="如：国庆潮州3天自驾深度游"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">开始日期</label>
                <input
                  type="date"
                  aria-label="开始日期"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    required
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">结束日期</label>
                <input
                  type="date"
                  aria-label="结束日期"
                  min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    required
                  />
                </div>
              </div>

              {dateError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-bold text-rose-700">{dateError}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">出发城市</label>
                <input
                  type="text"
                  aria-label="出发城市"
                    placeholder="广州市"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">目标区域</label>
                <input
                  type="text"
                  aria-label="目标区域"
                    placeholder="潮州市、归湖镇"
                    value={destSummary}
                    onChange={(e) => setDestSummary(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">出行交通/车辆</label>
                <input
                  type="text"
                  aria-label="出行交通或车辆"
                    placeholder="纯电SUV"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">行程预算金额 (元)</label>
                <input
                  type="number"
                  aria-label="行程预算金额"
                    placeholder="2500"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateTripModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-blue-700"
                >
                  确认生成行程
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
function ChevronRightIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function XIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TripOverviewDashboard({
  trip,
  days,
  items,
  places,
  checklists,
  checklistItems,
  media,
  visits
}: {
  trip: Trip;
  days: TripDay[];
  items: TripItem[];
  places: Place[];
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
  media: Media[];
  visits: Visit[];
}) {
  const [activeOverviewTab, setActiveOverviewTab] = useState<'summary' | 'accommodation' | 'budget' | 'checklist' | 'photos'>('summary');

  // Find all items associated with this trip's days
  const dayIds = days.map(d => d.id);
  const tripItems = items.filter(item => dayIds.includes(item.trip_day_id));

  // 1. Accommodation items
  const hotelItems = tripItems.filter(item => item.type === 'accommodation');

  // 2. Budget calculations
  const plannedItemCosts = tripItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const matchedPlacesIds = tripItems.map(item => item.place_id).filter(Boolean) as string[];
  const realVisitCosts = visits
    .filter(v => matchedPlacesIds.includes(v.place_id))
    .reduce((sum, v) => sum + (v.actual_cost || 0), 0);

  const totalCost = plannedItemCosts + realVisitCosts;
  const budget = trip.budget || 0;
  const isOverBudget = totalCost > budget;
  const budgetPercentage = budget > 0 ? Math.min((totalCost / budget) * 100, 100) : 0;

  // 3. Checklists
  const relatedChecklists = checklists.filter(cl => cl.trip_id === trip.id);
  const relatedChecklistItems = checklistItems.filter(item => 
    relatedChecklists.map(cl => cl.id).includes(item.checklist_id)
  );

  // 4. Photos (media associated with this trip's visited places)
  const relatedPhotos = media.filter(m => m.place_id && matchedPlacesIds.includes(m.place_id));

  // 5. Overall Trip Statistics
  const totalDistance = days.reduce((sum, d) => sum + (d.planned_distance || 0), 0);
  const totalDriveTime = days.reduce((sum, d) => sum + (d.planned_drive_time || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      {/* Header */}
      <div className="pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div>
          <h4 className="text-sm font-bold text-slate-800">📊 行程全程大盘：{trip.title}</h4>
          <p className="text-[10px] text-slate-400 font-semibold">汇总统计全程路况、住宿、预警备忘、物资进度与随行相册</p>
        </div>
        <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-600 text-[10px] font-black rounded-lg shrink-0">
          全程共 {days.length} 天日程
        </span>
      </div>

      {/* Tabs list */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveOverviewTab('summary')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
            activeOverviewTab === 'summary' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          🗺️ 全程总览 & 路况
        </button>
        <button
          onClick={() => setActiveOverviewTab('accommodation')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
            activeOverviewTab === 'accommodation' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          🏨 酒店住宿 ({hotelItems.length})
        </button>
        <button
          onClick={() => setActiveOverviewTab('budget')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
            activeOverviewTab === 'budget' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          💰 预算开销大账本
        </button>
        <button
          onClick={() => setActiveOverviewTab('checklist')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
            activeOverviewTab === 'checklist' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          📦 出行清单 ({relatedChecklistItems.length})
        </button>
        <button
          onClick={() => setActiveOverviewTab('photos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
            activeOverviewTab === 'photos' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          📷 精彩随影 ({relatedPhotos.length})
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto pr-1">
        
        {/* SUMMARY TAB */}
        {activeOverviewTab === 'summary' && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50/30 rounded-xl border border-blue-100 shadow-3xs text-center">
                <span className="text-[9px] text-blue-500 font-extrabold uppercase">🗺️ 总路程里程</span>
                <p className="text-base font-black text-blue-700 mt-1">{totalDistance} <span className="text-[10px] font-normal">km</span></p>
              </div>
              <div className="p-3 bg-gradient-to-br from-amber-50 to-yellow-50/30 rounded-xl border border-amber-100 shadow-3xs text-center">
                <span className="text-[9px] text-amber-500 font-extrabold uppercase">⏱️ 累计驾驶时间</span>
                <p className="text-base font-black text-amber-700 mt-1">{totalDriveTime} <span className="text-[10px] font-normal">分钟</span></p>
              </div>
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50/30 rounded-xl border border-emerald-100 shadow-3xs text-center">
                <span className="text-[9px] text-emerald-500 font-extrabold uppercase">💵 费用预算比</span>
                <p className="text-xs font-black text-emerald-700 mt-1">¥ {totalCost} / {budget || '--'}</p>
              </div>
            </div>

            {/* Daily schedule route maps list */}
            <div className="space-y-2.5">
              <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span>📆</span> 各日程详情及防坑提醒汇总
              </h5>
              <div className="space-y-2">
                {days.map((day) => (
                  <div key={day.id} className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2 shadow-3xs">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded">
                          Day {day.day_number}
                        </span>
                        <span className="font-extrabold text-slate-800">{day.title}</span>
                        <span className="text-[10px] text-slate-400">({day.date})</span>
                      </div>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                        day.intensity === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                        day.intensity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                        day.intensity === 'hard' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        强度: {day.intensity === 'easy' ? '轻松' :
                               day.intensity === 'moderate' ? '中等' :
                               day.intensity === 'hard' ? '硬核' : '未设置'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-1 border-t border-b border-slate-200/40 text-[10px] text-slate-500">
                      <div>🛣️ 路程：<b className="text-slate-700">{day.planned_distance || '--'} km</b></div>
                      <div>⏱️ 驾驶：<b className="text-slate-700">{day.planned_drive_time || '--'} 分钟</b></div>
                      <div>💰 预计费用：<b className="text-slate-700">¥{day.planned_cost || '0'}</b></div>
                      <div>☀️ 天气防坑：<b className="text-slate-700">{day.weather_note || '多云无雨'}</b></div>
                    </div>

                    {day.notes && (
                      <p className="text-[10px] text-slate-500 leading-relaxed bg-white p-2 rounded-lg border border-slate-100">
                        🔑 <b>备忘：</b>{day.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ACCOMMODATION TAB */}
        {activeOverviewTab === 'accommodation' && (
          <div className="space-y-3">
            {hotelItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <span>🛌</span>
                <p>整个行程中暂无登记的住宿/客房。您可以在任意天数添加类型为“住宿”的日程项。</p>
              </div>
            ) : (
              <div className="space-y-2">
                {hotelItems.map(item => {
                  const day = days.find(d => d.id === item.trip_day_id);
                  return (
                    <div key={item.id} className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4 shadow-3xs">
                      <div className="space-y-1.5 truncate">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                          <span>🛌 住宿</span>
                          <span>|</span>
                          <span>Day {day?.day_number || 1} ({item.start_time || '下午'})</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-800 truncate">{item.title}</h5>
                        {item.note && <p className="text-[10px] text-slate-500 truncate">{item.note}</p>}
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        {item.cost && <p className="text-xs font-black text-rose-600">¥ {item.cost}</p>}
                        <span className="text-[9px] px-1.5 py-0.5 bg-rose-50 text-rose-600 font-bold rounded border border-rose-100">
                          已预定
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* BUDGET TAB */}
        {activeOverviewTab === 'budget' && (
          <div className="space-y-5 bg-slate-50/50 rounded-xl border border-slate-100 p-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">自驾旅费预算使用率</span>
                <span className={`font-black ${isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
                  ¥ {totalCost} / ¥ {budget} ({budgetPercentage.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverBudget ? 'bg-rose-500' : 'bg-blue-600'
                  }`} 
                  style={{ width: `${budgetPercentage}%` }}
                />
              </div>
              {isOverBudget ? (
                <div className="p-2.5 bg-rose-50 text-rose-800 text-[10px] font-bold rounded-lg border border-rose-200 flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-rose-500 shrink-0" />
                  <span>注意！总规划和实打卡消费合计超出预算 ¥ {totalCost - budget}，建议优化备用方案。</span>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 font-semibold">
                  🎉 经费控制得当！预算额度还剩 <b>¥ {budget - totalCost}</b> 可自由支配。
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h6 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pt-1 border-t border-slate-200/50">账目明细拆解</h6>
              
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-slate-100">
                  <span className="font-medium text-slate-700">🗓️ 规划行程项预估消费（餐饮、住宿、油费）</span>
                  <span className="font-bold text-slate-800">¥ {plannedItemCosts}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-slate-100">
                  <span className="font-medium text-slate-700">📸 实地打卡记录真实总花费</span>
                  <span className="font-bold text-slate-800">¥ {realVisitCosts}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHECKLIST TAB */}
        {activeOverviewTab === 'checklist' && (
          <div className="space-y-3">
            {relatedChecklistItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <span>📦</span>
                <p>暂无关联到本行程的清单大项。可在“清单整理”模块创建并导入模板。</p>
              </div>
            ) : (
              <div className="space-y-2">
                {['车辆', '衣物', '亲子', '药品', '户外', '其他'].map(cat => {
                  const catItems = relatedChecklistItems.filter(item => 
                    (item.category === cat) || (!item.category && cat === '其他')
                  );
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{cat} 类物资</p>
                      <div className="grid grid-cols-2 gap-2">
                        {catItems.map(item => (
                          <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl text-xs flex items-center justify-between shadow-3xs">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={item.completed ? 'text-emerald-500' : 'text-slate-300'}>
                                {item.completed ? '✓' : '●'}
                              </span>
                              <span className={`truncate font-medium ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {item.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PHOTOS TAB */}
        {activeOverviewTab === 'photos' && (
          <div className="space-y-3">
            {relatedPhotos.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <span>📷</span>
                <p>本路线中关联的打卡点尚未采集现场实景照片。请在“照片足迹”或打卡详情中拍摄或上传照片。</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {relatedPhotos.map(photo => {
                  const place = places.find(p => p.id === photo.place_id);
                  return (
                    <div key={photo.id} className="relative rounded-xl overflow-hidden h-24 bg-slate-100 border border-slate-200 group">
                      <img src={photo.file_path} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <p className="text-[9px] text-white font-bold truncate">{place?.name || '未知采集点'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
