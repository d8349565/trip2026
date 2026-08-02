import React, { useState } from 'react';
import { Guide, Place, Trip } from '../../types';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft, MoreVertical, MapPin, Calendar, Compass, Star, Edit3, Trash2, Check, X, Sparkles } from 'lucide-react';

interface MobileGuideDetailPageProps {
  guide: Guide;
  places: Place[];
  trips: Trip[];
  onClose: () => void;
  onSelectPlaceOnMap: (placeId: string) => void;
  onAddPlaceToTrip: (placeId: string) => void;
  onDeleteGuide: (id: string) => void;
  onUpdateGuide: (id: string, data: Partial<Guide>) => void;
}

export default function MobileGuideDetailPage({
  guide,
  places,
  trips,
  onClose,
  onSelectPlaceOnMap,
  onAddPlaceToTrip,
  onDeleteGuide,
  onUpdateGuide,
}: MobileGuideDetailPageProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Edit fields
  const [editTitle, setEditTitle] = useState(guide.title);
  const [editContent, setEditContent] = useState(guide.content);
  const [editSummary, setEditSummary] = useState(guide.summary);

  const associatedPlace = places.find(p => p.id === guide.target_id);

  const handleSaveEdit = () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    onUpdateGuide(guide.id, {
      title: editTitle,
      content: editContent,
      summary: editSummary
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('确认永久删除这篇经验攻略吗？此操作不可逆。')) {
      onDeleteGuide(guide.id);
      onClose();
    }
  };

  const handleViewPlace = () => {
    if (associatedPlace) {
      onSelectPlaceOnMap(associatedPlace.id);
      onClose();
    } else {
      setFeedback('这篇攻略是通用经验，没有绑定到具体地点。');
    }
  };

  const handleAddTrip = () => {
    if (associatedPlace) {
      onAddPlaceToTrip(associatedPlace.id);
      setFeedback(`已打开「${associatedPlace.name}」的加入行程面板，请选择具体日期。`);
    } else {
      setFeedback('这篇攻略没有关联具体地点，暂时无法加入行程。');
    }
  };

  const rawDate = guide.verified_at || guide.updated_at || guide.created_at;
  const formattedDate = rawDate ? rawDate.substring(0, 10) : '近期已核验';

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col justify-between animate-fade-in select-none">
      
      {/* 1. Header Toolbar */}
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white">
        <button
          id="m_guide_detail_back"
          onClick={onClose}
          aria-label="返回攻略列表"
          className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-700 outline-none active:scale-95 transition-all"
        >
          <ChevronLeft size={20} />
        </button>

        <span className="font-extrabold text-slate-800 text-xs truncate max-w-[180px]">
          {isEditing ? '编辑攻略详情' : guide.title}
        </span>

        <button
          id="m_guide_detail_more"
          onClick={() => setShowMoreMenu(true)}
          aria-label="打开攻略更多操作"
          className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 outline-none"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* 2. Main Content Body Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {feedback && (
          <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold leading-relaxed text-blue-700">
            {feedback}
          </p>
        )}
        {isEditing ? (
          <div className="space-y-4 text-xs">
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">修改标题</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">修改一句话摘要</label>
              <input
                type="text"
                value={editSummary}
                onChange={e => setEditSummary(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">修改正文 Markdown 详情</label>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl h-60 outline-none resize-none"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl"
              >
                保存更新
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Guide metadata */}
            <div className="space-y-2">
              <h2 className="text-lg font-black text-slate-900 leading-snug">{guide.title}</h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400 font-bold">
                <span>来源：{guide.source || '实地测绘核验'}</span>
                <span>•</span>
                <span>最后验证于：{formattedDate}</span>
              </div>
            </div>

            {/* Markdown rendered body with native style classes */}
            <div className="markdown-body text-xs leading-relaxed text-slate-700 space-y-3.5 border-y border-slate-50 py-4 font-medium">
              <ReactMarkdown>{guide.content}</ReactMarkdown>
            </div>

            {/* Place attachment info banner */}
            {associatedPlace && (
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">关联采点</span>
                    <span className="font-extrabold text-slate-800 text-xs truncate block">{associatedPlace.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">{associatedPlace.address}</p>
                </div>
                <button
                  onClick={handleViewPlace}
                  className="px-2.5 py-1.5 bg-white border border-slate-150/50 hover:bg-slate-50 text-slate-700 rounded-lg text-[10px] font-bold outline-none shrink-0 shadow-sm"
                >
                  去地图看看
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Footer Action Buttons (Fixed layout) */}
      {!isEditing && (
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 bg-white shrink-0">
          <button
            id="m_guide_action_view_place"
            onClick={handleViewPlace}
            disabled={!associatedPlace}
            className={`flex-1 py-3 font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm border outline-none ${
              associatedPlace 
                ? 'bg-white border-slate-150 text-slate-700 active:scale-98' 
                : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            <MapPin size={13} />
            <span>查看地点</span>
          </button>

          <button
            id="m_guide_action_add_trip"
            onClick={handleAddTrip}
            disabled={!associatedPlace}
            className={`flex-1 py-3 font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-md outline-none ${
              associatedPlace 
                ? 'bg-blue-600 text-white active:scale-98' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            <Compass size={13} />
            <span>加入行程</span>
          </button>
        </div>
      )}

      {/* More actions overlay sheet */}
      {showMoreMenu && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end animate-fade-in">
          <div className="absolute inset-0" onClick={() => setShowMoreMenu(false)}></div>
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl z-10 p-5 space-y-3 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h5 className="font-extrabold text-slate-800 text-xs">更多攻略工具</h5>
              <button aria-label="关闭攻略更多操作" onClick={() => setShowMoreMenu(false)} className="p-1 rounded-full bg-slate-100 text-slate-500 outline-none"><X size={15} /></button>
            </div>

            <div className="space-y-1">
              <button
                id="m_guide_sheet_edit"
                onClick={() => {
                  setIsEditing(true);
                  setShowMoreMenu(false);
                }}
                className="w-full p-3 hover:bg-slate-50 text-left rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 outline-none"
              >
                <Edit3 size={14} className="text-blue-500" />
                <span>编辑这篇经验攻略正文</span>
              </button>

              <button
                id="m_guide_sheet_del"
                onClick={() => {
                  setShowMoreMenu(false);
                  handleDelete();
                }}
                className="w-full p-3 hover:bg-red-50 text-left rounded-xl text-xs font-bold text-red-600 flex items-center gap-2 outline-none"
              >
                <Trash2 size={14} className="text-red-500" />
                <span>永久删除本篇核验攻略</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
