import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackLayerManager } from '../src/utils/backNavigation';

function createFakeHistory() {
  const states: unknown[] = [];
  return {
    states,
    pushState(state: unknown) {
      states.push(state);
    },
    back() {
      states.pop();
    },
  };
}

test('系统返回按键逐层关闭弹层，不退出页面', () => {
  const history = createFakeHistory();
  const manager = new BackLayerManager(history);
  const closed: string[] = [];

  manager.push({ key: 'tab', close: () => closed.push('tab') });
  manager.push({ key: 'detail', close: () => closed.push('detail') });

  assert.equal(history.states.length, 2);
  assert.equal(manager.depth, 2);

  // 第一次返回：关闭最上层 detail
  manager.handlePopState();
  assert.deepEqual(closed, ['detail']);
  assert.equal(manager.depth, 1);

  // 第二次返回：关闭 tab
  manager.handlePopState();
  assert.deepEqual(closed, ['detail', 'tab']);
  assert.equal(manager.depth, 0);
});

test('UI 主动关闭弹层时回退消费对应历史记录', () => {
  const history = createFakeHistory();
  const manager = new BackLayerManager(history);
  const closed: string[] = [];

  manager.push({ key: 'sheet', close: () => closed.push('sheet') });
  const releaseDetail = manager.push({ key: 'detail', close: () => closed.push('detail') });

  // UI 按钮关闭 detail：应触发 history.back() 消费其记录，且不调用 close
  releaseDetail();
  assert.deepEqual(closed, []);
  assert.equal(manager.depth, 1);
  assert.equal(history.states.length, 1);

  // 随后的 popstate（history.back 触发）应被识别为程序化返回，不再关闭其它层
  manager.handlePopState();
  assert.deepEqual(closed, []);
  assert.equal(manager.depth, 1);
});

test('release 幂等且已被系统返回消费的条目不再触发 history.back', () => {
  const history = createFakeHistory();
  const manager = new BackLayerManager(history);

  const release = manager.push({ key: 'only', close: () => {} });
  manager.handlePopState(); // 系统返回消费
  assert.equal(manager.depth, 0);

  release(); // 组件随后卸载调用 release
  release(); // 幂等
  assert.equal(history.states.length, 1); // 只 push 过一次；popstate 时栈非空，不补哨兵
});

test('栈空时系统返回补哨兵，用户留在应用内不退出页面', () => {
  const history = createFakeHistory();
  const manager = new BackLayerManager(history);
  manager.activate(); // 启用时压入栈底哨兵
  assert.equal(history.states.length, 1);

  // 用户在根页面连按两次返回：第一次落到哨兵（栈空→补新哨兵），第二次同样被兜住
  manager.handlePopState();
  assert.equal(history.states.length, 2);
  manager.handlePopState();
  assert.equal(history.states.length, 3);
  assert.deepEqual(history.states.at(-1), { tfBase: true });
});
