import React, { useState } from 'react';
import { Media, Place } from '../../types';
import { Clock, Image as ImageIcon, Heart, Trash2, Calendar, Grid, BookOpen, Plus, Camera, X } from 'lucide-react';

interface MobilePhotoTimelineProps {
  media: Media[];
  places: Place[];
  onUploadPhoto: (photoData: { filename: string; file_size: number; dataUrl: string; place_id: string }) => Promise<void>;
  onDeletePhoto: (id: string) => void;
  onToggleFavorite: (id: string, fav: boolean) => void;
  onSelectPhoto: (photo: Media) => void;
}

export default function MobilePhotoTimeline({
  media,
  places,
  onUploadPhoto,
  onDeletePhoto,
  onToggleFavorite,
  onSelectPhoto,
}: MobilePhotoTimelineProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [uploadPlaceId, setUploadPlaceId] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Group photos for timeline: Date -> Place -> Photos List
  const groupedTimeline: Record<string, Record<string, Media[]>> = {};

  media.forEach(item => {
    // Determine date label
    const rawDate = item.captured_at || item.created_at || '2026-07-14';
    const dateObj = new Date(rawDate);
    let dateStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    if (isNaN(dateObj.getTime())) {
      dateStr = '近期上传';
    }

    // Determine place label
    const place = places.find(p => p.id === item.place_id);
    const placeName = place ? place.name : '散碎随拍打卡';

    if (!groupedTimeline[dateStr]) {
      groupedTimeline[dateStr] = {};
    }
    if (!groupedTimeline[dateStr][placeName]) {
      groupedTimeline[dateStr][placeName] = [];
    }
    groupedTimeline[dateStr][placeName].push(item);
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadPlaceId) return;
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        await onUploadPhoto({
          filename: file.name,
          file_size: file.size,
          dataUrl,
          place_id: uploadPlaceId
        });
        setIsUploading(false);
        setShowUploadModal(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('上传失败');
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* View mode buttons */}
      <div className="flex justify-between items-center">
        <div className="bg-slate-100 p-1 rounded-xl flex shrink-0">
          <button
            id="m_photo_timeline_tab"
            onClick={() => setViewMode('timeline')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'timeline' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
          >
            <Clock size={13} />
            <span>时间轴</span>
          </button>
          <button
            id="m_photo_grid_tab"
            onClick={() => setViewMode('grid')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
          >
            <Grid size={13} />
            <span>照片墙</span>
          </button>
        </div>

        <button
          id="m_trigger_upload"
          onClick={() => {
            if (places.length > 0) {
              setUploadPlaceId(places[0].id);
              setShowUploadModal(true);
            } else {
              alert('您需要先在地图或快捷新建中添加地点，才能上传照片关联！');
            }
          }}
          className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all outline-none"
        >
          <Camera size={13} />
          <span>上传照片</span>
        </button>
      </div>

      {media.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <ImageIcon size={40} className="text-slate-300 mx-auto" />
          <p className="text-xs text-slate-400 mt-2.5">暂无任何照片，开启您的自驾采风之旅吧！</p>
        </div>
      ) : viewMode === 'timeline' ? (
        /* Timeline view */
        <div className="space-y-5">
          {Object.keys(groupedTimeline).map(dateStr => (
            <div key={dateStr} className="space-y-3.5">
              {/* Date Header */}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></div>
                <h3 className="font-extrabold text-sm text-slate-800">{dateStr}</h3>
                <div className="flex-1 h-[1px] bg-slate-100"></div>
              </div>

              {/* Places sections inside this date */}
              <div className="space-y-4 pl-4 border-l border-slate-100 ml-1">
                {Object.keys(groupedTimeline[dateStr]).map(placeName => {
                  const photos = groupedTimeline[dateStr][placeName];
                  return (
                    <div key={placeName} className="space-y-2">
                      <p className="text-[11px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                        📍 {placeName} ({photos.length} 张)
                      </p>
                      
                      {/* Horizontal Scrolling Photo Row */}
                      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x">
                        {photos.map(photo => (
                          <div
                            key={photo.id}
                            id={`m_photo_tl_item_${photo.id}`}
                            onClick={() => onSelectPhoto(photo)}
                            className="w-28 h-28 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-100 snap-start active:scale-95 transition-transform cursor-pointer relative"
                          >
                            <img 
                              src={photo.file_path} 
                              alt="Timeline photo" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {photo.favorite && (
                              <span className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-0.5 text-[8px] flex items-center justify-center">
                                ★
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid view */
        <div className="grid grid-cols-2 gap-3 animate-in fade-in-50 duration-150">
          {media.map(photo => (
            <div
              key={photo.id}
              id={`m_photo_grid_item_${photo.id}`}
              onClick={() => onSelectPhoto(photo)}
              className="relative rounded-2xl overflow-hidden aspect-square bg-slate-100 border border-slate-100 cursor-pointer active:scale-98 transition-transform"
            >
              <img 
                src={photo.file_path} 
                alt="Grid Photo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2 inset-x-2 bg-slate-900/40 backdrop-blur-md px-2 py-1 rounded-lg flex justify-between items-center text-[10px] text-white">
                <span className="truncate flex-1 max-w-[60px]">
                  {places.find(p => p.id === photo.place_id)?.name || '随拍'}
                </span>
                {photo.favorite && (
                  <span className="text-rose-400">★</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload photo dialog */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end animate-fade-in">
          <div className="absolute inset-0" onClick={() => setShowUploadModal(false)}></div>
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl z-10 p-5 space-y-4 max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="font-extrabold text-slate-800 text-sm">📷 上传精彩瞬间照片</h4>
              <button onClick={() => setShowUploadModal(false)} className="p-1 rounded-full bg-slate-100 text-slate-500 outline-none">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">选择关联的游玩/标记地点</label>
                <select 
                  value={uploadPlaceId}
                  onChange={e => setUploadPlaceId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold"
                >
                  {places.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <label className="w-full py-6 bg-slate-50 hover:bg-slate-100/50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                  <Camera size={24} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">{isUploading ? '正在压缩并同步至服务器...' : '点击选择相册照片上传'}</span>
                  <span className="text-[10px] text-slate-400">支持 JPG, PNG, HEIC 格式图片</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileChange} 
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
