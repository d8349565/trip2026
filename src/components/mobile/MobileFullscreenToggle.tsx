import React, { useEffect, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';

/**
 * 浏览器内全屏开关（进入/退出 Fullscreen API）。
 * - 仅在浏览器支持 Fullscreen API 时显示（iPhone Safari 不支持，自动隐藏）；
 * - 已安装为 PWA（standalone / fullscreen 显示模式）时浏览器 UI 已不存在，无需显示。
 */
function isInstalledDisplayMode(): boolean {
  return window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true;
}

export default function MobileFullscreenToggle() {
  const [supported, setSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setSupported(document.fullscreenEnabled && !isInstalledDisplayMode());
    const syncState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncState);
    return () => document.removeEventListener('fullscreenchange', syncState);
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <button
      type="button"
      id="m_btn_fullscreen"
      onClick={toggle}
      aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
      title={isFullscreen ? '退出全屏' : '进入全屏'}
      className="absolute right-3 top-44 z-30 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/95 text-slate-500 shadow-lg backdrop-blur-md outline-none transition-all duration-200 hover:bg-slate-50 active:scale-95"
    >
      {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
    </button>
  );
}
