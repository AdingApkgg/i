#!/usr/bin/env bash
# Cloudflare 缓存配置（.github/workflows/deploy.yml 在部署完成后调用）：
#   configure  维护一条页面缓存规则（只匹配 SITE_HOST；幂等，只动自己这条，其他规则原样保留）。
#              浏览器缓存时间由规则里的 browser_ttl 遵循源站；不改 zone 级的 Browser Cache TTL ——
#              那是整个域名的设置，同一 zone 下的其他站点也会受影响
#   purge      清空整个 zone 的缓存（每次部署后：旧 HTML 引用的旧 JS 已不存在）
#
# 需要：CLOUDFLARE_API_TOKEN（权限：Zone Read、Cache Rules Edit、Cache Purge），
#      CLOUDFLARE_ZONE（域名，如 saop.cc）或 CLOUDFLARE_ZONE_ID，SITE_HOST（如 i.saop.cc）
#
#   bash deploy/cloudflare.sh configure purge
set -euo pipefail

API="${CF_API:-https://api.cloudflare.com/client/v4}"
: "${CLOUDFLARE_API_TOKEN:?需要 CLOUDFLARE_API_TOKEN}"
RULE_REF="i_site_cache"

# cf METHOD PATH [BODY]：成功时输出响应 JSON；失败时打印错误并返回非 0。
# HTTP 状态码写到 CF_STATUS 文件，调用方可据此区分 404（例如还没有任何缓存规则）
CF_STATUS=$(mktemp)
cf() {
  local method=$1 path=$2 body=${3:-} out code
  out=$(mktemp)
  code=$(curl -sS -o "$out" -w '%{http_code}' -X "$method" "$API$path" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    ${body:+--data "$body"})
  echo "$code" >"$CF_STATUS"
  if [ "$(jq -r '.success' "$out" 2>/dev/null)" != "true" ]; then
    echo "Cloudflare API 失败：$method $path（HTTP $code）" >&2
    jq -c '.errors' "$out" >&2 2>/dev/null || cat "$out" >&2
    rm -f "$out"
    return 1
  fi
  cat "$out"
  rm -f "$out"
}

zone_id() {
  if [ -n "${CLOUDFLARE_ZONE_ID:-}" ]; then
    echo "$CLOUDFLARE_ZONE_ID"
    return
  fi
  : "${CLOUDFLARE_ZONE:?需要 CLOUDFLARE_ZONE（域名）或 CLOUDFLARE_ZONE_ID}"
  local id
  id=$(cf GET "/zones?name=$CLOUDFLARE_ZONE" | jq -r '.result[0].id // empty')
  [ -n "$id" ] || { echo "找不到 zone：$CLOUDFLARE_ZONE" >&2; return 1; }
  echo "$id"
}

# 页面 / 页面数据 / 相册图片按源站缓存头缓存；/dash 与其余 /api 不缓存（源站也会给 no-store）
rule_json() {
  : "${SITE_HOST:?需要 SITE_HOST（站点域名，如 i.saop.cc）}"
  jq -n --arg ref "$RULE_REF" --arg host "$SITE_HOST" '{
    ref: $ref,
    description: "i：页面与图片按源站缓存头缓存（由 deploy 工作流维护）",
    expression: ("http.host eq \"" + $host + "\" and not starts_with(http.request.uri.path, \"/dash\") and not (starts_with(http.request.uri.path, \"/api/\") and not starts_with(http.request.uri.path, \"/api/gallery/files/\"))"),
    action: "set_cache_settings",
    action_parameters: {
      cache: true,
      edge_ttl: { mode: "bypass_by_default" },
      browser_ttl: { mode: "respect_origin" }
    },
    enabled: true
  }'
}

configure() {
  local zone=$1
  echo "==> 缓存规则（$SITE_HOST）"
  local phase="/zones/$zone/rulesets/phases/http_request_cache_settings/entrypoint"
  local existing='[]' out
  if out=$(cf GET "$phase" 2>/dev/null); then
    # 保留其他规则（去掉 version / last_updated 等只读字段），替换掉自己那条
    existing=$(jq --arg ref "$RULE_REF" '[.result.rules // [] | .[]
      | select(.ref != $ref) | del(.version, .last_updated, .categories)]' <<<"$out")
  elif [ "$(cat "$CF_STATUS")" != "404" ]; then
    # 只有「还没有任何缓存规则」（404）才能当空列表；其他失败一律中止，免得覆盖掉已有规则
    cf GET "$phase" >/dev/null
    return 1
  fi
  local rules
  rules=$(jq -n --argjson existing "$existing" --argjson ours "$(rule_json)" '$existing + [$ours]')
  cf PUT "$phase" "$(jq -n --argjson rules "$rules" '{rules: $rules}')" >/dev/null
  echo "    规则共 $(jq length <<<"$rules") 条（其中 1 条由本脚本维护）"
}

purge() {
  echo "==> 清空缓存（purge everything）"
  cf POST "/zones/$1/purge_cache" '{"purge_everything":true}' >/dev/null
}

ZONE=$(zone_id)
for step in "$@"; do
  case $step in
    configure) configure "$ZONE" ;;
    purge) purge "$ZONE" ;;
    *) echo "未知步骤：$step（可选 configure / purge）" >&2; exit 1 ;;
  esac
done
echo "==> Cloudflare 完成"
