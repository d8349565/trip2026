import React, { useState } from 'react';
import { User, Place, Checklist, Guide, Visit, Media, InviteCode } from '../../types';
import { 
  Heart, CheckSquare, BookOpen, Clock, Image as ImageIcon, 
  Settings, Database, LogOut, ChevronRight, ShieldCheck, Plus,
  User as UserIcon
} from 'lucide-react';

interface MobileProfilePageProps {
  currentUser: User | null;
  places: Place[];
  checklists: Checklist[];
  guides: Guide[];
  visits: Visit[];
  media: Media[];
  invites: InviteCode[];
  onLogout: () => void;
  onLoginClick: () => void;
  onNavigateToView: (view: any, id?: string) => void;
  onGenerateInvite: (code: string, maxUses: number, expiresAt: string) => void;
  onOpenSubPage: (page: 'visits' | 'favorites' | null) => void;
}

export default function MobileProfilePage({
  currentUser,
  places,
  checklists,
  guides,
  visits,
  media,
  invites,
  onLogout,
  onLoginClick,
  onNavigateToView,
  onGenerateInvite,
  onOpenSubPage,
}: MobileProfilePageProps) {
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Statistics
  const favoriteCount = places.filter(p => p.favorite).length;
  const visitCount = visits.length;
  const photoCount = media.length;
  const guideCount = guides.length;
  const checklistCount = checklists.length;

  const handleCreateInviteCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    // Set 5 uses, expires in 30 days
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    onGenerateInvite(inviteCodeInput.toUpperCase().trim(), 5, expiry.toISOString().split('T')[0]);
    setInviteCodeInput('');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col h-full scrollbar-none pb-20 font-sans select-none">
      {/* 1. Header with Avatar */}
      <div className="bg-gradient-to-b from-blue-600 to-blue-700 text-white px-5 pt-8 pb-14 rounded-b-[2rem] shadow-md relative shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border-2 border-white/40 flex items-center justify-center font-extrabold text-2xl uppercase shadow-lg select-none">
            {currentUser ? currentUser.username[0] : <UserIcon size={28} />}
          </div>
          <div className="flex-1 min-w-0">
            {currentUser ? (
              <>
                <h2 className="font-extrabold text-[18px] leading-tight truncate">{currentUser.username}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${currentUser.role === 'admin' ? 'bg-amber-400 text-slate-900' : 'bg-white/20 text-white'}`}>
                    {currentUser.role === 'admin' ? '👑 管理员' : '成员'}
                  </span>
                  <span className="text-[12px] text-blue-100 font-semibold">私有数据已同步</span>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-extrabold text-[18px] leading-tight">访客模式</h2>
                <p className="text-[12px] text-blue-100 mt-1 font-semibold">登录以同步并管理私有旅行数据</p>
              </>
            )}
          </div>
          {!currentUser ? (
            <button
              onClick={onLoginClick}
              className="px-4 py-2.5 bg-white text-blue-600 rounded-xl font-black text-xs shadow-md active:scale-95 transition-all outline-none"
            >
              登录
            </button>
          ) : null}
        </div>
      </div>

      {/* 2. Grid Statistics */}
      <div className="px-5 -mt-4 select-none shrink-0">
        <div className="bg-white rounded-2xl p-4.5 shadow-sm border border-slate-100 grid grid-cols-3 gap-2 text-center">
          <button 
            onClick={() => onNavigateToView('map')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl hover:bg-slate-50 transition-all outline-none min-h-[44px]"
          >
            <span className="text-[17px] font-black text-slate-800">{favoriteCount}</span>
            <span className="text-[12px] text-slate-400 font-extrabold mt-1">收藏地点</span>
          </button>
          <button 
            onClick={() => onNavigateToView('photos')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl hover:bg-slate-50 transition-all outline-none min-h-[44px]"
          >
            <span className="text-[17px] font-black text-slate-800">{photoCount}</span>
            <span className="text-[12px] text-slate-400 font-extrabold mt-1">已传照片</span>
          </button>
          <button 
            onClick={() => onNavigateToView('guide')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl hover:bg-slate-50 transition-all outline-none min-h-[44px]"
          >
            <span className="text-[17px] font-black text-slate-800">{guideCount}</span>
            <span className="text-[12px] text-slate-400 font-extrabold mt-1">攻略笔记</span>
          </button>
        </div>
      </div>

      {/* 3. Navigation List grouped as requested */}
      <div className="px-5 mt-6 space-y-5">
        
        {/* 我的收藏 */}
        <div className="space-y-1.5">
          <p className="px-1.5 text-[12px] font-extrabold text-slate-400 uppercase tracking-wider">我的收藏</p>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs divide-y divide-slate-50 overflow-hidden">
            <button
              onClick={() => {
                // Navigate to map with favorites filter enabled
                onNavigateToView('map');
              }}
              className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 text-left outline-none min-h-[48px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-red-50 text-red-500 rounded-xl">
                  <Heart size={18} fill="currentColor" />
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-[14px]">收藏地点</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">查看及定位已收藏的自驾玩水点</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>

            <button
              onClick={() => onNavigateToView('guide')}
              className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 text-left outline-none min-h-[48px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
                  <BookOpen size={18} />
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-[14px]">收藏攻略</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">共 {guideCount} 篇自驾戏水干货与避坑指南</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>

            <button
              onClick={() => onNavigateToView('photos')}
              className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 text-left outline-none min-h-[48px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-purple-50 text-purple-500 rounded-xl">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-[14px]">收藏照片</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">游玩过程中的精彩照片与视频足迹</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          </div>
        </div>

        {/* 旅行资料 */}
        <div className="space-y-1.5">
          <p className="px-1.5 text-[12px] font-extrabold text-slate-400 uppercase tracking-wider">旅行资料</p>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs divide-y divide-slate-50 overflow-hidden">
            <button
              onClick={() => onNavigateToView('checklist')}
              className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 text-left outline-none min-h-[48px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-cyan-50 text-cyan-500 rounded-xl">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-[14px]">我的清单</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">共 {checklistCount} 个自备物资防遗忘清单</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>

            <button
              onClick={() => onOpenSubPage('visits')}
              className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 text-left outline-none min-h-[48px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-[14px]">到访记录</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">累计到访过 {visitCount} 个采集点</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>

            <button
              onClick={() => onNavigateToView('photos')}
              className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 text-left outline-none min-h-[48px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-[14px]">上传记录</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">管理已上传的 {photoCount} 张旅行风景照片</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          </div>
        </div>

        {/* 账号与数据 */}
        <div className="space-y-1.5">
          <p className="px-1.5 text-[12px] font-extrabold text-slate-400 uppercase tracking-wider">账号与数据</p>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs divide-y divide-slate-50 overflow-hidden">
            <div className="flex items-center justify-between p-4.5 min-h-[48px]">
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl">
                  <Database size={18} />
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-[14px]">数据自动保存</p>
                  <p className="text-[12px] text-emerald-500 mt-0.5 font-bold">● 数据已保存至私人服务器</p>
                </div>
              </div>
            </div>

            <div className="w-full flex items-center justify-between p-4.5 min-h-[48px]">
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-slate-100 text-slate-500 rounded-xl">
                  <Settings size={18} />
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-[14px]">同步与离线状态</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">已保存至私人服务器；网络中断时暂存本地</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">已同步</span>
            </div>
          </div>
        </div>

        {/* Admin only Maintenance Section */}
        {currentUser?.role === 'admin' && (
          <div className="space-y-1.5">
            <p className="px-1.5 text-[12px] font-extrabold text-slate-400 uppercase tracking-wider">系统管理专区</p>
            <div className="bg-white rounded-2xl border border-amber-100/60 shadow-xs overflow-hidden">
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className="w-full flex items-center justify-between p-4.5 bg-amber-50/30 text-left outline-none min-h-[48px]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2 bg-amber-100/70 text-amber-700 rounded-xl">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <p className="font-extrabold text-amber-950 text-[14px]">旅行团专属授权管理</p>
                    <p className="text-[12px] text-amber-600 mt-0.5">注册邀请码口令、成员授权明细</p>
                  </div>
                </div>
                <ChevronRight size={16} className={`text-amber-400 transition-transform ${showAdminPanel ? 'rotate-90' : ''}`} />
              </button>

              {showAdminPanel && (
                <div className="p-4.5 border-t border-slate-50 bg-amber-50/10 space-y-4">
                  {/* Create invite code */}
                  <form onSubmit={handleCreateInviteCode} className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">分发新受邀注册授权码</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="例如: CHAOZHOU2026"
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value)}
                        className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700 placeholder-slate-300"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition-all outline-none shrink-0"
                      >
                        <Plus size={14} />
                        <span>注册</span>
                      </button>
                    </div>
                  </form>

                  {/* Invite List */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">现有授权码清单</p>
                    {invites.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">暂无注册口令，请在上方输入生成</p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1 scrollbar-none">
                        {invites.map((inv) => (
                          <div key={inv.id} className="pt-1.5 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-mono font-bold text-blue-600">{inv.code}</span>
                              <span className="text-slate-400 text-[11px] ml-1.5">到期：{inv.expires_at}</span>
                            </div>
                            <span className="text-slate-500 font-semibold text-[11px] bg-slate-100 px-1.5 py-0.5 rounded-md">
                              已使用 {inv.uses}/{inv.max_uses}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logout Button */}
        {currentUser && (
          <button
            onClick={onLogout}
            className="w-full py-4 mt-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-98 outline-none min-h-[44px]"
          >
            <LogOut size={16} />
            <span>退出私有账号登录</span>
          </button>
        )}
      </div>
    </div>
  );
}
