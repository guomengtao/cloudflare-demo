#!/bin/bash

# Cloudflare Demo - GitHub 仓库设置脚本

echo "正在检查 GitHub CLI 认证状态..."

# 检查是否提供了 GitHub token
if [ -n "$GH_TOKEN" ]; then
    echo "使用提供的 GitHub token 进行认证..."
    echo "$GH_TOKEN" | gh auth login --with-token
elif ! gh auth status &>/dev/null; then
    echo "需要先登录 GitHub。"
    echo ""
    echo "方法 1: 使用浏览器登录（推荐）"
    echo "  运行: gh auth login --web"
    echo ""
    echo "方法 2: 使用 GitHub token"
    echo "  1. 在 https://github.com/settings/tokens 创建 token（需要 repo 权限）"
    echo "  2. 运行: export GH_TOKEN=your_token_here"
    echo "  3. 然后重新运行此脚本"
    echo ""
    read -p "是否现在尝试浏览器登录？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh auth login --web
    else
        echo "请先完成 GitHub 认证，然后重新运行此脚本"
        exit 1
    fi
fi

echo "正在创建 GitHub 仓库..."
gh repo create cloudflare-demo --public --source=. --remote=origin --push

if [ $? -eq 0 ]; then
    echo "✅ 成功！仓库已创建并推送代码到 GitHub"
    REPO_URL=$(gh repo view cloudflare-demo --json url -q .url)
    echo "仓库地址: $REPO_URL"
else
    echo "❌ 创建仓库失败，请检查错误信息"
    exit 1
fi

