# ShopAgent 部署与维护指南

## 线上地址

**http://121.41.101.146:7456/**

---

## 一、本地开发

```bash
cd E:\workspace\projects\shopagent
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
# 访问 http://127.0.0.1:17573/
```

## 二、本地改代码后部署到服务器

### 第1步：提交代码到 GitHub

```bash
cd E:\workspace\projects\shopagent
git add -A
git commit -m "描述你改了什么"
git push
```

### 第2步：登录服务器更新

```bash
ssh root@121.41.101.146
# 密码: Fnwf4@168
```

### 第3步：拉取最新代码并重启（一行搞定）

```bash
cd /opt/shopagent && git pull && pnpm install && pnpm --filter @open-design/daemon build && NODE_OPTIONS="--max-old-space-size=2048" pnpm --filter @open-design/web build && systemctl restart shopagent
```

等待 2-3 分钟构建完成，刷新网页即可看到更新。

---

## 三、服务器常用命令

| 操作 | 命令 |
|------|------|
| 查看服务状态 | `systemctl status shopagent` |
| 查看实时日志 | `journalctl -u shopagent -f` |
| 重启服务 | `systemctl restart shopagent` |
| 停止服务 | `systemctl stop shopagent` |
| 测试 API | `curl localhost:7456/api/health` |

## 四、如果构建失败

上次构建产物在 `apps/web/out/` 目录，服务正常运行。新部署时如果构建报错：

1. 先确认本地 `pnpm typecheck` 能通过
2. 如果服务器构建失败，检查 `next.config.ts` 中有没有 `typescript: { ignoreBuildErrors: true }`
3. 必要时在服务器上跳过类型检查：
   ```bash
   cd /opt/shopagent
   sed -i '/reactStrictMode/a \  typescript: { ignoreBuildErrors: true },' apps/web/next.config.ts
   NODE_OPTIONS="--max-old-space-size=2048" pnpm --filter @open-design/web build
   ```

## 五、重要路径

| 路径 | 说明 |
|------|------|
| `/opt/shopagent/` | 项目根目录 |
| `/opt/shopagent/apps/web/out/` | Web 静态产物 |
| `/opt/shopagent/.od/` | SQLite 数据库 |
| `/etc/systemd/system/shopagent.service` | 服务配置 |

## 六、安全提醒

- 定期改 root 密码：`passwd root`
- API Token 在 `.env` 文件中：`OD_API_TOKEN=shopagent2024`
- 生产环境建议换一个更强的 Token：`openssl rand -hex 32`
