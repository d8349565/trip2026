import { useEffect, useRef } from 'react';
import { BackLayerManager } from '../utils/backNavigation';

/**
 * 移动端返回键导航：
 * - `useBackNavigationManager` 在移动端启用全局 popstate 监听；
 * - `useBackLayer` 把某个开关型状态注册为一个返回层级，
 *   用户按系统返回键时逐层关闭，而不是直接退出页面。
 */
export function useBackNavigationManager(enabled: boolean): BackLayerManager {
  const managerRef = useRef<BackLayerManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new BackLayerManager(window.history);
  }
  const manager = managerRef.current;

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('popstate', manager.handlePopState);
    return () => {
      window.removeEventListener('popstate', manager.handlePopState);
      manager.clear();
    };
  }, [enabled, manager]);

  return manager;
}

/**
 * 将「打开/关闭」型状态注册为返回键层级。
 * isOpen 变为 true 时压入历史记录；关闭（UI 或系统返回）时自动出栈。
 */
export function useBackLayer(
  manager: BackLayerManager,
  enabled: boolean,
  key: string,
  isOpen: boolean,
  close: () => void,
) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!enabled || !isOpen) return;
    return manager.push({ key, close: () => closeRef.current() });
  }, [manager, enabled, key, isOpen]);
}
