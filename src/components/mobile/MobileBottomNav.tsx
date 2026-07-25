import React from 'react';
import { Map, Calendar, Image, User, Plus } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: string;
  onViewChange: (view: any) => void;
  onOpenCreate: () => void;
}

export default function MobileBottomNav({ currentView, onViewChange, onOpenCreate }: MobileBottomNavProps) {
  return (
    <nav
      className="bg-white border-t border-slate-100 shrink-0 flex justify-around items-center text-slate-400 font-bold z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] select-none"
      style={{ paddingTop: 8, paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <button 
        id="m_nav_map"
        onClick={() => onViewChange('map')}
        className={`flex flex-col items-center justify-center gap-1 w-14 h-12 transition-all ${currentView === 'map' ? 'text-blue-600 scale-105' : 'hover:text-slate-600'}`}
      >
        <Map size={20} />
        <span className="text-[11px] font-medium">地图</span>
      </button>

      <button 
        id="m_nav_trip"
        onClick={() => onViewChange('trip')}
        className={`flex flex-col items-center justify-center gap-1 w-14 h-12 transition-all ${currentView === 'trip' ? 'text-blue-600 scale-105' : 'hover:text-slate-600'}`}
      >
        <Calendar size={20} />
        <span className="text-[11px] font-medium">行程</span>
      </button>

      {/* Center floating button */}
      <button 
        id="m_nav_plus"
        onClick={onOpenCreate}
        className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md shadow-blue-500/30 active:scale-95 transition-all -translate-y-2 outline-none"
        aria-label="新建项目"
      >
        <Plus size={24} strokeWidth={3} />
      </button>

      <button 
        id="m_nav_photos"
        onClick={() => onViewChange('photos')}
        className={`flex flex-col items-center justify-center gap-1 w-14 h-12 transition-all ${currentView === 'photos' ? 'text-blue-600 scale-105' : 'hover:text-slate-600'}`}
      >
        <Image size={20} />
        <span className="text-[11px] font-medium">照片</span>
      </button>

      <button 
        id="m_nav_profile"
        onClick={() => onViewChange('profile')}
        className={`flex flex-col items-center justify-center gap-1 w-14 h-12 transition-all ${currentView === 'profile' ? 'text-blue-600 scale-105' : 'hover:text-slate-600'}`}
      >
        <User size={20} />
        <span className="text-[11px] font-medium">我的</span>
      </button>
    </nav>
  );
}
