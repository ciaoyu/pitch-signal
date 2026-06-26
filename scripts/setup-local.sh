#!/usr/bin/env bash
# PitchSignal — 本地开发环境一键设置
# 用法: ./scripts/setup-local.sh

set -euo pipefail

color() {
  local code=$1
  shift
  echo -e "\033[${code}m$*\033[0m"
}

info()  { color "34" "[INFO] $*"; }
ok()    { color "32" "[OK]   $*"; }
warn()  { color "33" "[WARN] $*"; }
err()   { color "31" "[ERR]  $*"; }

info "PitchSignal 本地开发环境设置"

# 1. 检查 Node.js
info "检查 Node.js..."
if ! command -v node &>/dev/null; then
  err "Node.js 未安装。请安装 Node.js 22+ (推荐用 nvm: nvm install 22)"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  warn "Node.js 版本 $NODE_VERSION，建议升级到 22.x"
  warn "当前版本可能运行正常，但推荐使用 22.x"
else
  ok "Node.js $(node -v) ✓"
fi

# 2. 检查 npm
info "检查 npm..."
if ! command -v npm &>/dev/null; then
  err "npm 未安装。请安装 npm。"
  exit 1
fi
ok "npm $(npm -v) ✓"

# 3. 检查 .env
info "检查 .env 文件..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    info "从 .env.example 复制 .env..."
    cp .env.example .env
    ok ".env 已创建 (请编辑填写你的 API keys)"
  else
    warn ".env.example 不存在，请手动创建 .env"
  fi
else
  ok ".env 已存在 ✓"
fi

# 4. 安装依赖
info "安装依赖..."
npm ci
ok "依赖安装完成 ✓"

# 5. 检查 SQLite 数据库
info "检查数据库..."
if [ -f data/predictions.db ]; then
  ok "数据库已存在 ✓"
else
  info "数据库将在首次启动时自动创建"
fi

# 6. 创建必要的目录
info "创建目录..."
mkdir -p data/db/snapshots
mkdir -p data/live-snapshots
mkdir -p reports
ok "目录创建完成 ✓"

# 7. 测试运行
info "测试启动..."
NODE_ENV=development node server.js &
PID=$!
sleep 3

info "健康检查..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5099/health || true)
if [ "$STATUS" == "200" ]; then
  ok "本地启动成功! http://localhost:5099 ✓"
  ok "健康检查通过: /health = 200"
else
  err "健康检查失败 (HTTP $STATUS)。请检查日志。"
  kill $PID 2>/dev/null || true
  exit 1
fi

kill $PID 2>/dev/null || true
ok "测试进程已关闭"

echo ""
ok "本地开发环境设置完成!"
info "启动命令: npm start"
info "开发地址: http://localhost:5099"
info ""
info "提示:"
info "  - 编辑 .env 文件配置你的 API keys"
info "  - 公测期间所有安全令牌保持为空"
info "  - 数据库文件在 data/predictions.db (SQLite + WAL)"
