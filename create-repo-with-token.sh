#!/bin/bash

# 使用 GitHub Token 创建仓库的脚本

if [ -z "$GH_TOKEN" ]; then
    echo "请先设置 GitHub Token:"
    echo "export GH_TOKEN=your_github_token_here"
    echo ""
    echo "获取 Token 的方法："
    echo "1. 访问 https://github.com/settings/tokens"
    echo "2. 点击 'Generate new token (classic)'"
    echo "3. 选择 'repo' 权限"
    echo "4. 复制生成的 token"
    exit 1
fi

echo "使用 Token 登录 GitHub..."
echo "$GH_TOKEN" | gh auth login --with-token

if [ $? -eq 0 ]; then
    echo "✅ 登录成功！"
    echo "正在创建仓库..."
    gh repo create cloudflare-demo --public --source=. --remote=origin --push
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ 成功！仓库已创建并推送代码"
        REPO_URL=$(gh repo view cloudflare-demo --json url -q .url)
        echo "仓库地址: $REPO_URL"
    else
        echo "❌ 创建仓库失败"
        exit 1
    fi
else
    echo "❌ 登录失败，请检查 Token 是否正确"
    exit 1
fi

