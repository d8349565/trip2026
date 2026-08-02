/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Checklist, ChecklistItem, Trip } from '../types';
import { Plus, Trash2, Check, Sparkles, FolderOpen, Tag, Calendar, User, Eye, Layers } from 'lucide-react';
import EmptyState from './EmptyState';

interface ChecklistTrackerProps {
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
  trips: Trip[];
  onAddChecklistFromTemplate: (title: string, tripId: string, templateType: string) => void;
  onAddChecklistItem: (checklistId: string, name: string, quantity: number, owner: string, category: string, source: string) => void;
  onUpdateChecklistItem: (id: string, data: Partial<ChecklistItem>) => void;
  onDeleteChecklistItem: (id: string) => void;
}

export default function ChecklistTracker({
  checklists,
  checklistItems,
  trips,
  onAddChecklistFromTemplate,
  onAddChecklistItem,
  onUpdateChecklistItem,
  onDeleteChecklistItem
}: ChecklistTrackerProps) {
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(checklists[0]?.id || null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [tripId, setTripId] = useState('');
  const [templateType, setTemplateType] = useState('drive');

  // Checklist Item states
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemOwner, setItemOwner] = useState('全家');
  const [itemCategory, setItemCategory] = useState('其他');

  const activeChecklist = checklists.find(cl => cl.id === activeChecklistId) || null;
  const currentItems = activeChecklist ? checklistItems.filter(item => item.checklist_id === activeChecklist.id) : [];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    onAddChecklistFromTemplate(title, tripId, templateType);
    setShowCreateModal(false);
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChecklistId || !itemName) return;
    onAddChecklistItem(activeChecklistId, itemName, itemQuantity, itemOwner, itemCategory, 'manual');
    setItemName('');
    setItemQuantity(1);
    setItemCategory('其他');
  };

  // Stats
  const completedCount = currentItems.filter(item => item.completed).length;
  const totalCount = currentItems.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Group items by category
  const categories: Record<string, ChecklistItem[]> = {};
  currentItems.forEach(item => {
    const cat = item.category || '其他';
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(item);
  });

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'trip':
        return <span className="inline-flex items-center text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded-md">🚗 行程</span>;
      case 'guide':
        return <span className="inline-flex items-center text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded-md">📚 攻略</span>;
      case 'template':
        return <span className="inline-flex items-center text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-150 px-1.5 py-0.5 rounded-md">📋 模板</span>;
      case 'manual':
      default:
        return <span className="inline-flex items-center text-[9px] font-black text-slate-500 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded-md">👤 手动</span>;
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case '车辆': return '🚗';
      case '衣物': return '👕';
      case '药品': return '💊';
      case '亲子': return '👶';
      case '户外': return '🏕️';
      case '美食':
      case '温饱': return '🍲';
      default: return '📦';
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full overflow-hidden">
      {/* Header controls */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-800">出行物品行前清单</h2>
          <p className="text-[11px] text-slate-500">管理自驾、溯溪、露营或带孩子出行的必要物资。分工明确，避免落东西</p>
        </div>
        <button
          onClick={() => {
            if (trips.length > 0) setTripId(trips[0].id);
            setShowCreateModal(true);
          }}
          className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-500/10"
        >
          <Sparkles size={13} />
          <span>导入装备模板</span>
        </button>
      </div>

      {/* Checklist selection pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
        {checklists.map(cl => (
          <button
            key={cl.id}
            onClick={() => setActiveChecklistId(cl.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeChecklistId === cl.id
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            📋 {cl.title}
          </button>
        ))}
      </div>

      {activeChecklist ? (
        <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
          {/* LEFT: Metadata & completion progress circle */}
          <div className="w-full md:w-56 bg-slate-50 rounded-2xl border border-slate-100 p-4 shrink-0 flex flex-col gap-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-xs truncate">{activeChecklist.title}</h3>
              <p className="text-[10px] text-slate-400">
                创建于: {activeChecklist.created_at.substring(0, 10)}
              </p>
            </div>

            {/* Circular or Bar Progress */}
            <div className="bg-white p-4 rounded-xl border border-slate-150 text-center space-y-2.5 shadow-sm">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">整理进度</span>
              <div className="relative inline-flex items-center justify-center">
                <span className="text-xl font-black text-blue-600">{percent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 font-semibold">
                已装包 {completedCount} / {totalCount} 项
              </p>
            </div>

            {activeChecklist.template_type && (
              <div className="text-[10px] text-slate-500 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50">
                💡 <b>模板类型：</b>
                {activeChecklist.template_type === 'stream' ? '🌊 溯溪戏水模板' :
                 activeChecklist.template_type === 'drive' ? '🚗 自驾准备模板' :
                 activeChecklist.template_type === 'family' ? '👶 亲子出行模板' : '📦 通用行前模板'}
              </div>
            )}
          </div>

          {/* RIGHT: Checklist items table grouped by Category */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 scrollbar-thin">
              {currentItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  暂无物品，可在下方手动添加
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(categories).map(([categoryName, items]) => (
                    <div key={categoryName} className="space-y-2.5">
                      {/* Group Header */}
                      <h4 className="text-xs font-extrabold text-slate-700 tracking-tight flex items-center justify-between border-b border-slate-100 pb-1.5 bg-slate-50/40 p-1 rounded-lg">
                        <span className="flex items-center gap-1.5">
                          <span>{getCategoryIcon(categoryName)}</span>
                          <span>{categoryName}</span>
                        </span>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {items.length}项
                        </span>
                      </h4>

                      {/* Items under this group */}
                      <div className="grid grid-cols-1 gap-2">
                        {items.map((item) => (
                          <div 
                            key={item.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border select-none transition-all ${
                              item.completed 
                                ? 'bg-slate-50 border-slate-150 text-slate-400 line-through' 
                                : 'bg-white border-slate-150 text-slate-800 hover:border-slate-200 hover:shadow-xs shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => onUpdateChecklistItem(item.id, { completed: !item.completed })}
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                  item.completed ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white hover:border-blue-500'
                                }`}
                              >
                                {item.completed && <Check size={12} strokeWidth={3} />}
                              </button>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold leading-none">{item.name}</p>
                                  {getSourceBadge(item.source)}
                                </div>
                                {item.owner && (
                                  <span className="inline-block text-[9px] font-semibold text-slate-400">
                                    👤 负责人: {item.owner}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs font-extrabold text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded-md shrink-0">
                                x {item.quantity}
                              </span>
                              <button
                                onClick={() => onDeleteChecklistItem(item.id)}
                                className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Add Checklist Item form */}
            <form onSubmit={handleAddItemSubmit} className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2 shrink-0 bg-slate-50/50 p-2 rounded-xl">
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text" 
                  placeholder="手动增加装备，如：驱蚊贴纸、无比滴"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="flex-1 text-xs p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  required
                />
                <div className="flex gap-2">
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="text-xs p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-medium text-slate-600"
                  >
                    <option value="其他">📦 其他分类</option>
                    <option value="车辆">🚗 车辆相关</option>
                    <option value="衣物">👕 个人衣物</option>
                    <option value="药品">💊 急救药品</option>
                    <option value="亲子">👶 亲子母婴</option>
                    <option value="户外">🏕️ 户外装备</option>
                  </select>

                  <input 
                    type="number" 
                    min={1}
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    className="w-14 text-xs p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-center font-bold"
                  />
                  <input 
                    type="text" 
                    placeholder="负责人"
                    value={itemOwner}
                    onChange={(e) => setItemOwner(e.target.value)}
                    className="w-16 text-xs p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-medium text-center"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shrink-0 flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={12} strokeWidth={3} />
                    <span>添加</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<FolderOpen size={26} />}
          title="还没有装备清单"
          description="按出行类型导入一份模板，再根据家庭成员和行程地点补充物品，装箱时逐项勾选。"
          actionLabel="选择装备模板"
          onAction={() => setShowCreateModal(true)}
        />
      )}

      {/* CREATE LIST DIALOG POPOVER */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm">📋 导入全新物品装备模板</h4>
              <button 
                aria-label="关闭装备模板窗口"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Plus size={16} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">清单名称</label>
                <input 
                  type="text" 
                  placeholder="如：潮州自驾防蚊玩水清单"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  required
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">关联行程计划 (可选)</label>
                <select
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
                >
                  <option value="">不关联 / 备用行前包...</option>
                  {trips.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">选取专业装备模版</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700"
                >
                  <option value="stream">🌊 溯溪戏水装备模板（水鞋、救生衣、防水袋）</option>
                  <option value="drive">🚗 自驾安全保障模板（行驶证、手机支架、快充）</option>
                  <option value="family">👶 亲子出行护理模板（折叠推车、无比滴、防晒衣）</option>
                  <option value="general">📦 通用背包打包清单</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-blue-700 active:scale-95 transition-all"
                >
                  导入并生成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
