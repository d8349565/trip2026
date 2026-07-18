# 旅行足迹

面向家庭和私有成员的旅行地点、行程、照片、攻略与清单管理应用。项目保留现有 React + TypeScript 双端 UI，服务端使用 Express，正式数据存储使用 SQLite。

## 环境要求

- Node.js 22
- npm 10+

## 本地开发

```bash
npm install
npm run dev
```

开发服务器默认监听 `http://127.0.0.1:3000`。开发模式可使用内置的本地 Session 密钥；不要把该默认值用于正式运行。

首次启动会创建 `data/travel-footprint.sqlite` 并执行 `migrations/` 中的数据库迁移。如果存在旧版 `db.json`，系统只会导入一次有效业务数据；SVG Demo 照片不会作为真实媒体导入。

已有数据库需要单独执行迁移时使用：

```bash
npm run db:migrate
```

## 地点录入与管理

登录后直接在地图上操作；PC 顶栏和手机端“＋”按钮会聚焦地图搜索框：

- 搜索地点：按关键词和城市查询真实高德 POI；选择结果后地图会显示可拖动标记，微调位置再保存。
- 地图选点：在高德地图空白处双击，系统读取真实坐标并反查地址；同样可拖动标记调整。
- 分享链接：点击搜索框右侧的链接按钮，粘贴高德或百度地图分享链接；百度 BD-09 坐标会转换为高德 GCJ-02。
- 地点管理：左键标记查看详情；PC 右键标记可编辑或删除。手机端通过详情及地图编辑入口管理。
- 地点概览：在地图内编辑表单录入亮点、路线、提示、安全、装备、补给和实用信息；未填写的内容不会生成模板数据。

高德配置放在本地 `.env`，不要提交真实 Key：

```env
AMAP_WEB_KEY=
AMAP_WEB_SERVICE_KEY=
AMAP_SECURITY_JSCODE=
```

## 本地生产构建

1. 复制 `.env.example` 为 `.env`。
2. 为 `SESSION_SECRET` 设置至少 32 个字符的随机值。
3. 执行：

```bash
npm run build
npm start
```

客户端产物位于 `dist/client`，Node ESM 服务端产物位于 `dist/server/index.mjs`。

## 检查命令

```bash
npm run lint
npm test
npm run build
npm run test:production
```

`test:production` 会在系统临时目录创建独立 SQLite 数据库，验证生产启动、登录、受保护 API 和基本 CRUD，然后自动清理。

## 数据说明

- SQLite 数据库和 WAL 文件保存在 `data/`，不会纳入 Git。
- `db.json` 仅作为一次性旧数据来源，不再参与运行时读写。
- 仓库不再包含预置地点、行程、照片、攻略或清单业务数据。
- 当前正式备份、恢复和全量导出功能已停用，后续会单独设计 SQLite 与媒体文件的一致性备份方案。
- 旧 Demo 密码会在首次成功登录时升级为 Argon2id；正式使用前仍应主动更换原密码。

完整实施状态见 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)。
