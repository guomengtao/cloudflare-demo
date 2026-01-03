#!/bin/bash

# GitHub CLI 登录脚本

echo "=========================================="
echo "GitHub CLI 登录"
echo "=========================================="
echo ""

# 检查是否已经登录
if gh auth status &>/dev/null; then
    echo "✅ 你已经登录了！"
    echo ""
    gh auth status
    exit 0
fi

echo "请按照以下步骤获取 GitHub Token："
echo ""
echo "1. 打开浏览器访问：https://github.com/settings/tokens"
echo "2. 点击 'Generate new token (classic)'"
echo "3. 填写 Note（任意名称，如：gh-cli）"
echo "4. 选择 Expiration（有效期）"
echo "5. 勾选 'repo' 权限（全部 repo 权限）"
echo "6. 点击 'Generate token'"
echo "7. 复制生成的 token（只显示一次！）"
echo ""
echo "=========================================="
echo ""

# 检查环境变量
if [ -n "$GH_TOKEN" ] && [ "$GH_TOKEN" != "你的实际token" ]; then
    echo "检测到环境变量 GH_TOKEN，是否使用？(y/n)"
    read -r USE_ENV
    if [[ "$USE_ENV" =~ ^[Yy]$ ]]; then
        TOKEN="$GH_TOKEN"
    else
        echo ""
        echo "请输入你的 GitHub Token:"
        read -s TOKEN
    fi
else
    echo "请输入你的 GitHub Token:"
    read -s TOKEN
fi

echo ""

if [ -z "$TOKEN" ]; then
    echo "❌ Token 不能为空"
    exit 1
fi

echo "正在登录..."
echo "$TOKEN" | gh auth login --with-token

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 登录成功！"
    echo ""
    echo "登录信息："
    gh auth status
    echo ""
    echo "现在你可以使用 gh 命令了！"
else
    echo ""
    echo "❌ 登录失败"
    echo ""
    echo "可能的原因："
    echo "1. Token 格式错误"
    echo "2. Token 已过期"
    echo "3. Token 权限不足（需要 repo 权限）"
    echo "4. 网络连接问题"
    exit 1
fi

