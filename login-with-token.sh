#!/bin/bash

# 使用 GitHub Token 登录的简单脚本

echo "=========================================="
echo "GitHub CLI Token 登录"
echo "=========================================="
echo ""
echo "如果你还没有 Token，请先："
echo "1. 访问 https://github.com/settings/tokens"
echo "2. 点击 'Generate new token (classic)'"
echo "3. 勾选 'repo' 权限"
echo "4. 生成并复制 token"
echo ""
echo "=========================================="
echo ""

if [ -z "$GH_TOKEN" ]; then
    echo "请输入你的 GitHub Token:"
    read -s TOKEN
    echo ""
    
    if [ -z "$TOKEN" ]; then
        echo "❌ Token 不能为空"
        exit 1
    fi
    
    echo "正在使用 Token 登录..."
    echo "$TOKEN" | gh auth login --with-token
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ 登录成功！"
        echo ""
        echo "验证登录状态："
        gh auth status
    else
        echo ""
        echo "❌ 登录失败，请检查 Token 是否正确"
        exit 1
    fi
else
    echo "检测到环境变量 GH_TOKEN，正在登录..."
    echo "$GH_TOKEN" | gh auth login --with-token
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ 登录成功！"
        gh auth status
    else
        echo ""
        echo "❌ 登录失败，请检查 Token 是否正确"
        exit 1
    fi
fi

