import React from 'react';
import { Place, PlaceCategory, Trip } from '../../types';
import { Star, MapPin, Calendar, BookOpen, ChevronRight, X } from 'lucide-react';

interface MobilePlaceMiniCardProps {
  place: Place;
  coverUrl?: string;
  onClose: () => void;
  onViewDetails: () => void;
  onAddToTrip: () => void;
  categoryColors: Record<PlaceCategory, { bg: string; text: string; iconBg: string; border: string }>;
  categoryLabels: Record<PlaceCategory, string>;
  categoryIcons: Record<PlaceCategory, React.ReactNode>;
}

export default function MobilePlaceMiniCard({
  place,
  coverUrl,
  onClose,
  onViewDetails,
  onAddToTrip,
  categoryColors,
  categoryLabels,
  categoryIcons,
}: MobilePlaceMiniCardProps) {

  const thumb = coverUrl ?? place.cover_image;
  const colorConfig = categoryColors[place.category_id] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };

  return (
    <div className="absolute bottom-4 inset-x-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100/80 p-4 z-40 flex flex-col animate-slide-up select-none">
      {/* Top row with Title and Close */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap flex items-center gap-1 ${colorConfig.bg} ${colorConfig.text} border ${colorConfig.border}`}>
            <span>{categoryIcons[place.category_id]}</span>
            <span>{categoryLabels[place.category_id]}</span>
          </span>
          <h3 className="font-extrabold text-slate-800 text-sm truncate">{place.name}</h3>
        </div>
        <button 
          id="m_minicard_close"
          onClick={onClose}
          className="p-1 bg-slate-100/80 text-slate-400 rounded-full hover:text-slate-600 outline-none"
        >
          <X size={14} />
        </button>
      </div>

      {/* Center content with Image and Meta */}
      <div className="mt-3 flex gap-3.5">
        {thumb ? (
          <img 
            src={thumb}
            alt={place.name} 
            className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-slate-300 shrink-0">
            <span className="text-xl">📍</span>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold">
              <span className="flex items-center text-amber-500 font-black">
                ★ {place.rating ? place.rating.toFixed(1) : '未评分'}
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-0.5 truncate">
                <MapPin size={11} />
                {place.address}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
              {place.summary || '暂无详细介绍，一键加入行程或查看自驾攻略。'}
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-1">
            {place.is_wet && (
              <span className="bg-cyan-50 text-cyan-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-cyan-100">
                🌊 避暑涉水
              </span>
            )}
            {place.need_hiking && (
              <span className="bg-amber-50 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-amber-100">
                🥾 需要徒步
              </span>
            )}
            {place.favorite && (
              <span className="bg-rose-50 text-rose-500 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-rose-100">
                ★ 精选收藏
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer operations */}
      <div className="mt-4 pt-3.5 border-t border-slate-50 flex gap-3">
        <button
          id="m_minicard_details"
          onClick={onViewDetails}
          className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-[0.98] transition-all outline-none"
        >
          <BookOpen size={13} />
          <span>攻略与详情</span>
          <ChevronRight size={12} />
        </button>
        <button
          id="m_minicard_add_trip"
          onClick={onAddToTrip}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-[0.98] transition-all outline-none shadow-md shadow-blue-500/10"
        >
          <Calendar size={13} />
          <span>安排加入行程</span>
        </button>
      </div>
    </div>
  );
}
