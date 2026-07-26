# AGENTS.md — 旅行足迹

> 使用中文与用户沟通。

## 事实与诊断原则

### 信息优先级

1. 实际代码、文件内容、日志、测试和可复现结果。
2. 用户明确确认的操作、环境、现象和业务规则。
3. 仓库文档、Issue 和历史记录。
4. 经验推测。
5. 汇报结果时需要使用技能（what/why/how/rsult）

不得用低优先级推测否定高优先级事实。

### 用户纠正

- 用户纠正后立即更新判断。
- 不重复已被否定且无新证据支持的假设。
- 对用户陈述存在疑问时，通过代码、日志、文件或测试验证，不直接反驳。
- 明确区分：**已确认事实、待验证信息、当前假设**。
- 不把常见原因表述为已确定根因。

### Bug 诊断

1. 整理已确认事实和已排除项。
2. 检查最直接相关的数据、代码路径和日志。
3. 按最短证据链逐项验证关键假设。
4. 假设被否定后立即停止该方向。
5. 根因未验证前，不宣称已经定位。
6. 无法验证时，明确缺少的证据。

禁止选择性解释证据、无依据断言数据被删除，或反复询问用户已经明确回答的问题。

## 项目概述

面向家庭及私有成员的旅行地点、行程、照片、攻略和清单管理应用。前后端位于同一仓库。

## 技术栈

- 前端：React 19、TypeScript、Vite 6、Tailwind CSS 4、lucide-react、motion
- 后端：Express 4 ESM、better-sqlite3、express-session、argon2、helmet
- 构建：Vite 客户端构建、esbuild 服务端构建
- 运行时：Node.js 22、npm 10+
- 地图：高德 JS API、Web Service API
- 数据库：SQLite WAL
- 测试：`node:test`、`node:assert`、tsx

## 核心目录

```
server.ts                    Express 装配、中间件和 API
src/server/                  服务端配置、认证和数据访问
src/server/db/sqliteStore.ts SQLite 数据访问层
src/components/              PC 端组件
src/components/mobile/       手机端组件
src/hooks/                   自定义 Hooks
src/utils/                   坐标、EXIF、上传等工具
src/types.ts                 领域类型
src/api.ts                   前端 API 层
src/App.tsx                  前端入口
migrations/                  SQL 迁移
scripts/                     构建、迁移、导入和验收脚本
tests/                       自动化测试
docs/                        长期文档和 UI 基线
.scratch/                    临时任务记录，不入库
data/、uploads/              运行数据，不入库
```

## 常用命令

| 用途       | 命令                      |
| ---------- | ------------------------- |
| 安装       | `npm install`             |
| 开发       | `npm run dev`             |
| 类型检查   | `npm run lint`            |
| 测试       | `npm test`                |
| 构建       | `npm run build`           |
| 生产启动   | `npm start`               |
| 生产验收   | `npm run test:production` |
| 数据迁移   | `npm run db:migrate`      |
| 旧数据导入 | `npm run db:import`       |

## 工作规则

### 修改前

- 阅读任务直接相关的代码、类型、测试和踩坑记录。
- 检查 `git status`，不得覆盖用户已有修改。
- 先确认根因和影响范围，再修改代码。
- 优先最小改动，不顺带重构无关模块。
- 不修改生成产物、数据库文件和用户上传文件。
- 不执行破坏性数据库操作。

### 修改后

- 运行与改动直接相关的测试。
- 默认运行：

```
npm run lint
npm test
```

- 涉及服务端入口、构建、环境配置或数据库时，额外运行：

```
npm run build
npm run test:production
```

- 报告修改内容、验证结果、未验证事项和剩余风险。
- 不得删除、跳过或弱化测试来使测试通过。

## 代码规范

- 仅使用 ESM，不使用 `require`。
- `@/` 映射到仓库根目录。
- 组件使用 PascalCase，工具文件使用 camelCase。
- 手机端组件放在 `src/components/mobile/`，使用 `Mobile` 前缀。
- 不引入新的状态管理库。
- 数据访问统一通过 `sqliteStore.ts`。
- `server.ts` 负责应用装配和路由挂载，复杂校验及业务逻辑应提取，避免继续膨胀。
- 未经专项任务，不进行大范围目录或架构重构。
- 没有必要时不新增或升级依赖。

## Git 规则

- 只有用户明确要求时才提交代码。
- 未经允许，不执行 `commit`、`push`、切换分支或重写历史。
- 使用中文 Git 提交 Skill。
- 提交信息使用中文，例如：

```
新增：……
修复：……
优化：……
重构：……
文档：……
测试：……
```

## 安全约束

- 不提交 `.env`、`data/`、`uploads/`、`local-tls/`。
- 高德 Web Service Key 仅在服务端使用。
- 密码使用 argon2id，不新增或回退到 SHA256、明文方案。
- 默认所有 `/api/*` 接口都需要 Session 认证。
- 仅明确列出的健康检查、登录和地图配置接口允许匿名访问，不得将 `/api/auth/*` 整体视为公开接口。
- 管理员接口必须使用 `requireAdmin`。
- 认证和资源授权必须分别检查。
- 普通用户只能访问其有权限的地点、行程、媒体和清单。
- 所有资源 ID 都必须校验归属和权限。
- PATCH 请求使用 Zod 白名单，不直接展开 `req.body`。
- SQL 必须参数化。
- 私有媒体只能通过授权 API 访问。
- 上传必须限制文件大小、数量、类型，并防止路径穿越。
- 日志不得记录密码、Session 和完整密钥。

## 领域模型

核心类型位于 `src/types.ts`：

- `User`
- `Place`
- `Trip / TripDay / TripItem`
- `Guide`
- `Checklist / ChecklistItem`
- `Media`

坐标系：

- GPS、EXIF：WGS-84
- 高德地图：GCJ-02
- 百度地图：BD-09

转换工具位于 `src/utils/coords.ts`。境外坐标不执行中国大陆偏移转换。

## 测试要求

- 服务端 API、权限、数据层、坐标转换和迁移变更必须增加或更新测试。
- Bug 修复优先增加可复现问题的回归测试。
- 纯视觉调整可不增加自动化测试，但必须验证 PC 和手机端。
- 修改数据层时确保 `sqliteStore.test.ts` 通过。
- 生产验收脚本使用临时独立数据库，不得污染正式数据。

## 数据库迁移

- 文件格式：`migrations/NNN_description.sql`。
- 编号递增，不修改已执行迁移。
- 新增表或字段必须创建迁移。
- 不手动修改正式数据库结构。
- `db.json` 仅作为旧数据来源，运行时不得重新读写。

## 环境变量

复制 `.env.example` 为 `.env`。

- `SESSION_SECRET`：生产环境必须设置，至少 32 个随机字符
- `AMAP_WEB_KEY`
- `AMAP_SECURITY_JSCODE`
- `AMAP_WEB_SERVICE_KEY`
- `APP_PORT`：默认 `3000`

## 关键约束与回归风险

### 构建与启动

- 服务端必须输出 ESM：`dist/server/index.mjs`。
- `src/server/start.ts` 必须在加载应用前设置 `NODE_ENV=production`。
- `better-sqlite3` 和 `argon2` 是原生模块，更换 Node 或平台后需重新安装。

### 地图与坐标

- WGS-84 坐标不能直接用于中国大陆高德地图。
- EXIF 坐标需转换为 GCJ-02 后展示和存储。
- 百度坐标需从 BD-09 转为 GCJ-02。
- PC 双击地图新增地点，手机端双击地图放大。
- 修改地图手势或标记事件时必须分别验证 PC 和手机端。

### 手机端

- 输入框字号不得低于 `16px`，避免 iOS 自动缩放。
- 底部浮层必须处理 `safe-area-inset-bottom`。
- 搜索结果、提示条和编辑表单不得互相遮挡。
- 手机端照片上传前会压缩，检查压缩过程是否影响 EXIF。

### 照片上传

- 上传入口包括 PC 地点详情、手机端照片页和照片画廊。
- 修改任一入口时，检查另外两个入口是否需要同步。
- 自动建点后应进入编辑态，允许用户微调 GPS 位置。
- 排查 GPS 丢失时，依次检查：
  1. 原始文件是否包含 EXIF GPS。
  2. 压缩前后 EXIF 是否一致。
  3. 前端实际上传的是原图还是重编码文件。
  4. `exifr` 解析是否成功。
  5. 服务端是否进行二次处理。

### 数据与前端状态

- 不重新启用备份、恢复、导出和旧 JSON 运行时存储。
- 所有写操作必须检查响应状态，失败时不得显示成功。
- 避免在循环中产生行程 N+1 请求。
- 地点封面优先使用 `cover_image`，否则回退到最新照片。
- PC 和手机端的封面回退逻辑必须一致。

## Issue 与文档

Issues 和 PRD 存放于 `.scratch/`，规则见：

```
docs/agents/issue-tracker.md
```

`.scratch/` 规则：

- 仅保存当前本地任务的临时记录。
- 文件名必须带日期前缀并标明任务状态。
- 长期有效的架构决策、验收标准和业务规则必须迁移至 `docs/`。
- 不得将仅存在于 `.scratch/` 的内容视为永久规范。

其他文档：

```
docs/agents/triage-labels.md
docs/agents/domain.md
```

实际代码、`package.json`、迁移和测试是当前行为的事实来源。文档与代码不一致时，应先确认差异；修改导致文档失效时，必须同步更新。
