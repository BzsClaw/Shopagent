# ShopAgent — AI 驱动的电商运营垂直 Agent 工具

> **路径**：`E:\workspace\projects\shopagent\`  
> **版本**：v0.1.0  
> **基于**：Open Design + ListingGen 方法论  

## 快速启动

```bash
cd E:\workspace\projects\shopagent
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

访问：`http://127.0.0.1:17573/`

## 功能模块

### 1. Listing 工作台 (`/listing`)
输入产品信息 + 白底图 → AI 生成全套 Listing 物料：

| 功能 | 状态 |
|------|------|
| 标题 A/B 双版本生成 | ✅ |
| 主图 A/B/C 三版 prompt + 生图 | ✅ |
| 详情图 1-6 序列 | ✅ |
| 视频 4 镜头脚本 + 封面图 | ✅ |
| 自检清单 | ✅ |
| 关键词库（SQLite + 语言分类 + 标记） | ✅ |
| 资源库（关键词/提示词管理） | ✅ |
| 保存/更新到项目（HTML 品牌落地页） | ✅ |
| API Key 配置（DeepSeek + APIMart） | ✅ |

### 2. Workflow 工作台（Refly）
独立 Refly 实例，完整的工作流画布编排。
- 入口：ShopAgent 左侧导航 → 🔀 Workflow → 新标签页打开

### 3. 项目系统
- 创建/编辑项目
- HTML 文件预览
- Design/Ask 双模式

## 技术架构

```
apps/
├── daemon/          ← Express 守护进程 (port 17456)
│   └── src/listing/ ← Listing 核心逻辑
│       ├── skill-loader.ts    Prompt 组装
│       ├── tag-parser.ts      LLM 输出解析
│       ├── listing-routes.ts  REST API
│       ├── listing-images.ts  多模型生图
│       └── listing-db.ts      SQLite 持久化
├── web/             ← Next.js 16 前端 (port 17573)
│   └── src/components/listing/
│       ├── InputPanel.tsx     产品输入
│       ├── OutputPanel.tsx    结果输出
│       ├── ImageCard.tsx      图片卡片
│       ├── KeywordPicker.tsx  关键词选择器
│       ├── ResourceLibrary.tsx 资源库管理
│       └── ApiKeySettings.tsx API 配置
packages/
└── contracts/src/listing/types.ts ← 共享 DTO
```

## API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/listing/skills` | 可用 Skill 列表 |
| POST | `/api/listing/generate` | 生成 Listing |
| POST | `/api/listing/build-prompt` | 组装 Prompt |
| POST | `/api/listing/save-project` | 保存/更新项目 |
| GET | `/api/listing/keywords?language=en` | 关键词库 |
| POST | `/api/listing/keywords` | 保存关键词分类 |
| DELETE | `/api/listing/keywords?language=en&category=xxx` | 删除分类 |

## 环境要求

- Node 24
- pnpm 10.33.2
- Visual Studio Build Tools (Windows, better-sqlite3 编译)
