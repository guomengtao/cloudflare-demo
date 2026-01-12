#!/bin/bash

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "错误: .env 文件不存在"
    exit 1
fi

# 检查必要的环境变量
if [ -z "$CLOUDFLARE_API_KEY" ]; then
    echo "错误: 缺少 CLOUDFLARE_API_KEY 环境变量"
    exit 1
fi

# 自动获取昨天的日期 (格式: YYYY-MM-DD)
# 根据操作系统选择日期命令
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac 系统
    TODAY=$(date +%Y-%m-%d)
    YESTERDAY=$(date -v-1d +%Y-%m-%d)
    # 获取过去7天的开始日期
    PAST_7_DAYS=$(date -v-7d +%Y-%m-%d)
else
    # Linux 系统
    TODAY=$(date +%Y-%m-%d)
    YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
    # 获取过去7天的开始日期
    PAST_7_DAYS=$(date -d "7 days ago" +%Y-%m-%d)
fi

echo "📅 查询日期范围: $PAST_7_DAYS 到 $YESTERDAY"

# 设置必要的参数
# 从环境变量中获取参数，如果不存在则使用默认值
AUTH_EMAIL=${CLOUDFLARE_AUTH_EMAIL:-"你的登录邮箱"}
ZONE_ID=${CLOUDFLARE_ZONE_ID:-"你的ZONE_ID"}

# 从环境变量中获取API密钥
AUTH_KEY="$CLOUDFLARE_API_KEY"

# 检查所有必要参数是否设置
if [ -z "$AUTH_EMAIL" ] || [ -z "$ZONE_ID" ] || [ -z "$AUTH_KEY" ]; then
    echo "错误: 缺少必要的参数"
    echo "请在脚本中设置 AUTH_EMAIL 和 ZONE_ID，或者将它们添加到.env文件中"
    exit 1
fi

echo "🔑 使用 API 密钥: ${AUTH_KEY:0:5}...${AUTH_KEY: -5}"
echo "📧 使用邮箱: $AUTH_EMAIL"
echo "🌐 使用 ZONE_ID: $ZONE_ID"

# 首先测试基本的API认证
 echo "\n🔍 正在测试 Cloudflare API 基本认证..."

test_auth=$(curl -s -w "\n%{http_code}" -X GET "https://api.cloudflare.com/client/v4/user" \
    -H "X-Auth-Email: $AUTH_EMAIL" \
    -H "X-Auth-Key: $AUTH_KEY")

# 分离响应内容和状态码
if [[ "$OSTYPE" == "darwin"* ]]; then
    test_auth_body=$(echo "$test_auth" | sed '$d')
    test_auth_status=$(echo "$test_auth" | tail -n 1)
else
    test_auth_body=$(echo "$test_auth" | head -n -1)
    test_auth_status=$(echo "$test_auth" | tail -n 1)
fi

if [ "$test_auth_status" -ne 200 ]; then
    echo "❌ 认证失败! 状态码: $test_auth_status"
    echo "📝 错误信息:"
    echo "$test_auth_body" | jq '.errors' 2>/dev/null || echo "$test_auth_body"
    echo "\n💡 解决方法:"
    echo "   1. 确认 CLOUDFLARE_AUTH_EMAIL 是您的 Cloudflare 登录邮箱"
    echo "   2. 确保 CLOUDFLARE_API_KEY 是 Global API Key (不是 API Token)"
    echo "      - 访问: https://dash.cloudflare.com/profile/api-tokens"
    echo "      - 在 'API Keys' 部分找到 'Global API Key'"
    echo "   3. 验证 ZONE_ID 是否正确 (控制面板 -> 网站 -> 概述)"
    exit 1
fi

echo "✅ 认证成功! 获取用户信息:"
echo "$test_auth_body" | jq '.result.email, .result.username' 2>/dev/null || echo "$test_auth_body"

# 执行 curl 命令获取 Cloudflare 统计数据
if [ -n "$ZONE_ID" ] && [ "$ZONE_ID" != "your-zone-id" ]; then
    echo "\n🚀 发送请求到 Cloudflare GraphQL 端点..."

    # 获取基本统计数据（使用支持的字段）
    curl -X POST "https://api.cloudflare.com/client/v4/graphql" \
         -H "X-Auth-Email: $AUTH_EMAIL" \
         -H "X-Auth-Key: $AUTH_KEY" \
         -H "Content-Type: application/json" \
         --data '{ 
           "query": "query { viewer { zones(filter: { zoneTag: \"'"$ZONE_ID"'\" }) { httpRequests1dGroups(limit: 1, filter: { date: \"'"$YESTERDAY"'\" }) { sum { pageViews requests } } } } }" 
         }' \
         --output cloudflare-stats-daily-$YESTERDAY.json
    
    # 获取按小时统计的数据（最近24小时）
    curl -X POST "https://api.cloudflare.com/client/v4/graphql" \
         -H "X-Auth-Email: $AUTH_EMAIL" \
         -H "X-Auth-Key: $AUTH_KEY" \
         -H "Content-Type: application/json" \
         --data '{ 
           "query": "query { viewer { zones(filter: { zoneTag: \"'"$ZONE_ID"'\" }) { httpRequests1hGroups(limit: 24, filter: { date_geq: \"'"$YESTERDAY"'\" }, orderBy: [datetime_DESC]) { dimensions { datetime } sum { requests pageViews } } } } }" 
         }' \
         --output cloudflare-stats-hourly-$YESTERDAY.json

    # 检查请求是否成功
    if [ $? -eq 0 ]; then
        echo "\n✅ 请求成功!"
        echo "
✅ 数据获取成功!"
        echo "📄 按天统计数据已保存到: cloudflare-stats-daily-$YESTERDAY.json"
        echo "📄 按小时统计数据已保存到: cloudflare-stats-hourly-$YESTERDAY.json"
        
        echo "
📊 页面路径统计概览:";
        cat cloudflare-stats-daily-$YESTERDAY.json | jq '.data.viewer.zones[0].httpRequests1dGroups' 2>/dev/null || echo "请安装 jq 工具以查看格式化结果"
        
        echo "
📈 热门页面详情 (按页面浏览量排序):";
        cat cloudflare-stats-daily-$YESTERDAY.json | jq -r '.data.viewer.zones[0].httpRequests1dGroups | map("页面路径: " + .dimensions.requestPath + " | 页面浏览: " + (.sum.pageViews | tostring) + " | 请求数: " + (.sum.requests | tostring)) | .[]' 2>/dev/null || echo "请安装 jq 工具以查看详细统计"
        
        echo "
📊 热门案件ID统计:";
        cat cloudflare-stats-daily-$YESTERDAY.json | jq -r '.data.viewer.zones[0].httpRequests1dGroups | map(.dimensions.requestPath) | map(capture("/case/(?<caseId>[a-zA-Z0-9-]+)") | .caseId) | select(. != null) | .[]' 2>/dev/null | head -20 || echo "请安装 jq 工具以查看案件ID统计"
        
        echo "
📊 最近24小时统计概览:";
        cat cloudflare-stats-hourly-$YESTERDAY.json | jq '.data.viewer.zones[0].httpRequests1hGroups[0:10]' 2>/dev/null || echo "请安装 jq 工具以查看格式化结果"
        
        echo "
📊 统计摘要:";
        cat cloudflare-stats-daily-$YESTERDAY.json | jq -r '.data.viewer.zones[0].httpRequests1dGroups | length as $totalPages | reduce .[] as $item (0; . + $item.sum.requests) as $totalRequests | reduce .[] as $item (0; . + $item.sum.pageViews) as $totalPageViews | "总页面数: " + ($totalPages | tostring) + " | 总请求数: " + ($totalRequests | tostring) + " | 总页面浏览: " + ($totalPageViews | tostring)' 2>/dev/null || echo "请安装 jq 工具以查看统计摘要"
    else
        echo "\n❌ 请求失败!"
        exit 1
    fi
else
    echo "\n⚠️  未设置有效的 ZONE_ID，跳过统计数据查询"
    echo "请在 .env 文件中设置 CLOUDFLARE_ZONE_ID 以获取网站统计数据"
fi