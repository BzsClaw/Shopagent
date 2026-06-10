# APIMart 测试连接修复记录

**日期**：2026-06-10  
**修复人**：商海蟹 + Claude  
**文件**：`apps/web/src/components/listing/ApiKeySettings.tsx`

## 问题

设置页 APIMart 生图「测试连接」按钮始终报失败。

## 根因

`ApiKeySettings.tsx` 的 `test()` 函数用裸 `fetch()` 浏览器直连 APIMart：

```ts
// 旧代码（有问题）
const res = await fetch(`${url}/models`, {
  headers: { 'Authorization': `Bearer ${key}` },
})
```

两个问题：
1. **裸 fetch 代替 OpenAI SDK** — 缺少 SDK 内置的 header 规范化、重试、错误解析
2. **catch 块吞错** — 无论 CORS/401/网络断，统一返回 `{ ok: false }`，无错误信息

## 修复

照搬 ListingGen（已验证三模型全通）的 `testConnection` 模式：

```ts
// 新代码（复刻 ListingGen apimart.ts:20-28）
const client = new OpenAI({
  apiKey: key,
  baseURL: url,
  dangerouslyAllowBrowser: true,  // 关键
})
const models = await client.models.list()
setTestResult({ ok: models.data.length > 0 })
// catch 块返回 e.message，失败有据可查
```

三处具体改动：
| 位置 | 旧 | 新 |
|------|-----|-----|
| 第 7 行 | 无 | `import OpenAI from 'openai'` |
| 第 52-64 行 | `fetch(\`${url}/models\`)` + 空 catch | `new OpenAI({ dangerouslyAllowBrowser: true }).models.list()` + 错误透传 |
| 第 96/117 行 | 失败只显示「✗ 连接失败」 | 失败显示「✗ {具体错误信息}」 |

## 验证

- TypeScript 编译：通过（0 个新错误）
- pnpm install：`openai` 已在 `apps/web/package.json` 依赖中，安装成功

## 参考

- ListingGen 成功实现：`listinggen/src/lib/apimart.ts:20-28`
- ListingGen CLAUDE.md 相关经验：「API 经验 → APIMart 生图」
