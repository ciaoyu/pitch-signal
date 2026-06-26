#!/usr/bin/env bash
# PitchSignal — 一键部署脚本
# 用法：./scripts/deploy.sh [railway|render|local|all]

set -euo pipefail

APP_NAME="pitch-signal"
RAILWAY_SERVICE="pitch-signal"
RENDER_DEPLOY_HOOK="${RENDER_DEPLOY_HOOK:-}"

color() {
  local code=$1
  shift
  echo -e "\033[${code}m$*\033[0m"
}

info()  { color "34" "[INFO] $*"; }
ok()    { color "32" "[OK]   $*"; }
warn()  { color "33" "[WARN] $*"; }
err()   { color "31" "[ERR]  $*"; }

check_deps() {
  local missing=()
  for cmd in "$@"; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done
  if [ ${#missing[@]} -gt 0 ]; then
    err "缺少依赖: ${missing[*]}"
    exit 1
  fi
}

deploy_railway() {
  info "部署到 Railway..."
  check_deps railway node npm

  # 登录检查
  if ! railway whoami &>/dev/null; then
    err "未登录 Railway。请运行: railway login"
    exit 1
  fi

  info "推送到 Railway..."
  railway up --service="$RAILWAY_SERVICE"

  # 等待部署
  info "等待 15 秒让部署生效..."
  sleep 15

  # 健康检查
  URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$URL" ]; then
    URL="https://pitch-signal-production.up.railway.app"
  fi

  info "健康检查: $URL/health"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health" || true)
  if [ "$STATUS" == "200" ]; then
    ok "Railway 部署成功! URL: $URL"
  else
    err "健康检查失败 (HTTP $STATUS)。请检查 Railway 日志。"
    exit 1
  fi
}

deploy_render() {
  info "部署到 Render..."
  if [ -z "$RENDER_DEPLOY_HOOK" ]; then
    err "RENDER_DEPLOY_HOOK 未设置。请设置环境变量: export RENDER_DEPLOY_HOOK=..."
    exit 1
  fi

  info "触发 Render Deploy Hook..."
  curl -X POST "$RENDER_DEPLOY_HOOK" -H "Content-Type: application/json" --silent --show-error

  info "等待 30 秒让部署生效..."
  sleep 30

  RENDER_URL="${RENDER_APP_URL:-https://pitch-signal.onrender.com}"
  info "健康检查: $RENDER_URL/health"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$RENDER_URL/health" || true)
  if [ "$STATUS" == "200" ]; then
    ok "Render 部署成功! URL: $RENDER_URL"
  else
    err "健康检查失败 (HTTP $STATUS)。请检查 Render 日志。"
    exit 1
  fi
}

deploy_local() {
  info "本地部署 (Docker)..."
  check_deps docker

  info "构建 Docker 镜像..."
  docker build -t "$APP_NAME:latest" .

  info "运行容器..."
  docker run -d \
    --name "$APP_NAME" \
    -p 5099:5099 \
    -e NODE_ENV=production \
    -e DATA_PATH=/usr/src/app/data \
    -e POLYMARKET_ENABLED=false \
    -e PUNDIT_ENABLED=false \
    -e AUTO_CALIBRATION=false \
    -e AI_POSTMORTEM_ENABLED=false \
    "$APP_NAME:latest"

  sleep 5

  info "健康检查: http://localhost:5099/health"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5099/health || true)
  if [ "$STATUS" == "200" ]; then
    ok "本地部署成功! http://localhost:5099"
  else
    err "健康检查失败 (HTTP $STATUS)。请检查 docker logs $APP_NAME"
    exit 1
  fi
}

show_help() {
  cat <<EOF
PitchSignal 一键部署脚本

用法: ./scripts/deploy.sh [TARGET]

TARGET:
  railway   部署到 Railway (需要 railway CLI 已登录)
  render    部署到 Render (需要 RENDER_DEPLOY_HOOK 环境变量)
  local     本地 Docker 部署
  all       部署到 Railway + Render
  help      显示此帮助

环境变量:
  RAILWAY_SERVICE      Railway 服务名 (默认: pitch-signal)
  RENDER_DEPLOY_HOOK   Render Deploy Hook URL
  RENDER_APP_URL       Render 应用 URL (默认: https://pitch-signal.onrender.com)

示例:
  ./scripts/deploy.sh railway
  ./scripts/deploy.sh render
  ./scripts/deploy.sh local
  ./scripts/deploy.sh all

EOF
}

main() {
  local target=${1:-help}

  case "$target" in
    railway)
      deploy_railway
      ;;
    render)
      deploy_render
      ;;
    local)
      deploy_local
      ;;
    all)
      deploy_railway
      deploy_render
      ;;
    help|--help|-h)
      show_help
      ;;
    *)
      err "未知目标: $target"
      show_help
      exit 1
      ;;
  esac
}

main "$@"
