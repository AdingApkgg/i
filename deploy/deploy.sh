#!/usr/bin/env bash
# 在服务器上执行的部署脚本（.github/workflows/deploy.yml 通过 SSH 运行，也可以手动跑）：
#   拉取 main → compose.prod.yaml 构建并启动（数据库迁移由 migrate 服务自动完成）→ 健康检查
#   MIGRATE_STORAGE=1 时再做一次 MinIO → SeaweedFS 的存储迁移（可重复运行）
#
#   DEPLOY_PATH=~/i MIGRATE_STORAGE=0 bash deploy/deploy.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-$HOME/i}"
DOCKER="${DOCKER:-docker}"
MIGRATE_STORAGE="${MIGRATE_STORAGE:-0}"

cd "$DEPLOY_PATH"
log() { printf '\n==> %s\n' "$*"; }

log "更新代码（$DEPLOY_PATH）"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "服务器上的仓库有未提交的改动，先处理掉再部署：" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi
git fetch --prune origin main
git checkout -q main
git merge --ff-only origin/main
git log --oneline -1

[ -f .env ] || { echo "缺少 .env（参考 .env.example）" >&2; exit 1; }
compose() { $DOCKER compose -f compose.prod.yaml "$@"; }

log "构建并启动（数据库迁移由 migrate 服务完成）"
compose up -d --build

# compose 看不出挂载的 Caddyfile 内容变了，不会重建 proxy，改过的配置要靠 reload 生效（没改时什么都不做）
log "重新加载 Caddy 配置"
for i in $(seq 1 10); do
  compose exec -T proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile && break
  [ "$i" = 10 ] && { echo "Caddy 配置加载失败" >&2; exit 1; }
  sleep 1
done

PORT="$(sed -n 's/^PROXY_PORT=//p' .env | tail -1)"
URL="http://127.0.0.1:${PORT:-8099}/robots.txt"
log "等待站点就绪：$URL"
for _ in $(seq 1 90); do
  if curl -sf -o /dev/null "$URL"; then
    echo "站点已就绪"
    break
  fi
  sleep 2
done
if ! curl -sf -o /dev/null "$URL"; then
  echo "站点 3 分钟内没有就绪，最近的日志：" >&2
  compose ps -a >&2
  compose logs --tail 80 migrate web seaweedfs >&2
  exit 1
fi
compose ps --format '{{.Service}}\t{{.Status}}'

if [ "$MIGRATE_STORAGE" = "1" ]; then
  log "存储迁移：MinIO → SeaweedFS（用服务器上现有的 MinIO 镜像）"
  compose --profile legacy up -d minio
  compose --profile legacy run --rm storage-migrate
  compose --profile legacy stop minio
fi

log "部署完成"
