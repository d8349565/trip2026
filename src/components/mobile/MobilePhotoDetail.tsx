import React, { useRef } from 'react';
import { Media, Place } from '../../types';
import { ChevronLeft, Heart, Trash2, Calendar, MapPin, HardDrive, Image as ImageIcon } from 'lucide-react';

interface MobilePhotoDetailProps {
  photo: Media;
  places: Place[];
  /** 可切换的照片列表（与地点详情查看器一致的左右滑动体验），按展示顺序传入 */
  photos?: Media[];
  onNavigate?: (photo: Media) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, fav: boolean) => void;
  onSetCover?: (placeId: string, photoUrl: string) => void;
}

export default function MobilePhotoDetail({
  photo,
  photos,
  places,
  onNavigate,
  onClose,
  onDelete,
  onToggleFavorite,
  onSetCover,
}: MobilePhotoDetailProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const associatedPlace = places.find(p => p.id === photo.place_id);

  const currentIndex = photos ? photos.findIndex(p => p.id === photo.id) : -1;
  const canSwipe = Boolean(photos && photos.length > 1 && currentIndex >= 0 && onNavigate);

  const step = (delta: number) => {
    if (!canSwipe || !photos || !onNavigate) return;
    const next = Math.min(photos.length - 1, Math.max(0, currentIndex + delta));
    if (next !== currentIndex) onNavigate(photos[next]);
  };

  // 触摸结束：位移小视为单击（关闭），水平位移大视为滑动切换
  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      step(dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      onClose();
    }
  };

  const handleDeleteClick = () => {
    if (confirm('确认永久删除这张照片吗？此操作会同步清除本地存储文件。')) {
      onDelete(photo.id);
      onClose();
    }
  };

  // Humanize file size
  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950 z-50 flex flex-col justify-between animate-fade-in select-none"
      onTouchStart={(e) => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={handleTouchEnd}
    >

      {/* 1. Header Toolbar */}
      <div
        className="px-4 py-4 flex items-center justify-between text-white bg-gradient-to-b from-slate-950 to-transparent shrink-0"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            id="m_photo_detail_back"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-900/40 backdrop-blur-md flex items-center justify-center outline-none"
          >
            <ChevronLeft size={22} />
          </button>
          {canSwipe && photos && (
            <span className="text-[11px] font-bold text-white/60">{currentIndex + 1} / {photos.length}</span>
          )}
        </div>

        <div className="flex gap-2">
          {associatedPlace && onSetCover && associatedPlace.cover_image !== photo.file_path && (
            <button
              id="m_photo_detail_set_cover"
              onClick={() => onSetCover(associatedPlace.id, photo.file_path)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/40 text-white outline-none backdrop-blur-md active:scale-90"
              title="设为地点封面"
              aria-label="设为地点封面"
            >
              <ImageIcon size={18} />
            </button>
          )}
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
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/40 text-slate-300 outline-none backdrop-blur-md hover:text-red-500"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* 2. Main Expanded Photo Stage */}
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        <img
          key={photo.id}
          src={photo.file_path}
          alt="Expanded view"
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      </div>

      {/* 3. Bottom Information Panel */}
      <div
        className="p-5 text-white bg-gradient-to-t from-slate-950 via-slate-900/90 to-transparent space-y-3 shrink-0"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-xs text-slate-400 leading-normal">
            {associatedPlace
              ? <span className="flex items-center gap-1.5 text-blue-400 font-bold"><MapPin size={12} />{associatedPlace.name}</span>
              : (Number.isFinite(photo.display_latitude) && Number.isFinite(photo.display_longitude)
                  ? `拍摄坐标：${photo.display_latitude!.toFixed(4)}, ${photo.display_longitude!.toFixed(4)}`
                  : '未检测到位置信息')}
          </p>
        </div>

        {/* Technical spec details */}
        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-medium border-t border-white/10 pt-3">
          <div className="flex items-center gap-1">
            <Calendar size={11} />
            <span>拍摄：{photo.captured_at ? photo.captured_at.substring(0, 16) : '未知时间'}</span>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive size={11} />
            <span>文件：{formatSize(photo.file_size) || '未知'}</span>
          </div>
        </div>
        {canSwipe && (
          <p className="text-center text-[10px] font-bold text-white/30">单击关闭 · 左右滑动切换</p>
        )}
      </div>
    </div>
  );
}
