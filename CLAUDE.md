# ShopAgent — Vertical E-Commerce Listing Agent

> **项目代号**：shopagent  
> **版本**：v0.1.0  
> **PRD 文档**：`E:\workspace\projects\shopagent-PRD.md`  
> **使用说明书**：`docs/USER-GUIDE.md`  
> **开发手册**：`docs/DEVELOPER.md`  
> **基于**：Fork from Open Design + ListingGen methodology injection  

---

## ⚠️ 开发铁律（所有 Agent 必读，违反即打回）

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1. 回头看 PRD：任何歧义/遗漏/不确定 → 回 PRD 确认           │
│                                                              │
│  2. 回头看原项目：实现前必须先 Reads 原项目参考代码              │
│     - Open Design: E:\workspace\projects\open-design          │
│     - ListingGen: E:\workspace\projects\商海蟹Coding\         │
│       05-产品项目\listinggen                                  │
│                                                              │
│  3. SKILL 原子性：方法论文件（skills/listing/*.md）一个标点不能改│
│                                                              │
│  4. 文件级隔离：每个 Agent 只写自己负责的文件                    │
│                                                              │
│  5. 契约先行：contracts/ 类型定义是唯一真相源                   │
│                                                              │
│  6. 设计以 tokens.css 为准：颜色/字体/动效全部走 CSS 变量       │
│                                                              │
│  7. 改动前看上下文：用 Read 看目标文件前后 50 行                │
│                                                              │
│  8. 改动后自检：写完立即跑 typecheck + 对照 PRD 验收标准         │
│                                                              │
│  9. 二次复查：每个大动作完成后必须执行第二次全面检查：            │
│     - 打开每个关键文件逐行确认（不做 grep 猜测）                  │
│     - 对照 PRD 验收标准逐条打勾                                  │
│     - 运行 typecheck / guard / test 确认零错误                  │
│     - 检查全局残留（grep 旧命名空间/旧引用）                      │
│     - 第一次审计容易漏的：Dockerfile、.env、deploy scripts、     │
│       CI/CD 配置、CLAUDE.md 引用的路径                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 项目概述

ShopAgent 是一个本地优先、AI 驱动的电商运营垂直 Agent 工具。输入产品信息 + 白底图 → 生成全套 Listing 物料（标题、主图 prompt、详情图 prompt、视频脚本、自检清单），通过 **CLI (`od listing`)** 和 **Web UI** 双轨道交付。

### 解决的核心问题

| 痛点 | ShopAgent 解法 |
|------|---------------|
| 多个软件来回切换 | 一个工具完成 listing 全流程 |
| AI 生成内容不可控 | SKILL 原文驱动，方法论是独立资产 |
| 不同电商平台规则不同 | 多 SKILL 文件支持（Shopee → Amazon 可扩展） |
| 没有 Agent 调度中心 | 复用 OD 的 23 个 Agent 适配器 |

---

## 目录结构

```
shopagent/
├── apps/
│   ├── daemon/          ← Express 守护进程 + Agent 调度 + CLI
│   │   └── src/
│   │       ├── listing/         ← ★ 新增：listing 核心模块
│   │       │   ├── skill-loader.ts   (M2)
│   │       │   ├── tag-parser.ts     (M3)
│   │       │   ├── listing-routes.ts (M4)
│   │       │   ├── listing-generate.ts (M5)
│   │       │   ├── listing-images.ts (M6)
│   │       │   ├── cli-listing.ts    (M7)
│   │       │   └── listing-db.ts     (M8)
│   │       ├── server.ts      ← Express app
│   │       ├── runs.ts        ← Run 生命周期
│   │       ├── agents.ts      ← Agent 检测/启动
│   │       ├── cli.ts         ← CLI 入口（扩展 od listing 子命令）
│   │       ├── skills.ts      ← Skill 注册
│   │       ├── db.ts          ← SQLite 实例
│   │       └── runtimes/      ← 23 Agent 适配器
│   └── web/            ← Next.js 16 Web UI
│       └── src/
│           ├── app/listing/       ← ★ 新增：Listing 工作台页面
│           ├── components/listing/ ← ★ 新增：listing UI 组件
│           ├── hooks/useListingGeneration.ts ← ★ 新增
│           ├── styles/            ← tokens.css + base.css + primitives.css
│           └── providers/daemon.ts ← daemon HTTP client
├── packages/
│   ├── contracts/       ← 共享 DTO（★ 新增 listing/）
│   ├── components/      ← 共享 UI primitives
│   ├── platform/        ← OS 原语
│   └── sidecar-proto/   ← IPC 协议
├── skills/
│   └── listing/         ← ★ 方法论文件（从 ListingGen 迁移）
├── deploy/
│   ├── Dockerfile
│   └── docker-compose.yml
└── package.json
```

---

## 核心参考文件

### 原项目（回头看时必须对照）
```
Open Design 原项目：E:\workspace\projects\open-design
ListingGen 原项目：E:\workspace\projects\商海蟹Coding\05-产品项目\listinggen
```

### 关键源码映射

| 功能 | ShopAgent 目标文件 | 参考原项目文件 |
|------|-------------------|---------------|
| Agent 调度 | `apps/daemon/src/runs.ts` | OD `apps/daemon/src/runs.ts` |
| DeepSeek 适配 | `apps/daemon/src/runtimes/defs/deepseek.ts` | OD `apps/daemon/src/runtimes/defs/deepseek.ts` |
| CLI 注册 | `apps/daemon/src/cli.ts` | OD `apps/daemon/src/cli.ts` |
| Skill 加载 | `apps/daemon/src/skills.ts` | OD `apps/daemon/src/skills.ts` |
| Prompt 组装 | `apps/daemon/src/listing/skill-loader.ts` | ListingGen `src/lib/skill-parser.ts` + `prompt-config.ts` |
| TAG 解析 | `apps/daemon/src/listing/tag-parser.ts` | ListingGen `src/app/page.tsx` (解析逻辑) |
| 三模型生图 | `apps/daemon/src/listing/listing-images.ts` | ListingGen `src/lib/apimart.ts` |
| 状态管理 | `apps/web/src/hooks/useListingGeneration.ts` | ListingGen `src/hooks/use-generation.ts` |
| 设计 tokens | `apps/web/src/styles/tokens.css` | OD `apps/web/src/styles/tokens.css` |

---

## 设计系统速查

### 品牌色（暖陶土橙）
```
--accent: #c96442    ← 主 CTA 按钮
--accent-hover: #b45a3b
--accent-tint: #fbeee5  ← 加载背景
```

### 表面色（暖灰纸质感）
```
--bg-app: #faf9f7     ← 页面底色
--bg-panel: #fdfcfa   ← 卡片底色
```

### 字体
```
--sans: Inter / system-ui      ← UI 正文
--mono: JetBrains Mono / ui-monospace ← 代码/prompt 编辑
```

### 动效
```
缓出函数：cubic-bezier(0.23, 1, 0.32, 1)
入场 200ms / 出场 140ms
严禁 ease-in / scale(0)
```

### 选中态
```
--selected: #2563eb (蓝色，与橙色 CTA 不冲突)
```

---

## 质量门禁流程

```
每个 Agent 完成后：

  1. 自查 → 逐条检查 PRD 任务卡中的"自查清单"
  2. 报告 → 向主 Agent 汇报自查结果

主 Agent 审核：

  3. 契约检查 → 与 M0 contracts 类型一致？
  4. 回头看原项目 → 对照 OD/ListingGen 原代码确认
  5. 设计检查 → 颜色/字体全部 CSS 变量？
  6. 边界检查 → 空输入/超时/API 错误处理？
  7. PRD 对齐 → 实际输出与验收标准一致？

  任一不通过 → 打回修正 → 重新自查 → 重新审核
```

---

## 常用命令

```bash
# 安装
pnpm install

# 类型检查（每次改动后必跑）
pnpm typecheck

# 代码规范
pnpm guard

# 本地开发
pnpm tools-dev run web --daemon-port 17456 --web-port 17573

# Daemon 构建
pnpm --filter @shopagent/daemon build

# Web 构建
pnpm --filter @shopagent/web build

# Docker 构建
docker build -f deploy/Dockerfile -t shopagent:latest .

# Docker 运行
docker compose -f deploy/docker-compose.yml up -d

# 验证
curl http://localhost:7456/api/health

# CLI 测试
node apps/daemon/dist/cli.js listing skills --json
node apps/daemon/dist/cli.js listing generate --skill shopee-listing-v3 --product-name "Test" --keywords "test" --market MY --json
```

---

## 16 模块速查

| ID | 文件 | Agent | 描述 |
|----|------|-------|------|
| M0 | `packages/contracts/src/listing/types.ts` | A | 共享 DTO 类型 |
| M1 | `skills/listing/shopee-listing-v3.md` | B | SKILL 方法论 |
| M2 | `apps/daemon/src/listing/skill-loader.ts` | C | Prompt 组装 |
| M3 | `apps/daemon/src/listing/tag-parser.ts` | D | TAG 解析器 |
| M4 | `apps/daemon/src/listing/listing-routes.ts` | E | HTTP API |
| M5 | `apps/daemon/src/listing/listing-generate.ts` | E | LLM 调度 |
| M6 | `apps/daemon/src/listing/listing-images.ts` | F | 多模型生图 |
| M7 | `apps/daemon/src/listing/cli-listing.ts` | G | CLI 子命令 |
| M8 | `apps/daemon/src/listing/listing-db.ts` | G | SQLite |
| M9 | `apps/web/src/app/listing/page.tsx` + ListingWorkbench | H | 页面布局 |
| M10 | `apps/web/src/components/listing/InputPanel.tsx` | H | 输入面板 |
| M11 | `apps/web/src/components/listing/OutputPanel.tsx` | I | 输出面板 |
| M12 | `apps/web/src/components/listing/ImageCard.tsx` | I | 图片卡片 |
| M13 | `apps/web/src/hooks/useListingGeneration.ts` | J | 状态管理 |
| M14 | `apps/web/src/components/listing/ApiKeySettings.tsx` | J | API 配置 |
| M15 | `deploy/Dockerfile` | K | Docker 构建 |
| M16 | `deploy/docker-compose.yml` | L | Docker 部署 |

---

## 目录级 Agent 指引

详见 PRD 文档 `E:\workspace\projects\shopagent-PRD.md`：
- §3 架构设计
- §4 UI 布局线框图
- §5 设计系统规范
- §6 模块详细规格
- §6B 错误处理矩阵
- §8 多 Agent 并行任务卡
- §12 Phase 0 初始化清单

---

## 开发流程

1. **Phase 0**：主 Agent 执行项目初始化（Fork OD → 裁剪 → 改名）
2. **Phase 1**：4 Agent 并行（M0/M1/M2/M3）
3. **Phase 2**：3 Agent 并行（M4-M8）
4. **Phase 3**：3 Agent 并行（M9-M14）
5. **Phase 4**：2 Agent 并行（M15/M16）

---

## 踩坑记录与经验沉淀

### 1. 品牌重命名陷阱

**问题**：将 "Open Design" → "Open Yourself" 时，只能改**用户可见的显示文本**，不能改内部标识符。

**正确做法**：
- ✅ 改：i18n 翻译 key、页面标题 (`layout.tsx` metadata)、组件中的硬编码文本、HTTP 响应头 `X-Title`
- ✅ 改：HomeHero 品牌名、空白状态提示、错误消息中的产品名
- ❌ 不改：`@open-design/` npm 包名、`open-design.json` 文件名、`open-design/plugin-id` 插件命名空间前缀
- ❌ 不改：代码注释中的项目名、GitHub 仓库引用 (`nexu-io/open-design`)
- ❌ 不改：`OFFICIAL_PLUGIN_SOURCE_REPO`、`OFFICIAL_MARKETPLACE_ID` 等常量

**影响范围**：i18n 文件 (18 个 locale)、daemon `server.ts`、`chat-routes.ts`、`claude-diagnostics.ts`、`artifacts-cli.ts`、web 组件 (`HomeHero`、`HomeView`、`AvatarMenu`、`AssistantMessage`、`api-attachment-context` 等)

**关键教训**：用 `grep -rn "Open Design"` 全局搜索后，**逐个判断**是否应该改。标识符和命名空间绝对不能动。

### 2. 插件系统依赖

**问题**：ShopAgent fork 缺少 `plugins/_official/` 目录（Open Design 原版有 402 个内置插件），导致：
- 插件市场空白
- Design 模式发送失败（需要 `od-default` 默认场景插件）
- "Bundled scenario not installed" 错误

**修复**：
```bash
cp -a "E:/workspace/projects/open-design/plugins/_official" "E:/workspace/projects/shopagent/plugins/_official"
```

**验证**：`/api/plugins` 返回 402 个插件表示成功。

**插件注册脚本**（如果 daemon 启动时未自动注册）：
```bash
cd apps/daemon && node --input-type=module -e "
import { registerBundledPlugins } from './dist/plugins/bundled.js';
import Database from 'better-sqlite3';
import path from 'path';
const db = new Database(path.resolve('../../', '.od/app.sqlite'));
await registerBundledPlugins({
  db,
  bundledRoot: path.resolve('../../', 'plugins/_official'),
  marketplaceProvenance: {
    sourceMarketplaceId: 'official',
    marketplaceTrust: 'official',
    entryNamePrefix: 'open-design',
  },
});
console.log('Plugins registered');
"
```

### 3. Design 模式 vs Ask 模式

**Design 模式**需要本地 Agent CLI（如 Claude Code）才能工作。Design 模式 spawn 本地进程来创建/修改文件。

**启用条件**：
1. 至少一个 Agent CLI 已安装并可用（运行 `claude --version` 验证）
2. Agent 已认证（Claude Code 需要 OAuth 登录或 API Key）
3. 在 UI 中选择该 Agent（Agent 选择器）
4. 插件系统已加载（`od-default` 等场景插件必须可用）
5. 切换到 Design 模式（不是 Ask 模式）

**Ask 模式**可直接对话，不需要 Agent CLI。

**当前可用 Agent**：`claude`（通过 DeepSeek Anthropic API 中转）、`codex`、`hermes`

### 4. i18n 全局审计

**问题**：部分组件硬编码英文文本，切换语言后不更新。

**已修复的核心组件**：
- `TasksView.tsx` — 头部、指标、按钮、筛选标签、空状态、运行历史
- `DesignSystemsTab.tsx` — 标签分类、筛选、创建按钮
- `HomeHero.tsx` — 品牌名
- `EntryNavRail.tsx` — 导航按钮标签
- `EntryShell.tsx` — 隐藏 GitHub/Discord/Help 按钮

**新增 i18n key 前缀**：`tasksView.*`、`ds.*`、`homeHero.*`

**检查方法**：`grep -L "useT\|useI18n" apps/web/src/components/*.tsx | while read f; do echo "$(basename $f)"; done`

### 5. 导航体系架构

**左侧导航栏** (`EntryNavRail`) — 仅显示核心入口：
```
[+] 新建项目 | [📋] Listing 工作台 | [🏠] 主页 | [📁] 项目 | [📋] 自动化 | [🧩] 设计体系 | [⊞] 插件 | [🔗] 集成
```

**Listing 工作台顶部导航** — 方法论和资源库入口：
```
[← 主页] 📋 Listing 工作台 | 📖 方法论 | 📚 资源库 | ⚙
```

**关键组件映射**：
- 左侧导航 → `EntryNavRail.tsx`
- 顶部标签栏 → `WorkspaceTabsBar.tsx`
- 标签页路由 → `tabFromRoute()` / `routeForTab()` / `displayTabFor()`

### 6. 方法论内容迁移

**问题**：ListingGen 的方法论文档（6 章）未被迁移。

**修复**：
1. 复制 `public/methodology/` 到 ShopAgent
2. MD → HTML 转换脚本：`scripts/convert-methodology.mjs`
3. Mermaid 流程图渲染：安装 `mermaid` 包，`<pre class="mermaid">` + `mermaid.run()`
4. 路由注册：`router.ts` → `App.tsx` → 方法论页面组件

### 7. Listing 工作台数据流

**关键修复**：
- 图片状态同步：`updateImage` → 同时更新 `output` state（确保 ImageCard UI 实时更新）
- 图生图参考图：`productImageRef` → `enqueue` → `generateImageDirect(referenceImage)`
- APIMart 默认值对齐：`ApiKeySettings.tsx` + `listing-routes.ts` 统一使用 `.ai/v1`
- SSE 解析：`useListingGeneration.ts` 实现 `processSseEvents` + `applyImageToOutput`

### 8. Listing 集成踩坑（2026-06-10）

#### 8.1 Refly 全栈 mock 不可行
**坑**：Refly 有 176 个 API 端点，canvas/chat/skill 深度依赖 Go API 后端。试图 mock API 来替代完整后端 → 无尽补丁。
**教训**：全栈应用不能只跑前端 mock。直接用完整部署版，ShopAgent 只做导航入口。
**方案**：`window.open('http://47.85.48.19:5700/workspace', '_blank')`

#### 8.2 免登 cookie 同源问题
**坑**：`localhost:5173` ≠ `127.0.0.1:17456`，浏览器视为跨域，cookie 写不到同名域。
**教训**：rsbuild proxy 代理 `/api/refly` → daemon，`.env` 用相对路径 `VITE_API_URL=/api/refly`

#### 8.3 生图轮询时间不足
**坑**：Gemini 默认 20次(60s)轮询，实际可能 124s → 图片"生成失败"但后台已生成。
**教训**：轮询上限 20→60次(180s)。ListingGen 原版多次实测经验。

#### 8.4 Provider test-connection 响应格式
**坑**：返回 `{ success: true }`，Refly 检查 `{ status: 'success' }` → 字段名不匹配。
**教训**：mock 任何 API 前必须读 `services.gen.ts` + `types.gen.ts`。OpenAPI schema 是唯一真相源。

#### 8.5 Provider API key 查找
**坑**：Refly 的 test-connection 只传 `{ providerId }` 不传 `apiKey`。后端须自己查存储。
**教训**：查看 `TestProviderConnectionRequest` 类型定义。

#### 8.6 正则表达式 `//` 注释陷阱
**坑**：`.replace(//+$/, '')` → TypeScript 把 `//` 当行注释。
**教训**：TS 文件写正则必须转义：`.replace(/\/+$/, '')`

#### 8.7 代码碎片化打补丁
**坑**：用 `node -e` / `sed` 多次增量修改 → 语法错误、重复路由、作用域问题。
**教训**：用 Write 工具一次性重写完整文件。

#### 8.8 数据流闭环
**坑**：Provider CRUD 的 create→list 不联动。
**教训**：每个"创建"都要对应"列表"能返回、"查询"能找到、"删除"后不存在。

#### 8.9 前端组件作用域
**坑**：`copiedIdx` 定义在父组件 `OutputPanel`，被独立子组件 `TitleBlock` 引用 → ReferenceError。
**教训**：独立组件需要自己的 state。不要跨组件共享 useState。

#### 8.10 Next.js 代理 body 限制
**坑**：图片 base64 上传 `PayloadTooLargeError`。
**教训**：`express.json({ limit: '16mb' })` + `serverRuntimeConfig: { bodyParser: { sizeLimit: "16mb" } }`

#### 8.11 直接复用原版代码
**坑**：从零重写 ListingGen 的 ImageCard/OutputPanel/queue → 功能覆盖率不到 50%。
**教训**：原版成品代码直接复刻，不做二次开发。

#### 8.12 资源库迁移陷阱
**坑**：localStorage → SQLite 迁移，ResourceLibrary 同步 API 没改异步 → 空白。
**教训**：存储层迁移必须全链路同步：API → 前端 → 调用方。

#### 8.13 关键词库语言分类
**坑**：导入 JSON 没传 `language` 参数，默认 'en'。
**教训**：多语言功能每个 API 调用都要传 `language`，UI 选择器 → 全局同步。

### 9. 阿里云部署踩坑（2026-06-10）

#### 9.1 生产构建 vs 开发模式差异
**坑**：本地 `pnpm tools-dev run web` 跑 dev mode 正常，服务器 `next build` 大量类型错误。
**原因**：dev mode 采用 Turbopack 宽松检查，`next build` 严格执行 TypeScript 类型检查。
**教训**：提交前必须在本地跑一次 `pnpm --filter @open-design/web build` 做预检。未通过不提交。

#### 9.2 typescript 类型定义缺失
**坑**：`queued`、`coverStatus`、`defaultCategory` 等新加字段未同步更新 contracts 类型定义，本地不报错，生产构建失败。
**教训**：所有新增字段必须在 `packages/contracts/src/listing/types.ts` 同步更新。构建前跑 `pnpm typecheck`。

#### 9.3 Alibaba Cloud Linux 4 的 Node 版本陷阱
**坑**：`dnf install nodejs` 只能装到 22，没有 24。GitHub 连不上无法用 nvm。
**教训**：直接下载 Node 24 二进制包：`wget https://nodejs.org/dist/v24.13.0/node-v24.13.0-linux-x64.tar.xz` → 解压到 `/usr/local/`。

#### 9.4 OD_BIND_HOST 需要 API Token
**坑**：`OD_BIND_HOST=0.0.0.0` 时 daemon 要求必须设 `OD_API_TOKEN`，否则直接抛错退出。
**教训**：systemd service 必须配置 `Environment=OD_API_TOKEN=xxx`。

#### 9.5 better-sqlite3 编译问题
**坑**：服务器上 `better-sqlite3` 需要 `gcc gcc-c++ make python3` 编译工具。Node 版本变更后需要 `pnpm rebuild better-sqlite3`。
**教训**：部署前 `dnf install -y gcc gcc-c++ make python3`，遇到 `ERR_DLOPEN_FAILED` 时 `pnpm rebuild`。

#### 9.6 Next.js 16 废弃配置项
**坑**：`serverRuntimeConfig` 在 Next.js 16 已废弃，生产构建报错。
**教训**：Next.js 16 不再支持 `serverRuntimeConfig`，body 大小限制改用其他方式。

#### 9.7 阿里云安全组端口未放行
**坑**：服务本地 `curl localhost:7456` 通，外网访问不通。FirewallD 未运行。
**教训**：阿里云 ECS 需要在控制台 **安全组 → 入方向** 手动添加端口规则。

#### 9.8 服务器 2G 内存不够构建
**坑**：`next build` OOM（SIGABRT）。
**教训**：添加 swap（`dd + mkswap + swapon`），限制 Node 内存 `NODE_OPTIONS="--max-old-space-size=2048"`。

#### 9.9 GitHub 国内连不上
**坑**：服务器 `git clone` 和 `nvm install` 连 GitHub 失败。
**教训**：项目设置为 Public 可免认证。关键依赖提前下载二进制包。

#### 9.10 部署命令格式陷阱
**坑**：heredoc（`<< 'EOF'`）在终端直接粘贴可能不生效，停留在 `>` 提示符。
**教训**：给用户提供单行命令或 `printf` 格式的配置生成命令。

### 10. 常用调试命令

```bash
# 服务管理
pnpm tools-dev run web --daemon-port 17456 --web-port 17573

# API 测试
curl http://127.0.0.1:17456/api/health
curl http://127.0.0.1:17456/api/agents
curl http://127.0.0.1:17456/api/plugins
curl http://127.0.0.1:17456/api/listing/skills

# 类型检查
pnpm --filter @open-design/web typecheck
pnpm --filter @open-design/daemon build

# Daemon 日志
cat .tmp/tools-dev/default/logs/daemon/latest.log
```

---

## 文件速查地图

### 要看什么文件

| 场景 | 文件 |
|------|------|
| 修改页面标题/品牌名 | `apps/web/app/layout.tsx` + `apps/web/src/i18n/locales/zh-CN.ts` (`app.brand`) |
| 修改左侧导航栏 | `apps/web/src/components/EntryNavRail.tsx` |
| 修改顶部标签页 | `apps/web/src/components/WorkspaceTabsBar.tsx` |
| 修改主页 Hero | `apps/web/src/components/HomeHero.tsx` + `HomeView.tsx` |
| 添加新页面路由 | `apps/web/src/router.ts` → `App.tsx` |
| 添加 i18n 翻译 | `apps/web/src/i18n/types.ts` → `locales/zh-CN.ts` + `en.ts` |
| Listing 文案生成 | `apps/web/app/listing/page.tsx` + `apps/daemon/src/listing/listing-generate.ts` |
| Listing 生图 | `apps/daemon/src/listing/listing-images.ts` + `page.tsx` (processQueue) |
| 方法论内容 | `apps/web/app/methodology/page.tsx` + `public/methodology/` |
| 资源库管理 | `apps/web/src/components/listing/ResourceLibrary.tsx` |
| SKILL 方法论 | `skills/listing/shopee-listing-v3.md` + `prompt-config.ts` |
| 设计系统 tokens | `apps/web/src/styles/tokens.css` (颜色/字体/阴影/圆角 CSS 变量) |
| 插件系统 | `apps/daemon/src/plugins/` + `plugins/_official/` |
| Agent 配置 | `apps/daemon/src/runtimes/defs/` + `agents.ts` |
| daemon 启动流程 | `apps/daemon/src/server.ts` (startServer 函数) |
| 数据库表结构 | `apps/daemon/src/db.ts` + `plugins/persistence.ts` |
| API 契约类型 | `packages/contracts/src/` |

### 改动前必须检查的关联文件

```
修改品牌名 → 影响 18 个 locale 文件 + HomeHero + layout.tsx + daemon 5 个文件
修改导航 → 影响 EntryNavRail + WorkspaceTabsBar + EntryShell + router
添加路由 → 影响 router.ts → App.tsx → WorkspaceTabsBar (tabFromRoute/routeForTab/displayTabFor)
修改 i18n  → 影响 types.ts → zh-CN.ts + en.ts (共 18 个 locale)
修改 daemon → 必须先 pnpm build daemon，再重启
修改插件 → 复制后需重新注册 (见下方脚本)
```

---

## ⚠️ 待解决问题

### P0 — 阻塞功能

| 问题 | 现象 | 方向 |
|------|------|------|
| **弹窗下拉菜单被底部内容遮挡** | 新建项目弹窗中设计体系选择器的下拉菜单与下方 Target platforms 等内容重叠 | Portal + position:fixed |

### P1 — 功能缺失

| 问题 | 现象 | 方向 |
|------|------|------|
| **daemon 启动未自动注册插件** | 每次重启后 `/api/plugins` 返回空 | 排查 `startServer` 中的 try-catch |
| **CLI export 未完整实现** | `od listing export` 不导出图片 | 完善 `cli-listing.ts` |
| **提示词模板库 localStorage** | 关键词库已改 SQLite，模板库还没改 | 统一持久化 |
| **关键词库导出按语言** | 导出返回空 JSON | 加语言参数 |

### P2 — 体验优化

| 问题 | 现象 | 方向 |
|------|------|------|
| **暗色模式未完整验证** | listing 组件已用 CSS 变量 | 逐页测试 |
| **资源库无全屏浏览器** | 目前弹窗模式 | 独立页面 |
| **memory-llm 模型名错误** | 日志 `gpt-4o-mini` | Settings → `deepseek-v4-pro` |
| **InputPanel 子类目选择器** | 硬编码缝纫子类目 | 改为通用 |

---

## 📋 注意事项

### 不要做的事

1. **不要改 npm 包名**：`@open-design/contracts`、`@open-design/daemon` 等是内部引用标识符，改了会导致所有 import 失败
2. **不要改插件命名空间**：`open-design/plugin-id` 是插件注册标识，改了会导致插件无法匹配
3. **不要改 `open-design.json` 文件名**：这是插件 manifest 的标准文件名
4. **不要删 `plugins/_official/`**：目录有 402 个内置插件
5. **不要在生产环境用 Windows 路径作为配置值**：用正斜杠或 `path.join()`
6. **不要在组件外用 `t()` 函数**：模块级常量无法访问 React hook，用 `Record<string, string>` 映射表
7. **不要改 daemon 源码后不重建**：TypeScript 源文件修改后必须 `pnpm build`
8. **不要改 i18n types.ts 不更新 18 个 locale 文件**：会导致 typecheck 失败

### 容易踩的坑

1. **React Strict Mode**：开发环境会 double-mount 组件，fetch 被 abort 是正常现象（`AbortError: signal is aborted`）
2. **WorkspaceTabsBar 标签名**：新增 route kind 必须同步修改 `tabFromRoute`、`routeForTab`、`displayTabFor`、`uniqueIdForTab`、`reviveTab` 五个函数
3. **i18n 子组件**：如果一个组件拆出了子组件（如 `ComingSoonPanel`、`AutomationRunHistory`），子组件需要自己的 `useT()`
4. **Windows 路径**：`path.resolve` 在 Windows 上行为可能不同，用 `path.join` 更安全
5. **better-sqlite3**：Windows 上没有预编译二进制，需要 Visual Studio Build Tools 编译

### 重启后必做

```bash
# 1. 注册插件（如果 daemon 启动时未自动加载）
cd apps/daemon && node --input-type=module -e "
import { registerBundledPlugins } from './dist/plugins/bundled.js';
import Database from 'better-sqlite3';
import path from 'path';
const db = new Database(path.resolve('../../', '.od/app.sqlite'));
await registerBundledPlugins({ db, bundledRoot: path.resolve('../../', 'plugins/_official'), marketplaceProvenance: { sourceMarketplaceId: 'official', marketplaceTrust: 'official', entryNamePrefix: 'open-design' } });
console.log('Plugins:', 'OK');
"
```
