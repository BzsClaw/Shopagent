#!/bin/bash
# ShopAgent 一键部署脚本 — Alibaba Cloud Linux 4
set -e

echo "=== 1. 安装 Node.js 24 ==="
curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
dnf install -y nodejs git nginx
node --version

echo "=== 2. 安装 pnpm ==="
npm install -g pnpm@10.33.2
pnpm --version

echo "=== 3. 克隆项目 ==="
cd /opt
git clone https://github.com/BzsClaw/Shopagent.git shopagent
cd shopagent

echo "=== 4. 安装依赖 ==="
pnpm install

echo "=== 5. 配置环境变量 ==="
cat > .env << 'ENVEOF'
DEEPSEEK_API_KEY=sk-2341c9ce5ba944f8b9912a91a6e59671
APIMART_API_KEY=
OD_PORT=7456
OD_BIND_HOST=0.0.0.0
OD_API_TOKEN=shopagent2024
ENVEOF

echo "=== 6. 构建 ==="
pnpm --filter @open-design/daemon build
pnpm --filter @open-design/web build

echo "=== 7. 创建 systemd 服务 ==="
cat > /etc/systemd/system/shopagent.service << 'SVC'
[Unit]
Description=ShopAgent
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/shopagent
ExecStart=/usr/bin/node apps/daemon/dist/cli.js --no-open --port 7456 --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=OD_PORT=7456
Environment=OD_BIND_HOST=0.0.0.0
Environment=OD_DATA_DIR=/opt/shopagent/.od

[Install]
WantedBy=multi-user.target
SVC

echo "=== 8. 启动服务 ==="
systemctl daemon-reload
systemctl enable shopagent
systemctl start shopagent

echo "=== 9. 配置防火墙 ==="
firewall-cmd --add-port=7456/tcp --permanent 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

echo ""
echo "✅ 部署完成！"
echo "访问地址: http://121.41.101.146:7456/"
echo "查看状态: systemctl status shopagent"
echo "查看日志: journalctl -u shopagent -f"
