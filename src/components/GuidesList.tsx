/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Guide, Place, Trip, TripDay, TripItem } from '../types';
import { 
  BookOpen, Search, Clock, ArrowLeft, Heart, Eye, MapPin, Plus, X,
  Edit3, AlertTriangle, ShieldAlert, ChevronRight, Check, Trash2, Bookmark
} from 'lucide-react';
import EmptyState from './EmptyState';

interface GuidesListProps {
  guides: Guide[];
  places: Place[];
  trips?: Trip[];
  tripDays?: TripDay[];
  tripItems?: TripItem[];
  onCreateGuide: (guide: Partial<Guide>) => void;
  onDeleteGuide: (id: string) => void;
  onUpdateGuide?: (id: string, guide: Partial<Guide>) => void;
  selectedGuideId?: string | null;
  onSelectGuideId?: (id: string | null) => void;
  onNavigateToView?: (view: 'map' | 'trip' | 'photos' | 'checklist' | 'guide' | 'settings', id?: string) => void;
}

export default function GuidesList({
  guides,
  places,
  trips = [],
  tripDays = [],
  tripItems = [],
  onCreateGuide,
  onDeleteGuide,
  onUpdateGuide,
  selectedGuideId,
  onSelectGuideId,
  onNavigateToView
}: GuidesListProps) {
  const [localSelectedGuideId, setLocalSelectedGuideId] = useState<string | null>(null);
  const activeSelectedGuideId = selectedGuideId !== undefined ? selectedGuideId : localSelectedGuideId;
  const setActiveSelectedGuideId = onSelectGuideId || setLocalSelectedGuideId;

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states (Create)
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'place'|'city'|'theme'|'general'>('general');
  const [targetId, setTargetId] = useState('');
  const [source, setSource] = useState('原创经验');

  // Form states (Edit)
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTargetType, setEditTargetType] = useState<'place'|'city'|'theme'|'general'>('general');
  const [editTargetId, setEditTargetId] = useState('');
  const [editSource, setEditSource] = useState('');

  const filteredGuides = guides.filter(g => {
    const q = searchQuery.toLowerCase();
    return g.title.toLowerCase().includes(q) || g.summary.toLowerCase().includes(q) || (g.content && g.content.toLowerCase().includes(q));
  });

  const selectedGuide = guides.find(g => g.id === activeSelectedGuideId) || null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    onCreateGuide({
      title,
      summary,
      content,
      target_type: targetType,
      target_id: targetId,
      source,
      verified_at: new Date().toISOString().split('T')[0],
      visibility: 'shared'
    });
    setTitle('');
    setSummary('');
    setContent('');
    setTargetId('');
    setTargetType('general');
    setSource('原创经验');
    setShowCreateModal(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuide || !editTitle || !editContent) return;
    onUpdateGuide?.(selectedGuide.id, {
      title: editTitle,
      summary: editSummary,
      content: editContent,
      target_type: editTargetType,
      target_id: editTargetId,
      source: editSource,
      verified_at: new Date().toISOString().split('T')[0]
    });
    setShowEditModal(false);
  };

  const openEditModal = () => {
    if (!selectedGuide) return;
    setEditTitle(selectedGuide.title);
    setEditSummary(selectedGuide.summary || '');
    setEditContent(selectedGuide.content || '');
    setEditTargetType(selectedGuide.target_type || 'general');
    setEditTargetId(selectedGuide.target_id || '');
    setEditSource(selectedGuide.source || '原创记录');
    setShowEditModal(true);
  };

  // Walk through relations to retrieve metadata for any Guide Card
  const getGuideRelations = (guide: Guide) => {
    let targetPlaceName = '';
    let targetPlaceId = '';
    let usedTripTitle = '';
    let usedTripId = '';

    if (guide.target_type === 'place' && guide.target_id) {
      const place = places.find(p => p.id === guide.target_id || p.name === guide.target_id);
      if (place) {
        targetPlaceName = place.name;
        targetPlaceId = place.id;

        // Trace if this place is scheduled in any trip days -> trips
        const matchedItem = tripItems.find(item => item.place_id === place.id);
        if (matchedItem) {
          const day = tripDays.find(d => d.id === matchedItem.trip_day_id);
          if (day) {
            const trip = trips.find(t => t.id === day.trip_id);
            if (trip) {
              usedTripTitle = trip.title;
              usedTripId = trip.id;
            }
          }
        }
      }
    } else if (guide.target_type === 'city' && guide.target_id) {
      targetPlaceName = `${guide.target_id}全市`;
    }

    return { targetPlaceName, targetPlaceId, usedTripTitle, usedTripId };
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {selectedGuide ? (
        /* DETAIL READING VIEW WITH ADVANCED MARKDOWN RENDERING */
        (() => {
          const relations = getGuideRelations(selectedGuide);
          return (
            <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-6 flex flex-col h-full overflow-hidden animate-in slide-in-from-right-4 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                <button
                  onClick={() => setActiveSelectedGuideId(null)}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 p-1.5 rounded-lg hover:bg-slate-50 transition-all"
                >
                  <ArrowLeft size={14} />
                  <span>返回列表</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* EDIT ENTRY BUTTON */}
                  <button
                    onClick={openEditModal}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    <span>编辑本篇</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('确认删除这篇攻略吗？')) {
                        onDeleteGuide(selectedGuide.id);
                        setActiveSelectedGuideId(null);
                      }
                    }}
                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    <span>删除本篇</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 py-4 pr-1 scrollbar-thin">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-extrabold rounded-full">
                      {selectedGuide.target_type === 'place' ? '📍 地点攻略' : 
                       selectedGuide.target_type === 'city' ? '🏙️ 城市指南' : '📝 通用攻略'}
                    </span>
                    {selectedGuide.verified_at && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-extrabold rounded-full flex items-center gap-1">
                        <Clock size={10} />
                        最后核验: {selectedGuide.verified_at}
                      </span>
                    )}
                    {relations.usedTripTitle && (
                      <span 
                        onClick={() => onNavigateToView?.('trip', relations.usedTripId)}
                        className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-extrabold rounded-full flex items-center gap-1 cursor-pointer hover:bg-indigo-100 transition-all"
                        title="点击查看对应的行程编排"
                      >
                        📅 已编排至：{relations.usedTripTitle}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-extrabold text-slate-800 leading-tight">{selectedGuide.title}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-medium">
                    <span>来源或口述: {selectedGuide.source || '本人口碑收集'}</span>
                    {relations.targetPlaceName && (
                      <>
                        <span>•</span>
                        <button
                          onClick={() => relations.targetPlaceId && onNavigateToView?.('map', relations.targetPlaceId)}
                          className="text-blue-500 font-bold hover:underline flex items-center gap-0.5"
                        >
                          <MapPin size={11} />
                          关联地点: {relations.targetPlaceName}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {selectedGuide.summary && (
                  <p className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-100 leading-relaxed italic">
                    💡 摘要避坑点：{selectedGuide.summary}
                  </p>
                )}

                {/* Markdown styled manual body */}
                <div className="prose prose-slate max-w-none text-xs text-slate-700 leading-relaxed space-y-4">
                  <MarkdownContent 
                    text={selectedGuide.content} 
                    places={places} 
                    onNavigateToView={onNavigateToView} 
                  />
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        /* GUIDES LIST VIEW */
        <div className="flex-1 flex flex-col h-full space-y-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-800">旅行攻略 & 避坑经验</h2>
              <p className="text-[11px] text-slate-500">记录自驾避堵、露营配套、玩水安全、小吃美食老字号，长期保留实用信息</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-500/10"
            >
              <Plus size={14} />
              <span>撰写新攻略</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative shrink-0">
            <Search size={14} className="absolute left-3 top-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索攻略标题、避坑要点、目的地..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
          </div>

          {/* Guides grid list with metadata tags */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1 scrollbar-thin">
            {filteredGuides.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={26} />}
                title={searchQuery ? '没有匹配的攻略' : '还没有攻略沉淀'}
                description={searchQuery ? '换一个关键词，或清空搜索后查看全部经验。' : '把停车、避堵、玩水安全和亲子注意事项记录下来，下一次出发就不用重新踩坑。'}
                actionLabel={searchQuery ? '清空搜索' : '撰写第一篇攻略'}
                onAction={() => searchQuery ? setSearchQuery('') : setShowCreateModal(true)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGuides.map((guide) => {
                  const relations = getGuideRelations(guide);
                  return (
                    <div 
                      key={guide.id}
                      onClick={() => setActiveSelectedGuideId(guide.id)}
                      className="group bg-white p-5 rounded-2xl border border-slate-150 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 h-52"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded-md">
                            {guide.target_type === 'place' ? '📍 地点攻略' : 
                             guide.target_type === 'city' ? '🏙️ 城市指南' : '📝 通用攻略'}
                          </span>
                          {guide.verified_at && (
                            <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-0.5">
                              核验: {guide.verified_at}
                            </span>
                          )}
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-800 leading-snug group-hover:text-blue-600 transition-colors line-clamp-1">
                          {guide.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {guide.summary || '无简短摘要描述...'}
                        </p>

                        {/* Relational Indicators (P1-7) */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {relations.targetPlaceName && (
                            <span className="text-[10px] text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 border border-blue-100/50">
                              <MapPin size={10} />
                              关联: {relations.targetPlaceName}
                            </span>
                          )}
                          {relations.usedTripTitle && (
                            <span className="text-[10px] text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-full font-bold border border-indigo-100/50">
                              已用于: {relations.usedTripTitle}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>👤 来源: {guide.source || '私有原创'}</span>
                        <span className="text-blue-500 font-bold group-hover:underline flex items-center gap-0.5">
                          阅读全文
                          <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE GUIDE DIALOG POPOVER */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm">✍️ 撰写并沉淀旅行攻略与防坑指南</h4>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">攻略主题标题</label>
                <input 
                  type="text" 
                  placeholder="如：潮州自驾防堵车攻略与夜景机位"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">关联对象类别</label>
                  <select
                    value={targetType}
                    onChange={(e: any) => setTargetType(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="general">通用攻略</option>
                    <option value="city">特定城市</option>
                    <option value="place">具体景点/地点</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">选择具体关联地点</label>
                  {targetType === 'place' ? (
                    <select
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      required
                    >
                      <option value="">-- 请选择地点 --</option>
                      {places.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      placeholder="如：潮州市"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">攻略来源/口述</label>
                <input 
                  type="text" 
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="如：本地村民推荐、吃客口述"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">一句话摘要说明</label>
                <input 
                  type="text" 
                  placeholder="一两句话概括避坑重点或游玩精髓"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">攻略及避坑核心内容 (支持 Markdown 排版)</label>
                <textarea 
                  placeholder="### 🚗 避堵避坑要点&#10;> [!WARNING]&#10;> 韩城老街部分路段有电瓶车穿梭，一定要牵好小朋友手！&#10;&#10;1. 建议早上游玩，避开正午太阳极辣。&#10;2. 中午去 **潮镇老尾牛肉店（环城东路店）** 品尝最正宗的沙茶牛肉粿条！"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl h-44 outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-blue-700"
                >
                  确定沉淀保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT GUIDE DIALOG POPOVER */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm">📝 修改攻略及避坑指南</h4>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">攻略主题标题</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">关联对象类别</label>
                  <select
                    value={editTargetType}
                    onChange={(e: any) => setEditTargetType(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="general">通用攻略</option>
                    <option value="city">特定城市</option>
                    <option value="place">具体景点/地点</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">选择具体关联地点</label>
                  {editTargetType === 'place' ? (
                    <select
                      value={editTargetId}
                      onChange={(e) => setEditTargetId(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      required
                    >
                      <option value="">-- 请选择地点 --</option>
                      {places.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      value={editTargetId}
                      onChange={(e) => setEditTargetId(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">攻略来源/口述</label>
                <input 
                  type="text" 
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">一句话摘要说明</label>
                <input 
                  type="text" 
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">攻略及避坑核心内容 (支持 Markdown 排版)</label>
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl h-44 outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-blue-700"
                >
                  保存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* HIGH FIDELITY DYNAMIC MARKDOWN RENDERER COMPONENT */
function MarkdownContent({ 
  text, 
  places, 
  onNavigateToView 
}: { 
  text: string; 
  places: Place[]; 
  onNavigateToView?: (view: 'map' | 'trip' | 'photos' | 'checklist' | 'guide' | 'settings', id?: string) => void; 
}) {
  if (!text) return null;

  const lines = text.split('\n');
  const renderedBlocks: React.ReactNode[] = [];
  
  let inList = false;
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      renderedBlocks.push(
        <ul key={key} className="list-disc pl-5 space-y-1.5 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="text-xs text-slate-700 leading-relaxed">
              {renderInlineFormatting(item, places, onNavigateToView)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const renderInlineFormatting = (
    str: string, 
    placeList: Place[], 
    navigate?: typeof onNavigateToView
  ): React.ReactNode => {
    const parts: { type: 'text' | 'bold' | 'place-link'; text: string; placeId?: string }[] = [];
    
    let currentText = '';
    let i = 0;
    while (i < str.length) {
      if (str.substring(i, i + 2) === '**') {
        if (currentText) {
          parts.push({ type: 'text', text: currentText });
          currentText = '';
        }
        const closingIdx = str.indexOf('**', i + 2);
        if (closingIdx !== -1) {
          parts.push({ type: 'bold', text: str.substring(i + 2, closingIdx) });
          i = closingIdx + 2;
        } else {
          currentText += '**';
          i += 2;
        }
      } else {
        currentText += str[i];
        i++;
      }
    }
    if (currentText) {
      parts.push({ type: 'text', text: currentText });
    }

    const finalParts: React.ReactNode[] = [];
    parts.forEach((part, partIdx) => {
      if (part.type === 'bold') {
        finalParts.push(<strong key={`b-${partIdx}`} className="font-extrabold text-slate-900">{part.text}</strong>);
      } else {
        let txt = part.text;
        let matches: { start: number; end: number; place: Place }[] = [];
        
        placeList.forEach(p => {
          let idx = txt.indexOf(p.name);
          while (idx !== -1) {
            const isOverlapping = matches.some(m => (idx >= m.start && idx < m.end) || (idx + p.name.length > m.start && idx + p.name.length <= m.end));
            if (!isOverlapping) {
              matches.push({ start: idx, end: idx + p.name.length, place: p });
            }
            idx = txt.indexOf(p.name, idx + 1);
          }
        });

        matches.sort((a, b) => a.start - b.start);

        if (matches.length === 0) {
          finalParts.push(<span key={`t-${partIdx}`}>{txt}</span>);
        } else {
          let lastIdx = 0;
          matches.forEach((m, mIdx) => {
            if (m.start > lastIdx) {
              finalParts.push(<span key={`t-${partIdx}-${mIdx}-pre`}>{txt.substring(lastIdx, m.start)}</span>);
            }
            finalParts.push(
              <button
                key={`link-${partIdx}-${mIdx}`}
                onClick={() => navigate?.('map', m.place.id)}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-extrabold text-[10px] rounded border border-blue-100/50 cursor-pointer transition-all active:scale-95"
                title="在地图中定位该地点"
              >
                <MapPin size={10} className="shrink-0 text-blue-500" />
                <span>{m.place.name}</span>
              </button>
            );
            lastIdx = m.end;
          });
          if (lastIdx < txt.length) {
            finalParts.push(<span key={`t-${partIdx}-post`}>{txt.substring(lastIdx)}</span>);
          }
        }
      }
    });

    return <>{finalParts}</>;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    
    if (!line) {
      flushList(`list-flush-${idx}`);
      renderedBlocks.push(<div key={`empty-${idx}`} className="h-2"></div>);
      continue;
    }

    if (line.startsWith('###')) {
      flushList(`list-flush-${idx}`);
      renderedBlocks.push(
        <h3 key={`h3-${idx}`} className="text-xs font-extrabold text-slate-800 pt-3 pb-1 border-b border-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
          <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
          {renderInlineFormatting(line.replace('###', '').trim(), places, onNavigateToView)}
        </h3>
      );
    } else if (line.startsWith('##')) {
      flushList(`list-flush-${idx}`);
      renderedBlocks.push(
        <h2 key={`h2-${idx}`} className="text-sm font-extrabold text-slate-900 pt-4 pb-1.5 border-b border-slate-150 flex items-center gap-2">
          <span className="w-1 h-3.5 bg-indigo-500 rounded-full"></span>
          {renderInlineFormatting(line.replace('##', '').trim(), places, onNavigateToView)}
        </h2>
      );
    } else if (line.startsWith('#')) {
      flushList(`list-flush-${idx}`);
      renderedBlocks.push(
        <h1 key={`h1-${idx}`} className="text-base font-black text-slate-900 pt-5 pb-2 border-b-2 border-slate-250">
          {renderInlineFormatting(line.replace('#', '').trim(), places, onNavigateToView)}
        </h1>
      );
    } else if (line.startsWith('>')) {
      flushList(`list-flush-${idx}`);
      const contentText = line.replace('>', '').replace('[!WARNING]', '').replace('[!CAUTION]', '').trim();
      const isWarning = line.includes('WARNING') || line.includes('CAUTION') || 
                        contentText.includes('警告') || contentText.includes('危险') || 
                        contentText.includes('千万不要') || contentText.includes('避坑') ||
                        contentText.includes('绝对不要');

      renderedBlocks.push(
        <div 
          key={`quote-${idx}`} 
          className={`p-3.5 rounded-xl border flex gap-2.5 text-xs my-3 ${
            isWarning 
              ? 'bg-rose-50/40 border-rose-150 text-rose-800 animate-pulse-subtle' 
              : 'bg-amber-50/40 border-amber-150 text-amber-800'
          }`}
        >
          <AlertTriangle size={15} className={`shrink-0 mt-0.5 ${isWarning ? 'text-rose-500' : 'text-amber-500'}`} />
          <div className="space-y-1">
            <p className={`font-black uppercase tracking-wider ${isWarning ? 'text-rose-950' : 'text-amber-950'}`}>
              {isWarning ? '⚠️ 避坑防爆安全警示' : '💡 备忘温馨提示'}：
            </p>
            <p className="leading-relaxed text-[11px]">
              {renderInlineFormatting(contentText, places, onNavigateToView)}
            </p>
          </div>
        </div>
      );
    } else if (line.startsWith('*') || line.startsWith('-') || /^\d+\./.test(line)) {
      const cleanedItem = line.replace(/^[\*\-\d+\.]/, '').trim();
      inList = true;
      listItems.push(cleanedItem);
    } else {
      flushList(`list-flush-${idx}`);
      renderedBlocks.push(
        <p key={`p-${idx}`} className="text-xs text-slate-600 leading-relaxed">
          {renderInlineFormatting(line, places, onNavigateToView)}
        </p>
      );
    }
  }

  flushList(`list-flush-end`);

  return <div className="space-y-2">{renderedBlocks}</div>;
}
