/**
 * 移动端返回键层级栈管理（框架无关，可单测）。
 *
 * 问题：移动端网页里打开详情/弹层后，用户按系统返回键会直接退出页面。
 * 方案：打开弹层时 pushState 压入一条历史记录；系统返回（popstate）时
 * 关闭栈顶弹层而不是离开页面；弹层被 UI 按钮关闭时反向 history.back()
 * 消费对应记录，保持栈与浏览器历史同步。
 */

export interface BackLayerEntry {
  key: string;
  close: () => void;
}

interface HistoryLike {
  pushState: (state: unknown, unused: string) => void;
  back: () => void;
}

export class BackLayerManager {
  private stack: BackLayerEntry[] = [];
  private expectProgrammaticBack = false;
  private readonly listeners = new Set<(event: unknown) => void>();

  constructor(private readonly historyImpl: HistoryLike) {}

  /** 激活时压入栈底哨兵（移动端启用返回键导航时调用一次）。 */
  activate() {
    this.pushSentinel();
  }

  /** 模拟/接收浏览器 popstate（EventTarget 由 React 绑定层注入）。 */
  handlePopState = () => {
    if (this.expectProgrammaticBack) {
      this.expectProgrammaticBack = false;
      return;
    }
    const entry = this.stack.pop();
    if (entry) {
      entry.close();
      return;
    }
    // 栈已空：补一个哨兵状态，把用户留在应用内。
    // 否则浏览器会继续后退——新标签页打开的场景退出去就是白屏，
    // iOS 左缘右滑手势很容易误触发。
    this.pushSentinel();
  };

  /** 栈底哨兵：保证栈空时系统返回只是落在哨兵上，不会退出页面。 */
  private pushSentinel() {
    try {
      this.historyImpl.pushState({ tfBase: true }, '');
    } catch {
      // pushState 不可用的环境直接跳过
    }
  }

  /** 打开弹层时入栈；返回的函数在弹层关闭/卸载时调用以出栈。 */
  push(entry: BackLayerEntry): () => void {
    this.stack.push(entry);
    try {
      this.historyImpl.pushState({ tfLayer: entry.key }, '');
    } catch {
      // 极少数环境（如 file://）pushState 不可用：退化为仅栈内管理
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release(entry);
    };
  }

  private release(entry: BackLayerEntry) {
    const index = this.stack.indexOf(entry);
    if (index === -1) return; // 已被系统返回消费，无需处理
    this.stack.splice(index, 1);
    // UI 主动关闭：回退消费之前 push 的历史记录
    this.expectProgrammaticBack = true;
    try {
      this.historyImpl.back();
    } catch {
      this.expectProgrammaticBack = false;
    }
  }

  get depth(): number {
    return this.stack.length;
  }

  clear() {
    this.stack = [];
    this.expectProgrammaticBack = false;
  }
}
