#!/bin/bash

echo "开始导入失踪人口案件数据..."

# 1. 解析HTML文件并生成SQL
echo "步骤1: 解析HTML文件..."
node import-case-data.js

# 2. 执行SQL导入
echo "步骤2: 执行SQL导入..."
npx wrangler d1 execute cloudflare-demo-db --remote --file=import-cases.sql

echo "数据导入完成！"
