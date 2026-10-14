#!/bin/bash
# relic.skill 演示站部署脚本
#
# 2026-10-14 重写：旧版（引用已废弃的 ruxi-server alias 与旧上海服务器）已失效。
# 现目标：易科云服务器，主机/目录来自本目录 .env.deploy（该文件不入库）。
# 密码类凭据：见根 vpn-infra/server-resources.txt（不入库）。
# 背景与完整步骤：.reference/演示站迁移部署准备-2026-10-14.md
#
# 用法：
#   bash deploy-demo.sh
#
# 首次部署附加步骤（nginx + certbot）见 deploy/nginx-relic-intervip-lol.conf

set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env.deploy ]; then
  # shellcheck disable=SC1091
  source .env.deploy
fi

: "${DEPLOY_MAIN_HOST:?请先在 .env.deploy 配置 DEPLOY_MAIN_HOST（参考 .reference/演示站迁移部署准备-2026-10-14.md）}"
REMOTE_USER="${DEPLOY_MAIN_USER:-root}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/var/www/relic-demo}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new"

echo "🚀 部署 relic.skill 演示站 → ${REMOTE_USER}@${DEPLOY_MAIN_HOST}:${REMOTE_DIR}"

echo "📦 构建前端（Next.js 静态导出）..."
npm --prefix demo-site run build

echo "🗜️ 预压缩静态资源（供 nginx gzip_static 使用）..."
find demo-site/out -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" -o -name "*.svg" -o -name "*.txt" -o -name "*.xml" \) -exec rm -f "{}.gz" \;
find demo-site/out -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" -o -name "*.svg" -o -name "*.txt" -o -name "*.xml" \) -exec gzip -kf9 {} \;

echo "📦 推送构建产物（tar 流式）..."
MSYS_NO_PATHCONV=1 tar czf - -C demo-site/out . | ssh $SSH_OPTS "$REMOTE_USER@$DEPLOY_MAIN_HOST" "mkdir -p '$REMOTE_DIR' && tar xzf - -C '$REMOTE_DIR'"

echo "✅ 部署完成"
echo "🌐 访问: ${PUBLIC_URL:-https://relic.intervip.lol}"
echo "ℹ️  若为首轮部署：还差 nginx server block + certbot 签证书（deploy/nginx-relic-intervip-lol.conf）"
