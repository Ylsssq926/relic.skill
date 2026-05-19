#!/bin/bash
set -euo pipefail
SERVER_HOST="121.4.98.150"
SERVER_USER="ubuntu"
SSH_KEY="$HOME/.ssh/id_ed25519_ruxi"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
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
ssh $SSH_OPTS "$SERVER_USER@$SERVER_HOST" "rm -rf $REMOTE_DIR/* && mkdir -p $REMOTE_DIR"
scp $SSH_OPTS -r "$OUT_DIR"/* "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/"

echo "✅ 部署完成!"
echo "🌐 访问: https://relic.luelanai.com"
