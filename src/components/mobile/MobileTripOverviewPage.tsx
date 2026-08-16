import React, { useEffect, useState } from 'react';
import { Trip, TripDay, TripItem, Place } from '../../types';
import { 
  Calendar, MapPin, Plus, Trash2, Edit2, Check, Clock, 
  Car, Compass, DollarSign, Cloud, CheckSquare, Sparkles, X,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { getDefaultTripDateRange, isValidTripDateRange } from '../../utils/tripDates';
import TripDayMap from './TripDayMap';

interface MobileTripOverviewPageProps {
  trips: Trip[];
  allDays: TripDay[];
  allItems: TripItem[];
  places: Place[];
  activeTrip: Trip | null;
  createTripRequest?: number;
  onSelectTrip: (tripId: string) => void;
  onDeleteTrip: (tripId: string) => void;
  onCreateTrip: (trip: Partial<Trip>) => void;
  onUpdateTripDay: (dayId: string, data: Partial<TripDay>) => void;
  onAddTripItem: (dayId: string, item: Partial<TripItem>) => void;
  onDeleteTripItem: (itemId: string) => void;
  onReorderTripItems?: (items: { id: string; sort_order: number }[]) => void;
}

export default function MobileTripOverviewPage({
  trips,
  allDays,
  allItems,
  places,
  activeTrip,
  createTripRequest = 0,
  onSelectTrip,
  onDeleteTrip,
  onCreateTrip,
  onUpdateTripDay,
  onAddTripItem,
  onDeleteTripItem,
  onReorderTripItems,
}: MobileTripOverviewPageProps) {
  const [subTab, setSubTab] = useState<'days' | 'trips'>('days');

  // Days list for active trip
  const activeDays = activeTrip ? allDays.filter(d => d.trip_id === activeTrip.id).sort((a,b) => a.day_number - b.day_number) : [];
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const activeDay = activeDays[selectedDayIndex] || null;

  // Items for selected day
  const dayItems = activeDay ? allItems.filter(item => item.trip_day_id === activeDay.id).sort((a,b) => a.sort_order - b.sort_order) : [];

  // Edit Day state
  const [isEditingDay, setIsEditingDay] = useState(false);
  const [dayWeather, setDayWeather] = useState('');
  const [dayDistance, setDayDistance] = useState('');
  const [dayDriveTime, setDayDriveTime] = useState('');
  const [dayCost, setDayCost] = useState('');
  const [dayNotes, setDayNotes] = useState('');

  // Add Item state
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [itemType, setItemType] = useState<'play'|'food'|'drive'|'accommodation'|'rest'|'charging'>('play');
  const [itemTitle, setItemTitle] = useState('');
  const [itemTime, setItemTime] = useState('09:00');
  const [itemNote, setItemNote] = useState('');

  // Add Trip state
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOrigin, setNewOrigin] = useState('广州市');
  const [newDest, setNewDest] = useState('潮州市');
  const [newStartDate, setNewStartDate] = useState(() => getDefaultTripDateRange().startDate);
  const [newEndDate, setNewEndDate] = useState(() => getDefaultTripDateRange().endDate);
  const [newVehicle, setNewVehicle] = useState('自驾 SUV');
  const [newBudget, setNewBudget] = useState('2000');
  const [dateError, setDateError] = useState('');

  const startEditingDay = () => {
    if (!activeDay) return;
    setDayWeather(activeDay.weather_note || '');
    setDayDistance(activeDay.planned_distance?.toString() || '');
    setDayDriveTime(activeDay.planned_drive_time?.toString() || '');
    setDayCost(activeDay.planned_cost?.toString() || '');
    setDayNotes(activeDay.notes || '');
    setIsEditingDay(true);
  };

  const handleSaveDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDay) return;
    onUpdateTripDay(activeDay.id, {
      weather_note: dayWeather,
      planned_distance: dayDistance ? parseFloat(dayDistance) : 0,
      planned_drive_time: dayDriveTime ? parseInt(dayDriveTime) : 0,
      planned_cost: dayCost ? parseFloat(dayCost) : 0,
      notes: dayNotes
    });
    setIsEditingDay(false);
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDay || !itemTitle.trim()) return;
    onAddTripItem(activeDay.id, {
      title: itemTitle,
      type: itemType,
      start_time: itemTime,
      note: itemNote,
      priority: 'must',
      status: 'pending'
    });
    setItemTitle('');
    setItemNote('');
    setShowAddItemForm(false);
  };

  const handleCreateTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (!isValidTripDateRange(newStartDate, newEndDate)) {
      setDateError('结束日期不能早于开始日期，请重新选择。');
      return;
    }
    setDateError('');
    onCreateTrip({
      title: newTitle,
      origin: newOrigin,
      destination_summary: newDest,
      start_date: newStartDate,
      end_date: newEndDate,
      vehicle: newVehicle,
      budget: parseFloat(newBudget),
      status: 'upcoming',
      visibility: 'shared'
    });
    setNewTitle('');
    setShowCreateTripModal(false);
  };

  const openCreateTripModal = () => {
    const defaults = getDefaultTripDateRange();
    setNewTitle('');
    setNewStartDate(defaults.startDate);
    setNewEndDate(defaults.endDate);
    setDateError('');
    setShowCreateTripModal(true);
  };

  useEffect(() => {
    if (createTripRequest <= 0) return;
    setSubTab('trips');
    openCreateTripModal();
  }, [createTripRequest]);

  return (
    <div className="space-y-4 select-none">
      
      {/* Tab Switchers: 日程编排 vs 行程管理 */}
      <div className="bg-slate-100 p-1 rounded-xl flex">
        <button
          id="m_trip_subtab_days"
          onClick={() => setSubTab('days')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${subTab === 'days' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
        >
          日程编排 🗓️
        </button>
        <button
          id="m_trip_subtab_trips"
          onClick={() => setSubTab('trips')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${subTab === 'trips' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
        >
          行程管理 🚗
        </button>
      </div>

      {subTab === 'days' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          {activeTrip ? (
            <>
              {/* Day selection horizontal list */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {activeDays.map((day, idx) => (
                  <button
                    key={day.id}
                    id={`m_day_btn_${idx}`}
                    onClick={() => {
                      setSelectedDayIndex(idx);
                      setIsEditingDay(false);
                      setShowAddItemForm(false);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border whitespace-nowrap transition-all shrink-0 outline-none ${
                      selectedDayIndex === idx 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10' 
                        : 'bg-white border-slate-100 text-slate-600'
                    }`}
                  >
                    Day {day.day_number} ({day.date.substring(5)})
                  </button>
                ))}
              </div>

              {activeDay && (
                <div className="space-y-4">
                  {/* Day summary block */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3.5">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-xs"> Day {activeDay.day_number} 行程概要</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">{activeDay.title || '未命名的一天'}</p>
                      </div>
                      <button
                        id="m_edit_day_param"
                        onClick={startEditingDay}
                        className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 outline-none active:scale-95 transition-all"
                      >
                        <Edit2 size={10} />
                        <span>参数编辑</span>
                      </button>
                    </div>

                    {isEditingDay ? (
                      <form onSubmit={handleSaveDay} className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400">里程 (km)</label>
                            <input 
                              type="number" 
                              value={dayDistance}
                              onChange={e => setDayDistance(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400">车程 (分钟)</label>
                            <input 
                              type="number" 
                              value={dayDriveTime}
                              onChange={e => setDayDriveTime(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400">费用预估 (元)</label>
                            <input 
                              type="number" 
                              value={dayCost}
                              onChange={e => setDayCost(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400">天气备注</label>
                            <input 
                              type="text" 
                              value={dayWeather}
                              onChange={e => setDayWeather(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400">备忘和注意事项</label>
                          <textarea 
                            value={dayNotes}
                            onChange={e => setDayNotes(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl h-14 outline-none resize-none"
                          />
                        </div>

                        <div className="flex gap-2 pt-1.5">
                          <button
                            type="button"
                            onClick={() => setIsEditingDay(false)}
                            className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold"
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold"
                          >
                            保存参数
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-medium text-slate-600">
                        <div className="flex items-center gap-1"><Car size={12} className="text-slate-400" /> 里程：{activeDay.planned_distance || 0} km</div>
                        <div className="flex items-center gap-1"><Clock size={12} className="text-slate-400" /> 车程：{activeDay.planned_drive_time || 0} 分钟</div>
                        <div className="flex items-center gap-1"><DollarSign size={12} className="text-slate-400" /> 费用：{activeDay.planned_cost || 0} 元</div>
                        <div className="flex items-center gap-1"><Cloud size={12} className="text-slate-400" /> 天气：{activeDay.weather_note || '晴 ☀️'}</div>
                        {activeDay.notes && (
                          <div className="col-span-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed mt-1">
                            📌 备忘：{activeDay.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 当日路线地图预览 */}
                  <TripDayMap items={dayItems} places={places} className="h-48" />

                  {/* Nodes listing & add item trigger */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">时间节点计划 ({dayItems.length})</span>
                      {!showAddItemForm && (
                        <button
                          id="m_show_add_item_form"
                          onClick={() => setShowAddItemForm(true)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black flex items-center gap-0.5 outline-none"
                        >
                          <Plus size={12} />
                          <span>添加安排节点</span>
                        </button>
                      )}
                    </div>

                    {/* Add Timeline Item Form */}
                    {showAddItemForm && (
                      <form onSubmit={handleAddItemSubmit} className="bg-white rounded-2xl p-4 border border-blue-100 space-y-3 text-xs animate-in slide-in-from-top-3">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-1">
                          <h5 className="font-extrabold text-slate-800">📌 添加今日活动项</h5>
                          <button type="button" onClick={() => setShowAddItemForm(false)} className="text-slate-400">取消</button>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400">活动名称/标记点</label>
                          <input 
                            type="text" 
                            placeholder="例如：龙潭溪峡谷避暑玩水"
                            value={itemTitle}
                            onChange={e => setItemTitle(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400">抵达时间</label>
                            <input 
                              type="time" 
                              value={itemTime}
                              onChange={e => setItemTime(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400">节点类型</label>
                            <select
                              value={itemType}
                              onChange={e => setItemType(e.target.value as any)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            >
                              <option value="play">🎡 游玩点</option>
                              <option value="food">🍲 美食</option>
                              <option value="drive">🚗 驾驶路段</option>
                              <option value="accommodation">🛌 住宿</option>
                              <option value="rest">☕ 休息补给</option>
                              <option value="charging">⚡ 充电/加油</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400">备注要点</label>
                          <input 
                            type="text" 
                            placeholder="带上防蚊喷雾和溯溪备用凉鞋"
                            value={itemNote}
                            onChange={e => setItemNote(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold"
                        >
                          确认添加该安排
                        </button>
                      </form>
                    )}

                    {dayItems.length === 0 ? (
                      <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 shadow-xs">
                        <Clock className="text-slate-300 mx-auto" size={28} />
                        <p className="text-xs text-slate-400 mt-2">今日暂未编排具体细节，点击右上角快速添加！</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayItems.map((item, idx) => (
                          <div key={item.id} className="bg-white rounded-xl p-3 border border-slate-100 shadow-xs flex justify-between items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs text-blue-600 font-extrabold">{item.start_time || '09:00'}</span>
                                <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1 py-0.5 rounded-md">
                                  {item.type === 'food' ? '🍲 美食' : item.type === 'drive' ? '🚗 自驾' : item.type === 'accommodation' ? '🛌 住宿' : '🎡 游玩'}
                                </span>
                              </div>
                              <h5 className="font-bold text-slate-800 text-xs mt-1 truncate">{item.title}</h5>
                            </div>
                            
                            <div className="flex items-center gap-0.5 shrink-0">
                              {onReorderTripItems && (
                                <>
                                  <button
                                    type="button"
                                    aria-label="上移"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      if (idx === 0) return;
                                      const reordered = [...dayItems];
                                      [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
                                      onReorderTripItems(reordered.map((it, i) => ({ id: it.id, sort_order: i + 1 })));
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="下移"
                                    disabled={idx === dayItems.length - 1}
                                    onClick={() => {
                                      if (idx === dayItems.length - 1) return;
                                      const reordered = [...dayItems];
                                      [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
                                      onReorderTripItems(reordered.map((it, i) => ({ id: it.id, sort_order: i + 1 })));
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                </>
                              )}
                              <button
                                id={`m_delete_item_${item.id}`}
                                onClick={() => {
                                  if (confirm('确定要删除该行程节点吗？')) {
                                    onDeleteTripItem(item.id);
                                  }
                                }}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Calendar className="text-slate-300 mx-auto" size={40} />
              <p className="text-xs text-slate-400 mt-2">没有激活行程，点底部“+”创建一条。</p>
            </div>
          )}
        </div>
      )}

      {subTab === 'trips' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">全部旅行路线规划清单 ({trips.length})</span>
            <button
              id="m_show_add_trip"
              onClick={openCreateTripModal}
              className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-black flex items-center gap-0.5 shadow-sm outline-none"
            >
              <Plus size={12} />
              <span>新建路线</span>
            </button>
          </div>

          {/* Create Trip Dialog Box */}
          {showCreateTripModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end animate-fade-in">
              <div className="absolute inset-0" onClick={() => setShowCreateTripModal(false)}></div>
              <div className="relative z-10 max-h-[80vh] w-full space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-slide-up">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="font-extrabold text-slate-800 text-sm">🎒 新建长途自驾探险行程</h4>
                  <button aria-label="关闭创建行程" onClick={() => setShowCreateTripModal(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 outline-none">
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleCreateTripSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">行程规划标题</label>
                    <input 
                      type="text" 
                      placeholder="例如: 潮州归湖溪流玩水三日行"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">出发城市</label>
                      <input 
                        type="text" 
                        value={newOrigin}
                        onChange={e => setNewOrigin(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">目的地概括</label>
                      <input 
                        type="text" 
                        value={newDest}
                        onChange={e => setNewDest(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">开始日期</label>
                      <input 
                        type="date" 
                        aria-label="开始日期"
                        value={newStartDate}
                        onChange={e => setNewStartDate(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">结束日期</label>
                      <input 
                        type="date" 
                        aria-label="结束日期"
                        min={newStartDate}
                        value={newEndDate}
                        onChange={e => setNewEndDate(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        required
                      />
                    </div>
                  </div>

                  {dateError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">{dateError}</p>}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">自驾代步工具</label>
                      <input 
                        type="text" 
                        value={newVehicle}
                        onChange={e => setNewVehicle(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">预算开支 (元)</label>
                      <input 
                        type="number" 
                        value={newBudget}
                        onChange={e => setNewBudget(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs"
                  >
                    确认创建此自驾行程
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Trips list */}
          <div className="space-y-3">
            {trips.map(trip => {
              const isActive = activeTrip?.id === trip.id;
              return (
                <div
                  key={trip.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isActive 
                      ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-500/10' 
                      : 'bg-white border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs leading-snug">{trip.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-1">{trip.start_date} 至 {trip.end_date}</p>
                    </div>

                    <div className="flex gap-1">
                      {!isActive && (
                        <button
                          id={`m_activate_trip_${trip.id}`}
                          onClick={() => onSelectTrip(trip.id)}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold outline-none"
                        >
                          激活
                        </button>
                      )}
                      <button
                        id={`m_delete_trip_${trip.id}`}
                        onClick={() => {
                          if (confirm('确认永久删除这条路线及全部日程节点吗？')) {
                            onDeleteTrip(trip.id);
                          }
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 outline-none hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-500 font-medium mt-3 border-t border-slate-50 pt-2.5">
                    <div className="flex items-center gap-1">📍 路线：{trip.origin} → {trip.destination_summary}</div>
                    <div className="flex items-center gap-1">🚗 自驾：{trip.vehicle || '新能源车'}</div>
                    <div className="flex items-center gap-1">💰 预算：{trip.budget || 0}元</div>
                    {isActive && (
                      <div className="text-emerald-600 font-extrabold flex items-center gap-1">● 当前正在执行</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
