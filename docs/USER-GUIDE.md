# ShopAgent 使用说明书

## 启动

```bash
cd E:\workspace\projects\shopagent
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

浏览器打开 `http://127.0.0.1:17573/`

---

## 一、Listing 工作台

### 1. 配置 API Key（首次使用）

点击页面右上角 **⚙** → 填入：

| 配置项 | 说明 |
|--------|------|
| DeepSeek API Key | 文案生成，支持 DeepSeek 兼容 API |
| DeepSeek Base URL | 默认 `https://api.deepseek.com/v1` |
| 生图 API Key | 图片生成，支持 APIMart 兼容 API |
| 生图 Base URL | 默认 `https://api.apimart.ai/v1` |
| 生图模型 | 默认 `gemini-3.1-flash-image-preview` |

### 2. 生成 Listing

1. 上传产品白底图（点击或拖拽）
2. 填写产品名称、表层/场景/情绪/身份关键词
3. 填写核心差异化卖点、其他卖点、产品规格
4. 从关键词库选择（点 **📚 关键词库**）
5. 点 **🚀 生成 Listing**

### 3. 查看结果

生成完成后右侧输出面板展示：

- **标题 A/B**：双版本标题 + 字符统计 + 关键词标签
- **主图 A/B/C**：三版主图 prompt（卖点放大/场景代入/极简纯净）
- **视频脚本**：4 镜头拍摄脚本 + 封面图
- **文字描述**：长文案 + #Hashtags
- **详情图 1-6**：痛点开场 → 差异化 → 内容物 → 便携 → 场景 → 信任

### 4. 生成图片

文案生成后，每张图片卡片点 **生成图片** 按钮：

- 第 1 张进入"生成中"状态，其余显示"排队中"
- 图片生成后在卡片右侧预览
- 可编辑 prompt 后点 **重新生成**
- 可点 **⬇ 下载** 保存到本地

### 5. 保存到项目

点 **💾 保存到项目** → 生成品牌落地页 HTML → 跳转项目预览

再次回到 Listing 工作台，按钮变为 **💾 更新项目**，点击覆盖旧版。

---

## 二、资源库管理

Listing 页面点击 **📚 资源库** 按钮进入。

### 关键词库

- 左侧选择分类（表层词/场景词/情绪词...）
- 右侧添加/删除关键词
- **⭐ 标记**重要关键词（点 ⭐/🔥/🆕 切换）
- 切换语言（英语/中文/泰语/越南语...）
- **📤 导入 JSON** / **📥 导出 JSON**

### 提示词模板库

- 按分类管理生图提示词模板
- 支持添加/编辑/删除

---

## 三、Workflow 工作台

左侧导航栏点击 **🔀 Workflow** → 新标签页打开 Refly 画布编辑器。

功能：
- 可视化 DAG 工作流编排
- 添加 Skill 节点 → 连线 → 执行
- 模型供应商配置
- 社区工具安装

---

## 四、API 配置说明

### DeepSeek API

获取地址：https://platform.deepseek.com/api_keys

支持模型：
- `deepseek-v4-pro`（推荐，文案生成）
- `deepseek-v4-flash`（快速模式）

### APIMart 生图 API

获取地址：https://api.apimart.ai

支持模型：
- `gemini-3.1-flash-image-preview`（推荐，10-30s）
- `doubao-seedance-4-5`（即梦，10-500s）
- `gpt-image-2`（100-500s）

---

## 五、常见问题

**Q：生成文案失败？**
A：检查 DeepSeek API Key 是否正确，点 ⚙ → 测试连接

**Q：生图失败？**
A：检查生图 API Key，确认 APIMart 后台有额度。Gemini 生图可能需 60-120 秒

**Q：刷新页面表单没了？**
A：表单已做 localStorage 持久化，正常刷新不会丢失。如丢失请检查浏览器是否禁用 localStorage

**Q：保存后在哪里看？**
A：点保存后自动跳转项目页，HTML 品牌落地页在 `listing.html`

## 六、系统要求

- 操作系统：Windows 10+ / macOS / Linux
- Node.js 24
- 网络：需访问 DeepSeek API 和 APIMart API
