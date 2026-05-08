#!/bin/bash
# relic.skill 演示站部署脚本

set -euo pipefail

SERVER="ruxi-server"
REMOTE_DIR="/opt/apps/services/relic-demo"
PROJECT_DIR="demo-site"
OUT_DIR="$PROJECT_DIR/out"

echo "🚀 部署 relic.skill 演示站"

echo "📦 构建前端..."
npm --prefix "$PROJECT_DIR" run build

echo "🗜️ 预压缩静态资源..."
find "$OUT_DIR" -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" -o -name "*.svg" -o -name "*.txt" -o -name "*.xml" \) -exec rm -f "{}.gz" \;
find "$OUT_DIR" -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" -o -name "*.svg" -o -name "*.txt" -o -name "*.xml" \) -exec gzip -kf9 {} \;

echo "📦 推送构建产物..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"
rsync -avz --delete "$OUT_DIR/" "$SERVER:$REMOTE_DIR/"

echo "🔧 配置 Nginx..."
# 如需启用站点，可将 deploy/nginx-relic-demo.conf 同步到服务器的 Nginx 配置目录。

echo "✅ 部署完成!"
echo "🌐 访问: https://relic.luelan.online"
