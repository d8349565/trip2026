/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { InviteCode, User } from '../types';
import { api } from '../api';
import { 
  Shield, Server, Users, Database, Sparkles, HardDrive, UserPlus, KeyRound
} from 'lucide-react';

interface SettingsPanelProps {
  invites: InviteCode[];
  onGenerateInvite: (code: string, maxUses: number, expiresAt: string) => void;
}

export default function SettingsPanel({
  invites,
  onGenerateInvite
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'invite' | 'system'>('users');
  const [capacity, setCapacity] = useState<any>({
    db_size: 1540,
    uploads_size: 20480,
    photos_count: 5,
    places_count: 5,
    trips_count: 1,
    users_count: 2,
    max_uploads_limit: 10 * 1024 * 1024 * 1024,
    alert_triggered: false
  });

  // Form states
  const [inviteCode, setInviteCode] = useState('');
  const [maxUses, setMaxUses] = useState(5);
  const [expiresAt, setExpiresAt] = useState('2027-12-31');

  // User management states
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [userBusy, setUserBusy] = useState(false);
  const [userMessage, setUserMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  // 行级操作（停用/启用、改角色）的防重复提交标记：记录正在操作的用户 id
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadSettingsData();
    loadUsers();
  }, []);

  const loadSettingsData = async () => {
    try {
      const cap = await api.getCapacity();
      setCapacity(cap);

    } catch (e) {
      console.warn('Failed to fetch stats', e);
    }
  };

  const loadUsers = async () => {
    try {
      setUsers(await api.getAdminUsers());
    } catch (e) {
      console.warn('Failed to fetch users', e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userBusy) return;
    setUserBusy(true);
    setUserMessage(null);
    try {
      await api.createAdminUser({ username: newUsername.trim(), password: newPassword, role: newRole });
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      setUserMessage({ type: 'success', text: '成员账号已创建，可将用户名和密码告知家人' });
      await loadUsers();
    } catch (error) {
      setUserMessage({ type: 'error', text: error instanceof Error ? error.message : '创建用户失败' });
    } finally {
      setUserBusy(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (rowBusyId) return;
    setRowBusyId(user.id);
    setUserMessage(null);
    try {
      await api.updateAdminUser(user.id, { is_active: !user.is_active });
      await loadUsers();
    } catch (error) {
      setUserMessage({ type: 'error', text: error instanceof Error ? error.message : '更新用户状态失败' });
    } finally {
      setRowBusyId(null);
    }
  };

  const handleChangeRole = async (user: User, role: 'admin' | 'user') => {
    if (rowBusyId) return;
    setRowBusyId(user.id);
    setUserMessage(null);
    try {
      await api.updateAdminUser(user.id, { role });
      await loadUsers();
    } catch (error) {
      setUserMessage({ type: 'error', text: error instanceof Error ? error.message : '更新用户角色失败' });
      await loadUsers();
    } finally {
      setRowBusyId(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetId || userBusy) return;
    setUserBusy(true);
    setUserMessage(null);
    try {
      await api.resetAdminUserPassword(resetTargetId, resetPassword);
      setUserMessage({ type: 'success', text: '密码已重置，该成员需使用新密码重新登录' });
      setResetTargetId(null);
      setResetPassword('');
    } catch (error) {
      setUserMessage({ type: 'error', text: error instanceof Error ? error.message : '重置密码失败' });
    } finally {
      setUserBusy(false);
    }
  };

  const handleGenerateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateInvite(inviteCode, maxUses, new Date(expiresAt).toISOString());
    setInviteCode('');
    setMaxUses(5);
    setTimeout(() => loadSettingsData(), 500);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-800">系统维护与高级管理</h2>
        <p className="text-[11px] text-slate-500 font-medium">管理家庭成员邀请码，查看服务器存储状况；数据由服务端统一保存。</p>
      </div>

      {/* Settings Sub navigation tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            activeTab === 'users'
              ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
              : 'bg-white text-slate-500 border-slate-150 hover:bg-slate-50'
          }`}
        >
          👥 成员账号管理
        </button>
        <button
          onClick={() => setActiveTab('invite')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            activeTab === 'invite'
              ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
              : 'bg-white text-slate-500 border-slate-150 hover:bg-slate-50'
          }`}
        >
          🔐 邀请注册管理
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            activeTab === 'system'
              ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
              : 'bg-white text-slate-500 border-slate-150 hover:bg-slate-50'
          }`}
        >
          📊 容量指标仪表盘
        </button>
      </div>

      {/* Tab: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-150 space-y-4 h-fit">
            <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">
              <UserPlus size={14} className="text-blue-500" />
              新增成员账号
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">用户名 (3-32 位)</label>
                <input
                  type="text"
                  placeholder="例如: mama"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  minLength={3}
                  maxLength={32}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">初始密码 (至少 10 位)</label>
                <input
                  type="text"
                  placeholder="设置后告知家人，可登录后自行修改"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={10}
                  maxLength={128}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">角色</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="user">成员（可维护地点/行程/照片）</option>
                  <option value="admin">管理员（额外可管理账号）</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={userBusy}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow hover:bg-blue-700 disabled:opacity-50"
              >
                创建账号
              </button>
            </form>

            {userMessage && (
              <p className={`text-[10px] font-semibold ${userMessage.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                {userMessage.text}
              </p>
            )}
          </div>

          <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-150 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">
              <Users size={14} className="text-emerald-500" />
              已注册成员
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-extrabold">
                    <th className="py-2.5">用户名</th>
                    <th className="py-2.5">角色</th>
                    <th className="py-2.5">注册时间</th>
                    <th className="py-2.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                  {users.map(user => (
                    <React.Fragment key={user.id}>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-3 font-bold text-slate-800">
                          {user.username}
                          {!user.is_active && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-400">已停用</span>
                          )}
                        </td>
                        <td className="py-3">
                          <select
                            value={user.role}
                            onChange={(e) => handleChangeRole(user, e.target.value as 'admin' | 'user')}
                            disabled={rowBusyId !== null}
                            className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none disabled:opacity-50"
                          >
                            <option value="user">成员</option>
                            <option value="admin">管理员</option>
                          </select>
                        </td>
                        <td className="py-3">{user.created_at.substring(0, 10)}</td>
                        <td className="py-3 text-right space-x-1.5">
                          <button
                            onClick={() => { setResetTargetId(resetTargetId === user.id ? null : user.id); setResetPassword(''); }}
                            className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200"
                          >
                            重置密码
                          </button>
                          <button
                            onClick={() => handleToggleActive(user)}
                            disabled={rowBusyId !== null}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold disabled:opacity-50 ${
                              user.is_active
                                ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                            }`}
                          >
                            {user.is_active ? '停用' : '启用'}
                          </button>
                        </td>
                      </tr>
                      {resetTargetId === user.id && (
                        <tr>
                          <td colSpan={4} className="pb-3">
                            <form onSubmit={handleResetPassword} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5">
                              <KeyRound size={13} className="text-slate-400 shrink-0" />
                              <input
                                type="text"
                                placeholder={`为 ${user.username} 设置新密码（至少 10 位）`}
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                                minLength={10}
                                maxLength={128}
                                className="flex-1 min-w-0 text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none"
                                required
                              />
                              <button
                                type="submit"
                                disabled={userBusy}
                                className="shrink-0 px-3 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 disabled:opacity-50"
                              >
                                确认重置
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: INVITES GENERATOR */}
      {activeTab === 'invite' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-150 space-y-4 h-fit">
            <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">
              <Shield size={14} className="text-blue-500" />
              生成新邀请码
            </h3>

            <form onSubmit={handleGenerateInvite} className="space-y-3">
              <div className="space-y-0.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">邀请码口令 (推荐大写英文数字)</label>
                <input 
                  type="text" 
                  placeholder="例如: DISCOVER2026"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">最大使用次数</label>
                  <input 
                    type="number" 
                    min={1}
                    value={maxUses}
                    onChange={(e) => setMaxUses(parseInt(e.target.value) || 5)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-center"
                    required
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">失效截止日期</label>
                  <input 
                    type="date" 
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow hover:bg-blue-700"
              >
                生成邀请口令
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-150 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">
              <Users size={14} className="text-emerald-500" />
              存量邀请口令列表
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-extrabold">
                    <th className="py-2.5">邀请码</th>
                    <th className="py-2.5 text-center">限额/已用</th>
                    <th className="py-2.5">截止失效时间</th>
                    <th className="py-2.5 text-right">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                  {invites.map(item => {
                    const isExpired = new Date(item.expires_at) < new Date();
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-bold text-slate-800">{item.code}</td>
                        <td className="py-3 text-center">{item.max_uses} / {item.uses}</td>
                        <td className="py-3">{item.expires_at.substring(0, 10)}</td>
                        <td className="py-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            isExpired ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {isExpired ? '已失效' : '生效中'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-150 text-center space-y-2">
            <Database size={24} className="mx-auto text-blue-500" />
            <span className="text-[10px] font-bold text-slate-400 block uppercase">数据库大小</span>
            <p className="text-lg font-black text-slate-800">{(capacity.db_size / 1024).toFixed(1)} KB</p>
            <p className="text-[9px] text-slate-400">JSON文件行数及关联记录</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-150 text-center space-y-2">
            <HardDrive size={24} className="mx-auto text-emerald-500" />
            <span className="text-[10px] font-bold text-slate-400 block uppercase">媒体存储大小</span>
            <p className="text-lg font-black text-slate-800">{(capacity.uploads_size / (1024 * 1024)).toFixed(2)} MB</p>
            <p className="text-[9px] text-slate-400">已自动进行无损格式压缩</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-150 text-center space-y-2">
            <Users size={24} className="mx-auto text-indigo-500" />
            <span className="text-[10px] font-bold text-slate-400 block uppercase">已注册成员</span>
            <p className="text-lg font-black text-slate-800">{capacity.users_count} 位</p>
            <p className="text-[9px] text-slate-400">其中包含 {invites.reduce((sum, i) => sum + i.uses, 0)} 位受邀新用户</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-150 text-center space-y-2">
            <Server size={24} className="mx-auto text-pink-500" />
            <span className="text-[10px] font-bold text-slate-400 block uppercase">已沉淀地点/行程</span>
            <p className="text-lg font-black text-slate-800">{capacity.places_count} 地 / {capacity.trips_count} 条</p>
            <p className="text-[9px] text-slate-400">已建立完整的行前物品清单</p>
          </div>

          {/* Warning banner if approaching limits */}
          <div className="md:col-span-4 p-4 rounded-2xl border border-slate-150 bg-slate-50 flex flex-col sm:flex-row items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 space-y-1 text-center sm:text-left">
              <p className="text-xs font-bold text-slate-800">🚀 私有环境存储配额正常： 10 GB 限制中已用 0.01%</p>
              <p className="text-[10px] text-slate-400">
                本程序对照片上传内置了智能画布压缩引擎。每张上传的照片默认会被压缩在 300KB 左右以节约您的流量配额和空间开销。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export {};
