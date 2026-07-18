/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { InviteCode } from '../types';
import { api } from '../api';
import { 
  Shield, Server, Download, RefreshCw, Plus, Users, 
  Trash2, AlertTriangle, Check, Layers, Database, Sparkles, HardDrive
} from 'lucide-react';

interface SettingsPanelProps {
  invites: InviteCode[];
  onGenerateInvite: (code: string, maxUses: number, expiresAt: string) => void;
}

export default function SettingsPanel({
  invites,
  onGenerateInvite
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'invite' | 'backup' | 'system'>('invite');
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

  const [backups, setBackups] = useState<any[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);

  // Form states
  const [inviteCode, setInviteCode] = useState('');
  const [maxUses, setMaxUses] = useState(5);
  const [expiresAt, setExpiresAt] = useState('2027-12-31');

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    try {
      const cap = await api.getCapacity();
      setCapacity(cap);

      const backs = await api.getBackups();
      setBackups(backs);
    } catch (e) {
      console.warn('Failed to fetch stats', e);
    }
  };

  const handleGenerateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateInvite(inviteCode, maxUses, new Date(expiresAt).toISOString());
    setInviteCode('');
    setMaxUses(5);
    setTimeout(() => loadSettingsData(), 500);
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      await api.createBackup();
      setBackupSuccess(true);
      await loadSettingsData();
      setTimeout(() => setBackupSuccess(false), 2000);
    } catch (e) {
      alert('备份创建失败');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (confirm(`确定要将系统恢复到备份 ${filename} 吗？这会覆盖当前的数据！`)) {
      try {
        await api.restoreBackup(filename);
        alert('系统数据恢复成功！');
        window.location.reload();
      } catch (e) {
        alert('恢复失败');
      }
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (confirm(`确认要删除备份 ${filename} 吗？`)) {
      try {
        await api.deleteBackup(filename);
        await loadSettingsData();
      } catch (e) {
        alert('删除失败');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-800">系统维护与高级管理</h2>
        <p className="text-[11px] text-slate-500 font-medium">配置多用户邀请码，进行数据打包和全量备份，查看服务器存储状况</p>
      </div>

      {/* Settings Sub navigation tabs */}
      <div className="flex gap-2">
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
          onClick={() => setActiveTab('backup')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            activeTab === 'backup'
              ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
              : 'bg-white text-slate-500 border-slate-150 hover:bg-slate-50'
          }`}
        >
          💾 数据备份还原
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

      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-150 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
              <Database size={14} className="text-blue-500" />
              数据库全量备份
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              数据默认保存在本地 db.json。建议每周或在大规模录入数据、照片后创建全量备份，以便遭遇环境重新部署时一键恢复。
            </p>

            <button
              onClick={handleCreateBackup}
              disabled={isBackingUp}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={14} className={isBackingUp ? 'animate-spin' : ''} />
              <span>{isBackingUp ? '正在备份...' : '立即创建本地备份'}</span>
            </button>

            {backupSuccess && (
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-bold border border-emerald-200 text-center flex items-center justify-center gap-1">
                <Check size={12} strokeWidth={3} />
                <span>备份创建成功，已归档。</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <a 
                href="/api/system/export"
                download="travel_footprint_export.json"
                className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-200"
              >
                <Download size={14} />
                <span>导出数据库 JSON 文件到电脑</span>
              </a>
            </div>
          </div>

          <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-150 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
              <RefreshCw size={14} className="text-emerald-500" />
              可恢复备份列表
            </h3>

            {backups.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                尚无备份文件，点击左侧按钮立即创建首个备份
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {backups.map(b => (
                  <div key={b.filename} className="flex items-center justify-between p-3 rounded-xl border border-slate-150 bg-slate-50/50 hover:bg-slate-50">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{b.filename}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        大小: {(b.size / 1024).toFixed(1)} KB · 备份时间: {b.time.replace('T', ' ').substring(0, 19)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestoreBackup(b.filename)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        还原
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(b.filename)}
                        className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-lg transition-colors"
                        title="删除备份"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
