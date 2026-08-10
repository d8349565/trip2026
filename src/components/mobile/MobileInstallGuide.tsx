import React, { useEffect, useState } from 'react';
import { X, Share, PlusSquare, Download, Maximize2 } from 'lucide-react';

/**
 * 移动端全屏体验引导：
 * - 已安装为 PWA（standalone / fullscreen）时不显示；
 * - iOS Safari：引导「分享 → 添加到主屏幕」，安装后即为全屏无浏览器 UI；
 * - Android Chrome：捕获 beforeinstallprompt，一键触发系统安装弹窗；
 * - 其它安卓浏览器：提示可使用页面内的全屏按钮。
 * 用户关闭后 7 天内不再提示（localStorage）。
 */

const DISMISS_KEY = 'tf-install-guide-dismissed-at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isInstalledDisplayMode(): boolean {
  return window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true;
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // 排除 iOS 上的 Chrome/Firefox/微信等（它们也不支持添加到主屏幕的全屏 PWA 之外的 Fullscreen API，但引导文案以 Safari 为准）
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|MicroMessenger|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function wasRecentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < DISMISS_TTL_MS;
}

export default function MobileInstallGuide() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios] = useState(isIosSafari);

  useEffect(() => {
    if (isInstalledDisplayMode() || wasRecentlyDismissed()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    // iOS 没有 beforeinstallprompt，延迟一点展示避免遮挡首屏
    const timer = window.setTimeout(() => {
      if (isIosSafari()) setVisible(true);
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  const triggerInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') {
      setVisible(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[45] animate-slide-up">
      <div className="rounded-2xl border border-blue-100 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Maximize2 size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold text-slate-800">全屏使用，体验更好</p>
            {ios ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[11px] leading-relaxed text-slate-500">
                点击浏览器底部
                <Share size={12} className="inline text-blue-600" />
                「分享」，然后选择
                <span className="inline-flex items-center gap-0.5 font-bold text-slate-700">
                  <PlusSquare size={12} className="text-blue-600" />
                  添加到主屏幕
                </span>
                ，即可像 App 一样全屏使用。
              </p>
            ) : installEvent ? (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                安装到主屏幕后可全屏使用，没有浏览器地址栏。
              </p>
            ) : (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                点击地图右侧的全屏按钮，或将本站添加到主屏幕，获得沉浸式体验。
              </p>
            )}
            {installEvent && (
              <button
                type="button"
                onClick={() => void triggerInstall()}
                className="mt-2 flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm active:scale-95"
              >
                <Download size={13} />
                立即安装到主屏幕
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="关闭全屏引导"
            onClick={dismiss}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
