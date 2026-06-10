---
name: shopagent-project-status
description: ShopAgent 全部模块的完成状态、待优化清单、经营踩坑经验
metadata: 
  node_type: memory
  type: project
  originSessionId: 5269954e-4093-4861-b172-962fa0ff1aa0
---

# ShopAgent 项目记忆

## 核心功能完成度

### Listing 工作台（✅ 90%）

| 功能 | 状态 | 备注 |
|------|------|------|
| LLM 文案生成 | ✅ | DeepSeek V4 Pro |
| 标题 A/B + 关键词校验 | ✅ | |
| 主图 ABC 生图 | ✅ | APIMart / Gemini |
| 详情图 1-6 | ✅ | |
| 视频脚本 + 封面 | ✅ | |
| 关键词库 SQLite | ✅ | 7 分类，语言分离，⭐标记 |
| 资源库管理 | ✅ | 导入/导出 JSON |
| 保存/更新项目 | ✅ | HTML 品牌落地页 |
| 表单持久化 | ✅ | localStorage |
| 图片队列串行 | ✅ | queued → generating → done |
| 提示词模板库 | ✅ | |

### Workflow 工作台（✅ 可用）

| 功能 | 状态 | 备注 |
|------|------|------|
| Refly 导航入口 | ✅ | 新标签页打开部署版 Refly |
| 免登 | ✅ | 部署版自带 |

### 其他

| 功能 | 状态 |
|------|------|
| 左侧导航 | ✅ |
| 项目系统 | ✅ |

## 待优化清单

### P0 — 功能缺口
- [ ] Listing 项目 HTML 预览文件列表（当前只有 listing.html，未显示生成的图片文件）
- [ ] 提示词模板库也改为 SQLite（当前仍用 localStorage）
- [ ] 关键词库导出按语言区分
- [ ] Listing 工作台内嵌项目预览（当前跳转新页面）

### P1 — 体验优化
- [ ] InputPanel 子类目选择器改为通用（当前硬编码缝纫子类目）
- [ ] ImageCard 视频封面图点击放大预览
- [ ] 资源库全屏模式
- [ ] 暗色模式适配

### P2 — 架构完善
- [ ] 关键词库 + 提示词库 daemon 端数据初始种子
- [ ] Docker 单容器部署
- [ ] CLI `od listing` 子命令完善

## 踩坑经验

### 1. Refly 集成
**坑**：试图 mock Refly 的 176 个 API 端点来绕过完整后端。Refly 是深度全栈应用，canvas/chat/skill 都依赖 Go API 后端。
**教训**：全栈应用不能只跑前端 mock。直接用完整部署版，ShopAgent 只做导航入口。Refly 源码不改一行。
**方案**：`window.open('http://47.85.48.19:5700/workspace', '_blank')` 新标签页打开。

### 2. 免登方案
**坑**：Refly 的 auth 有 6 层防御（ProtectedRoute → useIsLogin → useGetUserSettings → AppLayout → cookie → API），补丁永远打不完。
**教训**：不要尝试 mock auth。Cookie 跨域（localhost ≠ 127.0.0.1），必须同源代理或完整后端。
**方案**：rsbuild proxy `/api/refly` → daemon，`.env` 用相对路径 `VITE_API_URL=/api/refly`。

### 3. 生图轮询时间
**坑**：Gemini 默认 20 次轮询(60s)，但实际可能需要 124s，导致图片"生成失败"但实际后台已生成。
**教训**：轮询上限要足够大。Gemini 20→60 次(180s)。这个参数来自 ListingGen 原版多次实测经验。

### 4. 响应格式对齐
**坑**：test-connection 返回 `{ success: true }`，Refly 检查 `{ status: 'success' }`。字段名不匹配导致"测试连接失败"。
**教训**：mock 任何 API 前必须读 `services.gen.ts` 确认 URL，读 `types.gen.ts` 确认请求/响应类型。Refly 的 OpenAPI schema 是唯一真相源。

### 5. Provider API key 查找
**坑**：Refly 的 test-connection 只传 `{ providerId: "xxx" }`，不传 `apiKey`。后端必须自己查存储的 key。
**教训**：`TestProviderConnectionRequest` 类型只有 `providerId` 字段。

### 6. 正则表达式 `//` 被解析为注释
**坑**：`.replace(//+$/, '')` → TypeScript 把 `//` 当行注释。
**教训**：TS 文件写正则必须用 `\/+$` 转义。

### 7. 代码碎片化
**坑**：用 `node -e` 或 `sed` 多次打补丁，产生语法错误、重复路由、作用域问题。
**教训**：一次性写好完整文件，不用碎片化修改。用 Write 工具整体重写。

### 8. 数据流闭环
**坑**：token/key 的持久化和读取要闭环。Provider CRUD → 存 Map → test-connection 查 Map → 返回。
**教训**：每个"创建"都要对应"列表"能返回、"查询"能找到、"删除"后不存在。

### 9. 前端组件作用域
**坑**：`copiedIdx` 定义在父组件 `OutputPanel`，但被独立子组件 `TitleBlock` 引用 → ReferenceError。
**教训**：独立组件需要自己的 state。不要跨组件共享 useState。

### 10. Next.js 代理 body 限制
**坑**：Next.js dev proxy 默认 body 限制导致图片 base64 上传 `PayloadTooLargeError`。
**教训**：`express.json({ limit: '16mb' })` + `serverRuntimeConfig: { bodyParser: { sizeLimit: "16mb" } }` 双端都要改。

### 11. 直接复用原版代码
**坑**：从零重写 ListingGen 的 ImageCard/OutputPanel/queue 等组件，功能覆盖率不到 50%。
**教训**：能复刻原版就直接复刻，不要重写。ListingGen 原版是经过验证的成品。

### 12. 文件锁 (Windows)
**坑**：`rm -rf` 时 `Device or resource busy`，Next.js dev server 不释放文件句柄。
**教训**：先 `pkill` 进程再删文件。

## 代码路径速查

```
E:\workspace\projects\shopagent\                ← ShopAgent 主项目
├── apps/daemon/src/listing/                    ← 后端核心逻辑
├── apps/web/app/listing/page.tsx               ← Listing 主页面
├── apps/web/src/components/listing/             ← 前端组件
├── apps/web/src/lib/listing/                    ← 前端工具库
├── packages/contracts/src/listing/types.ts      ← 共享类型
├── skills/listing/shopee-listing-v3.md          ← SKILL 方法论
└── apps/daemon/assets/listing-hero.png          ← HTML Hero 图

E:\workspace\projects\Refly2\                   ← Refly 本地调试
E:\workspace\projects\商海蟹Coding\05-产品项目\listinggen\  ← ListingGen 原版参考
```
