#!/bin/bash

# 快速登录脚本 - 使用环境变量中的 Token

if [ -z "$GH_TOKEN" ]; then
    echo "请先设置 GH_TOKEN 环境变量："
    echo ""
    echo "export GH_TOKEN=你的实际token"
    echo ""
    echo "然后重新运行此脚本，或直接运行："
    echo "echo \"\$GH_TOKEN\" | gh auth login --with-token"
    exit 1
fi

echo "使用环境变量中的 Token 登录..."
echo "$GH_TOKEN" | gh auth login --with-token

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 登录成功！"
    echo ""
    gh auth status
else
    echo ""
    echo "❌ 登录失败，请检查 Token 是否正确"
    exit 1
fi

