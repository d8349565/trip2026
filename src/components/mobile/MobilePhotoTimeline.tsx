import React, { useState, useMemo } from 'react';
import { Media, Place, type MediaUploadInput } from '../../types';
import { api } from '../../api';
import { describeBrowserLocationFailure } from '../../utils/browserLocation';
import { photoLocationFields, preparePhotoForUpload } from '../../utils/photoUpload';
import { CATEGORY_OPTIONS } from '../../utils/categories';
import { formatMediaDate, groupMediaByDate, sortMediaByDateDesc } from '../../utils/mediaTimeline';
import { Clock, Image as ImageIcon, Heart, Trash2, Calendar, Grid, BookOpen, Plus, Camera, MapPin, X, Search, ChevronRight, CheckCircle2, Link2 } from 'lucide-react';

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.id, c.emoji]));
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.id, c.label]));

interface MobilePhotoTimelineProps {
  media: Media[];
  places: Place[];
  onUploadPhoto: (photoData: MediaUploadInput) => Promise<Media | void> | Promise<void>;
  onDeletePhoto: (id: string) => void;
  onToggleFavorite: (id: string, fav: boolean) => void;
  onSelectPhoto: (photo: Media) => void;
  onCreatePlaceFromPhoto: (seed: { mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string }) => void;
  onLinkPhotoToPlace: (mediaId: string, placeId: string) => Promise<void> | void;
}

export default function MobilePhotoTimeline({
  media,
  places,
  onUploadPhoto,
  onDeletePhoto,
  onToggleFavorite,
  onSelectPhoto,
  onCreatePlaceFromPhoto,
  onLinkPhotoToPlace,
}: MobilePhotoTimelineProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [uploadPlaceId, setUploadPlaceId] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [photoPrompt, setPhotoPrompt] = useState<{ mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string; recognized: boolean; hint?: string } | null>(null);
  const [showLinkSheet, setShowLinkSheet] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [justLinked, setJustLinked] = useState<string | null>(null);

  // 可并入的已有地点：按搜索词过滤，收藏优先，便于快速定位
  const linkablePlaces = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    const list = q
      ? places.filter((p) => p.name.toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q))
      : places.slice();
    list.sort((a, b) => Number(b.favorite) - Number(a.favorite));
    return list;
  }, [places, linkQuery]);

  const groupedTimeline = useMemo(() => groupMediaByDate(media).map(({ dateKey, photos }) => {
    const groupedByPlace: Record<string, Media[]> = {};
    photos.forEach((photo) => {
      const place = places.find((item) => item.id === photo.place_id);
      const placeName = place ? place.name : '散碎随拍打卡';
      (groupedByPlace[placeName] ??= []).push(photo);
    });
    return { dateKey, groups: Object.entries(groupedByPlace) };
  }), [media, places]);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    allowBrowserLocationFallback = false,
  ) => {
    const file = e.target.files?.[0];
    if (!file || isUploading) return;
    setIsUploading(true);
    setUploadError('');
    try {
      // Read EXIF from the original file, then compress so the payload stays
      // under the server's 10 MB JSON limit (raw phone photos exceed it).
      const prepared = await preparePhotoForUpload(file, { allowBrowserLocationFallback });
      const created = await onUploadPhoto({
        filename: prepared.fileName,
        file_size: prepared.fileSize,
        dataUrl: prepared.dataUrl,
        place_id: uploadPlaceId || undefined,
        captured_at: prepared.exif.capturedAt,
        ...photoLocationFields(prepared.exif),
      });

      // 上传后未手动关联地点：有 GPS 就自动建标记，无 GPS 才引导手动选点。
      if (created && !uploadPlaceId) {
        if (Number.isFinite(created.display_latitude) && Number.isFinite(created.display_longitude)) {
          let address = '';
          let name: string | undefined;
          try {
            const location = await api.reverseGeocode(created.display_latitude as number, created.display_longitude as number);
            address = location.address;
            name = location.name;
          } catch {
            // 坐标仍可用，自动建点时名称会回退为「照片拍摄点」。
          }
          // 有 GPS 也先让用户去地图确认/微调位置，确认保存后才真正建点（避免 GPS 偏差直接落库）
          setPhotoPrompt({ mediaId: created.id, latitude: created.display_latitude, longitude: created.display_longitude, name, address, recognized: true });
        } else {
          setPhotoPrompt({
            mediaId: created.id,
            recognized: false,
            hint: prepared.exif.locationFailure
              ? describeBrowserLocationFailure(prepared.exif.locationFailure)
              : undefined,
          });
        }
      }
      setShowUploadModal(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败，请重试。');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* Photo location recognition prompt */}
      {photoPrompt && (
        <div data-testid="photo-place-prompt" className="flex items-start gap-2.5 rounded-2xl border border-blue-100 bg-blue-50 px-3.5 py-3">
          <MapPin size={15} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-blue-800 leading-snug">
              {photoPrompt.recognized
                ? `已识别拍摄地点：${photoPrompt.name || photoPrompt.address || '地图位置'}。GPS 可能有几十米偏差，去地图确认位置后再创建标记。`
                : (
                  <>
                    这张照片未检测到位置信息，可以手动选点创建标记。
                    <span className="mt-1 block text-[10px] font-medium text-blue-500/90 leading-snug">
                      {photoPrompt.hint || '常见原因：系统照片选择器或分享应用抹掉了位置元数据。可改用「拍照上传」，或在地图上手动选点。'}
                    </span>
                  </>
                )}
            </p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
              <button
                data-testid="photo-place-create"
                onClick={() => {
                  onCreatePlaceFromPhoto({
                    mediaId: photoPrompt.mediaId,
                    latitude: photoPrompt.latitude,
                    longitude: photoPrompt.longitude,
                    name: photoPrompt.name,
                    address: photoPrompt.address
                  });
                  setPhotoPrompt(null);
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white active:scale-95 transition-all"
              >
                <MapPin size={13} />
                {photoPrompt.recognized ? '去确认位置' : '去地图选点'}
              </button>
              <button
                onClick={() => setShowLinkSheet(true)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] font-bold text-blue-600 active:scale-95 transition-all"
              >
                <Link2 size={13} />
                关联已有地点
              </button>
              </div>
              <button
                onClick={() => setPhotoPrompt(null)}
                className="w-full rounded-lg px-3 py-1 text-[10px] font-bold text-slate-400 active:scale-95 transition-all"
              >
                忽略，暂不处理
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 并入成功反馈 */}
      {justLinked && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 animate-fade-in">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-emerald-800">照片已并入「{justLinked}」</p>
          <button onClick={() => setJustLinked(null)} className="shrink-0 rounded-full p-1 text-emerald-500 active:scale-90"><X size={13} /></button>
        </div>
      )}

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
            setUploadPlaceId('');
            setUploadError('');
            setShowUploadModal(true);
          }}
          className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all outline-none"
        >
          <Camera size={13} />
          <span>上传照片</span>
        </button>
      </div>

      {media.length === 0 ? (
        <div className="text-center py-16 px-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <ImageIcon size={40} className="text-slate-300 mx-auto" />
          <p className="text-xs text-slate-500 font-semibold mt-2.5">还没有旅行照片</p>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">上传第一张照片后，可以识别位置、关联地点并整理成时间轴。</p>
          <button
            type="button"
            onClick={() => {
              setUploadError('');
              setShowUploadModal(true);
            }}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 active:scale-95"
          >
            上传第一张照片
          </button>
        </div>
      ) : viewMode === 'timeline' ? (
        /* Timeline view */
        <div className="space-y-5">
          {groupedTimeline.map(({ dateKey, groups }) => (
            <div key={dateKey} className="space-y-3.5">
              {/* Date Header */}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></div>
                <h3 className="font-extrabold text-sm text-slate-800">{formatMediaDate(dateKey)}</h3>
                <div className="flex-1 h-[1px] bg-slate-100"></div>
              </div>

              {/* Places sections inside this date */}
              <div className="space-y-4 pl-4 border-l border-slate-100 ml-1">
                {groups.map(([placeName, photos]) => {
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
          {sortMediaByDateDesc(media).map(photo => (
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
              <div className="absolute bottom-2 inset-x-2 bg-slate-900/50 backdrop-blur-md px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] text-white">
                <span className="truncate flex-1 min-w-0 text-left font-medium">
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
              <button aria-label="关闭照片上传" onClick={() => setShowUploadModal(false)} className="p-1 rounded-full bg-slate-100 text-slate-500 outline-none">
                <X size={16} />
              </button>
            </div>

            {uploadError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-rose-700">{uploadError}</p>}

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">选择关联的游玩/标记地点（可不选，自动识别照片位置）</label>
                <select
                  value={uploadPlaceId}
                  onChange={e => setUploadPlaceId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold"
                >
                  <option value="">不关联（上传后根据照片识别位置）</option>
                  {places.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="py-6 bg-blue-50 hover:bg-blue-100/50 border border-dashed border-blue-200 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                  <Camera size={24} className="text-blue-500" />
                  <span className="text-xs font-bold text-blue-700">{isUploading ? '处理中…' : '拍照上传'}</span>
                  <span className="text-[10px] text-blue-400 text-center leading-tight">相机直出原图<br />保留位置信息</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => void handleFileChange(event, true)}
                    disabled={isUploading}
                  />
                </label>
                <label className="py-6 bg-slate-50 hover:bg-slate-100/50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                  <ImageIcon size={24} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">从相册选择</span>
                  <span className="text-[10px] text-slate-400 text-center leading-tight">安卓系统可能会<br />抹掉位置信息</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleFileChange(event, false)}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 关联到已有地点 — 底部选择面板 */}
      {showLinkSheet && photoPrompt && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/60 backdrop-blur-xs animate-fade-in" onClick={() => { setShowLinkSheet(false); setLinkQuery(''); }}>
          <div className="flex max-h-[82vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 px-5 pb-3 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-800">关联到已有地点</h4>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">选择这张照片所属的地点，照片将并入该地点的相册。</p>
                </div>
                <button onClick={() => { setShowLinkSheet(false); setLinkQuery(''); }} className="shrink-0 rounded-full bg-slate-100 p-2 text-slate-500 active:scale-90"><X size={15} /></button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Search size={15} className="shrink-0 text-slate-400" />
                <input value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} placeholder="搜索地点名称或地址" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-300" />
              </div>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
              {places.length === 0 ? (
                <div className="py-10 text-center"><MapPin size={28} className="mx-auto text-slate-300" /><p className="mt-2 text-[11px] text-slate-400">还没有任何地点，去地图新建一个吧</p></div>
              ) : linkablePlaces.length === 0 ? (
                <div className="py-10 text-center"><Search size={24} className="mx-auto text-slate-300" /><p className="mt-2 text-[11px] text-slate-400">没有匹配「{linkQuery}」的地点</p></div>
              ) : (
                linkablePlaces.map((p) => {
                  const count = media.filter((m) => m.place_id === p.id).length;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onLinkPhotoToPlace(photoPrompt.mediaId, p.id);
                        setJustLinked(p.name);
                        setPhotoPrompt(null);
                        setShowLinkSheet(false);
                        setLinkQuery('');
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-left transition-all active:scale-[0.99] active:border-blue-300 active:bg-blue-50/50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-lg">{CATEGORY_EMOJI[p.category_id] ?? '📍'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-slate-800">{p.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-400">{CATEGORY_LABEL[p.category_id] ? `${CATEGORY_LABEL[p.category_id]} · ` : ''}{p.address || '暂无地址'}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        {p.favorite && <Heart size={12} className="fill-amber-400 text-amber-400" />}
                        <span className="text-[10px] font-bold text-slate-400">{count} 张</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </button>
                  );
                })
              )}
            </div>
            <div className="shrink-0 border-t border-slate-100 px-3 pb-4 pt-3">
              <button
                onClick={() => {
                  const seed = photoPrompt;
                  setShowLinkSheet(false);
                  setLinkQuery('');
                  setPhotoPrompt(null);
                  onCreatePlaceFromPhoto({ mediaId: seed.mediaId, latitude: seed.latitude, longitude: seed.longitude, name: seed.name, address: seed.address });
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-[12px] font-bold text-blue-600 transition-all active:scale-[0.99]"
              >
                <Plus size={15} /> 没找到？去地图新建标记
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
