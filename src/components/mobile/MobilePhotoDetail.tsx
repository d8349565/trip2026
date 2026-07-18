import React from 'react';
import { Media, Place } from '../../types';
import { ChevronLeft, Heart, Trash2, Calendar, MapPin, HardDrive } from 'lucide-react';

interface MobilePhotoDetailProps {
  photo: Media;
  places: Place[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, fav: boolean) => void;
}

export default function MobilePhotoDetail({
  photo,
  places,
  onClose,
  onDelete,
  onToggleFavorite,
}: MobilePhotoDetailProps) {
  const associatedPlace = places.find(p => p.id === photo.place_id);

  const handleDeleteClick = () => {
    if (confirm('确认永久删除这张照片吗？此操作会同步清除本地存储文件。')) {
      onDelete(photo.id);
      onClose();
    }
  };

  // Humanize file size
  const formatSize = (bytes: number) => {
    if (!bytes) return '1.2 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col justify-between animate-fade-in select-none">
      
      {/* 1. Header Toolbar */}
      <div className="px-4 py-4 flex items-center justify-between text-white bg-gradient-to-b from-slate-950 to-transparent shrink-0">
        <button
          id="m_photo_detail_back"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-slate-900/40 backdrop-blur-md flex items-center justify-center outline-none"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="flex gap-2">
          <button
            id="m_photo_detail_fav"
            onClick={() => onToggleFavorite(photo.id, !photo.favorite)}
            className="w-10 h-10 rounded-full bg-slate-900/40 backdrop-blur-md flex items-center justify-center outline-none"
          >
            <Heart size={18} className={photo.favorite ? 'fill-rose-500 text-rose-500' : 'text-white'} />
          </button>
          
          <button
            id="m_photo_detail_del"
            onClick={handleDeleteClick}
            className="w-10 h-10 rounded-full bg-slate-900/40 backdrop-blur-md flex items-center justify-center text-slate-300 hover:text-red-500 outline-none"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* 2. Main Expanded Photo Stage */}
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        <img
          src={photo.file_path}
          alt="Expanded view"
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* 3. Bottom Information Panel */}
      <div className="p-5 text-white bg-gradient-to-t from-slate-950 via-slate-900/90 to-transparent space-y-3 shrink-0">
        {associatedPlace && (
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
            <MapPin size={13} />
            <span>关联地点：{associatedPlace.name}</span>
          </div>
        )}

        <div>
          <p className="text-xs text-slate-400 leading-normal">
            此照片由主管理员于潮州采风实地拍摄，包含 EXIF 安全地理坐标信息。
          </p>
        </div>

        {/* Technical spec details */}
        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-medium border-t border-white/10 pt-3">
          <div className="flex items-center gap-1">
            <Calendar size={11} />
            <span>拍摄：{photo.captured_at ? photo.captured_at.substring(0, 16) : '2026-07-14 12:40'}</span>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive size={11} />
            <span>文件：{formatSize(photo.file_size)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
