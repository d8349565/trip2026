import React from 'react';
import { X, MapPin, Calendar, Image, BookOpen, CheckSquare, Compass } from 'lucide-react';

interface MobileCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: 'add_place' | 'create_trip' | 'upload_photo' | 'create_guide' | 'create_checklist' | 'log_visit') => void;
}

export default function MobileCreateSheet({ isOpen, onClose, onAction }: MobileCreateSheetProps) {
  if (!isOpen) return null;

  const actions = [
    {
      id: 'm_act_place',
      type: 'add_place' as const,
      label: '新增地点',
      desc: '记录一个新的采集或补给点',
      icon: <MapPin className="text-emerald-500" size={20} />,
      bgColor: 'bg-emerald-50',
    },
    {
      id: 'm_act_trip',
      type: 'create_trip' as const,
      label: '创建行程',
      desc: '规划一次全新的旅行路线',
      icon: <Calendar className="text-blue-500" size={20} />,
      bgColor: 'bg-blue-50',
    },
    {
      id: 'm_act_photo',
      type: 'upload_photo' as const,
      label: '上传照片',
      desc: '上传并关联旅行精彩瞬间',
      icon: <Image className="text-purple-500" size={20} />,
      bgColor: 'bg-purple-50',
    },
    {
      id: 'm_act_guide',
      type: 'create_guide' as const,
      label: '新建攻略',
      desc: '撰写戏水避暑与避坑经验',
      icon: <BookOpen className="text-amber-500" size={20} />,
      bgColor: 'bg-amber-50',
    },
    {
      id: 'm_act_checklist',
      type: 'create_checklist' as const,
      label: '新建清单',
      desc: '备足徒步/溯溪装备与物资',
      icon: <CheckSquare className="text-cyan-500" size={20} />,
      bgColor: 'bg-cyan-50',
    },
    {
      id: 'm_act_visit',
      type: 'log_visit' as const,
      label: '快速记录到访',
      desc: '签到打卡并评价当前到访点',
      icon: <Compass className="text-red-500" size={20} />,
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end animate-fade-in">
      {/* Background overlay click */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      {/* Sliding Sheet */}
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl z-10 flex flex-col max-h-[85vh] animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">快捷新建与记录</h3>
            <p className="text-xs text-slate-400 mt-0.5">选择您想要在旅途中进行的操作</p>
          </div>
          <button 
            id="m_close_create_sheet"
            onClick={onClose}
            className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 active:scale-95 transition-all outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Grid/List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 pb-8">
          {actions.map((act) => (
            <button
              key={act.type}
              id={act.id}
              onClick={() => {
                onAction(act.type);
                onClose();
              }}
              className="w-full flex items-center gap-4 p-3.5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 active:scale-[0.99] transition-all text-left outline-none shadow-xs"
            >
              <div className={`p-3 rounded-xl ${act.bgColor} shrink-0`}>
                {act.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm leading-snug">{act.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{act.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
