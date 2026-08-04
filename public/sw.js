/**
 * PWA Service Worker。
 * 仅用于满足浏览器「可安装」条件：fetch 事件不调用 respondWith，
 * 所有请求走浏览器默认网络行为，不缓存任何响应。
 * 本应用为私有实时应用（登录态、照片、行程数据都要求最新），
 * 离线缓存弊大于利；如未来确需离线能力，在此扩展缓存策略。
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', () => {});
