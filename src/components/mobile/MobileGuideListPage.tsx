import React, { useState } from 'react';
import { Guide, Place } from '../../types';
import { BookOpen, Search, MapPin, Calendar, Compass, ShieldAlert, Plus, X, ArrowRight, Eye } from 'lucide-react';

interface MobileGuideListPageProps {
  guides: Guide[];
  places: Place[];
  onSelectGuide: (guide: Guide) => void;
  onCreateGuide: (guide: Partial<Guide>) => void;
}

export default function MobileGuideListPage({
  guides,
  places,
  onSelectGuide,
  onCreateGuide,
}: MobileGuideListPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPlaceId, setNewPlaceId] = useState('');
  const [newSource, setNewSource] = useState('主管理员实地测绘');

  const filteredGuides = guides.filter(g => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return g.title.toLowerCase().includes(q) || g.summary.toLowerCase().includes(q) || g.content.toLowerCase().includes(q);
    }
    return true;
  });

  const getPlaceName = (targetId?: string) => {
    if (!targetId) return '通用经验';
    const place = places.find(p => p.id === targetId);
    return place ? place.name : '未知目标点';
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    onCreateGuide({
      title: newTitle,
      summary: newSummary || newContent.substring(0, 60),
      content: newContent,
      target_type: newPlaceId ? 'place' : 'general',
      target_id: newPlaceId || undefined,
      source: newSource,
      verified_at: new Date().toISOString().split('T')[0],
      visibility: 'shared'
    });
    setNewTitle('');
    setNewSummary('');
    setNewContent('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4 select-none pb-12">
      {/* Search Header */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white border border-slate-100 shadow-sm rounded-xl flex items-center px-3 h-11">
          <Search size={15} className="text-slate-400 mr-2 shrink-0" />
          <input
            id="m_guide_search"
            type="text"
            placeholder="搜索溯溪攻略、自驾避坑提示..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 text-slate-800 placeholder-slate-400 bg-transparent text-xs font-medium border-none outline-none"
          />
        </div>

        {!showAddForm && (
          <button
            id="m_guide_trigger_add"
            onClick={() => {
              if (places.length > 0) {
                setNewPlaceId(places[0].id);
              }
              setShowAddForm(true);
            }}
            className="px-3.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shrink-0 outline-none active:scale-95 transition-all"
          >
            <Plus size={13} />
            <span>撰写攻略</span>
          </button>
        )}
      </div>

      {/* Write Guide inline Form */}
      {showAddForm && (
        <form onSubmit={handleCreateSubmit} className="bg-white rounded-2xl p-4.5 border border-blue-100 space-y-3.5 text-xs animate-in slide-in-from-top-3">
          <div className="flex justify-between items-center border-b border-slate-50 pb-1">
            <h4 className="font-extrabold text-slate-800">📝 新撰写自驾与戏水经验</h4>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400"><X size={16} /></button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400">经验攻略标题</label>
            <input 
              type="text" 
              placeholder="例如：双坑村避暑戏水全攻略"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400">关联采集点</label>
              <select
                value={newPlaceId}
                onChange={e => setNewPlaceId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              >
                <option value="">🎒 无 (通用攻略)</option>
                {places.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400">来源信息</label>
              <input 
                type="text" 
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400">一句话简短摘要</label>
            <input 
              type="text" 
              placeholder="两句概括核心，例如：深潭不建议下水，平缓石滩最安逸。"
              value={newSummary}
              onChange={e => setNewSummary(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400">正文 Markdown 详情内容</label>
            <textarea 
              placeholder="### 最佳路线...  > 💡 贴士...  - 必备物品..."
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl h-28 outline-none resize-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold"
          >
            确认发布经验攻略
          </button>
        </form>
      )}

      {/* Guides List */}
      <div className="space-y-3">
        {filteredGuides.map(guide => {
          const rawDate = guide.verified_at || guide.updated_at || guide.created_at;
          const formattedDate = rawDate ? rawDate.substring(0, 10) : '近期核验';

          return (
            <div
              key={guide.id}
              id={`m_guide_item_${guide.id}`}
              onClick={() => onSelectGuide(guide)}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:bg-slate-50/50 transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-wider shrink-0">
                  {guide.target_type === 'place' ? '地点攻略' : '通用经验'}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  核验：{formattedDate}
                </span>
              </div>

              <h4 className="font-extrabold text-slate-800 text-sm mt-2 leading-snug">{guide.title}</h4>

              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                {guide.summary || '暂无详细摘要，点击卡片进入全屏查看 Markdown 排版攻略详情。'}
              </p>

              <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-slate-50 text-[10px] text-slate-400 font-bold">
                <span className="flex items-center gap-1">
                  <MapPin size={11} className="text-slate-400 shrink-0" />
                  关联：{getPlaceName(guide.target_id)}
                </span>
                
                <span className="flex items-center gap-0.5 text-blue-600">
                  <span>查看详情</span>
                  <ArrowRight size={10} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
