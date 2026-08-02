import React, { useState } from 'react';
import { Checklist, ChecklistItem, Trip } from '../../types';
import { CheckSquare, Square, Filter, ChevronDown, ChevronRight, User, Plus, X, Tag } from 'lucide-react';
import EmptyState from '../EmptyState';

interface MobileChecklistPageProps {
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
  trips: Trip[];
  onAddChecklistFromTemplate: (title: string, tripId: string, templateType: string) => void;
  onAddChecklistItem: (checklistId: string, name: string, quantity: number, owner: string, category?: string, source?: string) => void;
  onUpdateChecklistItem: (itemId: string, data: Partial<ChecklistItem>) => void;
}

export default function MobileChecklistPage({
  checklists,
  checklistItems,
  trips,
  onAddChecklistFromTemplate,
  onAddChecklistItem,
  onUpdateChecklistItem,
}: MobileChecklistPageProps) {
  const [onlyUnfinished, setOnlyUnfinished] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<string>(''); // empty means all
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Form states for adding inline
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('证件与资金');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemOwner, setNewItemOwner] = useState('所有人');
  const [newItemRequired, setNewItemRequired] = useState(true);
  const [templateFeedback, setTemplateFeedback] = useState('');

  // Group checklist items by category
  const categoriesList = ['证件与资金', '车辆与充电', '亲子用品', '户外装备', '医疗药品', '衣物洗漱', '其他装备'];

  // Dynamically find all unique owners
  const owners = Array.from(new Set(checklistItems.map(item => item.owner || '所有人').filter(Boolean)));
  if (!owners.includes('所有人')) {
    owners.unshift('所有人');
  }

  // Filter items
  const filteredItems = checklistItems.filter(item => {
    if (onlyUnfinished && item.completed) return false;
    if (selectedOwner && selectedOwner !== '所有人' && item.owner !== selectedOwner) return false;
    return true;
  });

  const totalCount = checklistItems.length;
  const completedCount = checklistItems.filter(item => item.completed).length;

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const handleToggleItem = (item: ChecklistItem) => {
    onUpdateChecklistItem(item.id, { completed: !item.completed });
  };

  const handleCreateItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || checklists.length === 0) return;
    onAddChecklistItem(
      checklists[0].id,
      newItemName,
      parseInt(newItemQty) || 1,
      newItemOwner,
      newItemCategory,
      'manual'
    );
    setNewItemName('');
    setShowAddForm(false);
  };

  const handleLoadTemplate = (type: string) => {
    if (trips.length === 0) {
      setTemplateFeedback('请先创建一条行程，再导入清单模板。');
      return;
    }
    const templateNames: Record<string, string> = {
      stream: '🌊 溯溪戏水专属物资清单',
      drive: '🚗 自驾车辆充电整备清单',
      family: '👶 亲子出行儿童保障清单',
      general: '🎒 户外通用基础行囊清单',
    };
    onAddChecklistFromTemplate(templateNames[type] || '自驾旅行清单', trips[0].id, type);
    setTemplateFeedback('模板正在导入，稍后即可开始核对。');
  };

  return (
    <div className="space-y-4 select-none pb-12">
      
      {/* 1. Header with active stats */}
      <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-xs space-y-3.5">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">自驾行囊快速核对</h3>
            <p className="text-xs text-slate-400 mt-0.5">到访玩水点与徒步节点前逐项排查</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
              已完成 {completedCount} / {totalCount}
            </span>
          </div>
        </div>

        {/* Dynamic Progress slider */}
        {totalCount > 0 && (
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-300" 
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            ></div>
          </div>
        )}

        {/* Quick Filter buttons */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50">
          <button
            id="m_chk_filter_unfinished"
            onClick={() => setOnlyUnfinished(!onlyUnfinished)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 outline-none ${
              onlyUnfinished ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-150 text-slate-500'
            }`}
          >
            <span>只看未完成</span>
          </button>

          {/* Owner Filter dropdown */}
          <div className="relative">
            <select
              id="m_chk_owner_select"
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold text-slate-600 outline-none"
            >
              <option value="">👤 筛选负责人...</option>
              {owners.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {!showAddForm && checklists.length > 0 && (
            <button
              id="m_chk_show_add_inline"
              onClick={() => setShowAddForm(true)}
              className="ml-auto px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-0.5 outline-none active:scale-95 transition-all"
            >
              <Plus size={13} />
              <span>新建清单项</span>
            </button>
          )}
        </div>
      </div>

      {templateFeedback && (
        <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold leading-relaxed text-blue-700">
          {templateFeedback}
        </p>
      )}

      {/* 2. Quick import templates if list is empty */}
      {totalCount === 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center space-y-4">
          <span className="text-3xl block">🎒</span>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">您的出行清单暂无数据。建议导入我们预置的溯溪、亲子、自驾备车或通用户外精选装备包：</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleLoadTemplate('stream')} className="p-3 bg-cyan-50/50 hover:bg-cyan-50 text-cyan-700 font-bold text-xs rounded-xl border border-cyan-100 outline-none">🌊 溯溪避暑包</button>
            <button onClick={() => handleLoadTemplate('drive')} className="p-3 bg-blue-50/50 hover:bg-blue-50 text-blue-700 font-bold text-xs rounded-xl border border-blue-100 outline-none">🚗 自驾备车包</button>
            <button onClick={() => handleLoadTemplate('family')} className="p-3 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-100 outline-none">👶 户外亲子包</button>
            <button onClick={() => handleLoadTemplate('general')} className="p-3 bg-amber-50/50 hover:bg-amber-50 text-amber-700 font-bold text-xs rounded-xl border border-amber-100 outline-none">🎒 通用徒步包</button>
          </div>
        </div>
      )}

      {/* Add New Checklist Item Form */}
      {showAddForm && (
        <form onSubmit={handleCreateItemSubmit} className="bg-white rounded-2xl p-4.5 border border-blue-100 space-y-3.5 text-xs animate-in slide-in-from-top-3">
          <div className="flex justify-between items-center border-b border-slate-50 pb-1">
            <h5 className="font-extrabold text-slate-800">📋 新增个人专属行囊节点</h5>
            <button type="button" aria-label="关闭新增清单项" onClick={() => setShowAddForm(false)} className="text-slate-400"><X size={15} /></button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400">行囊物资名称</label>
            <input 
              type="text" 
              placeholder="例如：双人便携速干防水布"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400">分类归口</label>
              <select
                value={newItemCategory}
                onChange={e => setNewItemCategory(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400">负责人</label>
              <input 
                type="text" 
                placeholder="例如：爸爸"
                value={newItemOwner}
                onChange={e => setNewItemOwner(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold"
          >
            保存并加入行囊清单
          </button>
        </form>
      )}

      {/* 3. Grouped Collapsible Categories List */}
      {totalCount > 0 && (
        <div className="space-y-3">
          {categoriesList.map(cat => {
            const catItems = filteredItems.filter(item => {
              const itemCat = item.category || '其他装备';
              return itemCat.includes(cat) || (cat === '其他装备' && !categoriesList.some(c => itemCat.includes(c)));
            });

            if (catItems.length === 0) return null;

            const isCollapsed = !!collapsedCategories[cat];
            const catCompleted = catItems.filter(item => item.completed).length;
            const catTotal = catItems.length;
            const allChecked = catCompleted === catTotal;

            return (
              <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                {/* Category Header */}
                <button
                  id={`m_chk_header_${cat}`}
                  onClick={() => toggleCategoryCollapse(cat)}
                  className={`w-full px-4 py-3.5 flex items-center justify-between text-left outline-none transition-colors ${
                    allChecked ? 'bg-emerald-50/20' : 'bg-slate-50/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                    <span className="font-extrabold text-slate-800 text-xs">{cat}</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      allChecked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {catCompleted} / {catTotal}
                    </span>
                  </div>
                </button>

                {/* Items in Category */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-50 select-none">
                    {catItems.map(item => {
                      const sourceLabels: Record<string, string> = {
                        manual: '手动添加',
                        template: '模板导入',
                        trip: '行程生成',
                        guide: '攻略同步',
                      };
                      return (
                        <div
                          key={item.id}
                          id={`m_chk_item_row_${item.id}`}
                          onClick={() => handleToggleItem(item)}
                          className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50/50 cursor-pointer transition-all active:bg-slate-100/50 min-h-[44px]"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Touch-safe tick box */}
                            <span className="shrink-0">
                              {item.completed ? (
                                <CheckSquare size={18} className="text-emerald-500 fill-emerald-50" />
                              ) : (
                                <Square size={18} className="text-slate-300" />
                              )}
                            </span>

                            <div className="min-w-0">
                              <p className={`text-xs font-bold ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {item.name}
                                {item.quantity > 1 && (
                                  <span className="text-blue-600 font-extrabold ml-1.5">x {item.quantity}</span>
                                )}
                              </p>
                              
                              {/* Metadata */}
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                                <span className="flex items-center gap-0.5"><User size={9} /> {item.owner || '所有人'}</span>
                                <span>|</span>
                                <span className="flex items-center gap-0.5 bg-slate-100 px-1 rounded">{sourceLabels[item.source || 'manual'] || '自驾规划'}</span>
                                {item.required && (
                                  <span className="text-red-500 font-bold bg-red-50 px-1 rounded">必带</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalCount > 0 && filteredItems.length === 0 && (
        <EmptyState
          icon={<Filter size={24} />}
          title="没有符合条件的清单项"
          description="当前筛选条件下没有待核对内容，清除筛选后可以继续查看全部行囊。"
          actionLabel="清除筛选"
          onAction={() => {
            setOnlyUnfinished(false);
            setSelectedOwner('');
          }}
        />
      )}
    </div>
  );
}
