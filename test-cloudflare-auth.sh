#!/bin/bash

echo "===================================="
echo "    Cloudflare API 认证测试工具        "
echo "====================================\n"

# 检查并加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ 成功加载 .env 文件"
else
    echo "❌ 错误: .env 文件不存在"
    exit 1
fi

# 显示当前配置
 echo "📋 当前配置:"
 echo "   API 密钥: ${CLOUDFLARE_API_KEY:0:5}...${CLOUDFLARE_API_KEY: -5}"
 echo "   邮箱: ${CLOUDFLARE_AUTH_EMAIL:-"未设置"}"
 echo "   Zone ID: ${CLOUDFLARE_ZONE_ID:-"未设置"}"
 echo "   账户 ID: ${CLOUDFLARE_ACCOUNT_ID:-"未设置"}"

# 检查必要参数
if [ -z "$CLOUDFLARE_API_KEY" ]; then
    echo "\n❌ 错误: 缺少 CLOUDFLARE_API_KEY"
    exit 1
fi

if [ -z "$CLOUDFLARE_AUTH_EMAIL" ]; then
    echo "\n❌ 错误: 缺少 CLOUDFLARE_AUTH_EMAIL"
    echo "   请在 .env 文件中设置您的 Cloudflare 登录邮箱"
    exit 1
fi

if [ -z "$CLOUDFLARE_ZONE_ID" ]; then
    echo "\n❌ 错误: 缺少 CLOUDFLARE_ZONE_ID"
    echo "   请在 .env 文件中设置您的 Cloudflare Zone ID"
    echo "   Zone ID 可以在 Cloudflare 控制面板 -> 网站 -> 概述 -> 右侧面板中找到"
    exit 1
fi

echo "\n✅ 所有必要参数已设置"

# 测试 Cloudflare API 认证
echo "\n🚀 正在测试 Cloudflare API 认证..."

# 发送一个简单的 API 请求来验证认证
test_response=$(curl -s -w "\n%{http_code}" -X GET "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}" \
    -H "X-Auth-Email: ${CLOUDFLARE_AUTH_EMAIL}" \
    -H "X-Auth-Key: ${CLOUDFLARE_API_KEY}")

# 分离响应内容和状态码
# 兼容 Mac 的方式：使用 awk 而不是 head -n -1
if [[ "$OSTYPE" == "darwin"* ]]; then
    test_body=$(echo "$test_response" | sed '$d')
    test_status=$(echo "$test_response" | tail -n 1)
else
    test_body=$(echo "$test_response" | head -n -1)
    test_status=$(echo "$test_response" | tail -n 1)
fi

if [ "$test_status" -eq 200 ]; then
    echo "✅ API 认证成功!"
    echo "📊 响应状态码: $test_status"
    echo "\n📝 测试结果:"
    echo "$test_body" | jq '.result.name' 2>/dev/null || echo "$test_body"
else
    echo "❌ API 认证失败!"
    echo "📊 响应状态码: $test_status"
    echo "\n📝 错误信息:"
    echo "$test_body" | jq '.errors' 2>/dev/null || echo "$test_body"
    echo "\n🔍 可能的原因:"
    echo "   1. 邮箱地址不正确"
    echo "   2. API 密钥不是 Global API Key"
    echo "   3. Zone ID 不正确"
    echo "   4. API 密钥没有足够的权限"
    
    echo "\n💡 解决方法:"
    echo "   1. 确认您的 Cloudflare 登录邮箱正确"
    echo "   2. 确保使用的是 Global API Key (不是 API Token)"
    echo "      - 访问: https://dash.cloudflare.com/profile/api-tokens"
    echo "      - 在 'API Keys' 部分找到 'Global API Key'"
    echo "   3. 确认 Zone ID 正确 (控制面板 -> 网站 -> 概述)"
    echo "   4. 检查 API 密钥的权限设置"
fi

echo "\n===================================="
echo "           测试完成                   "
echo "===================================="