#!/bin/bash

echo "正在安装Playwright依赖..."
npm install playwright

echo "正在安装浏览器..."
npx playwright install

echo "安装完成！"
echo "运行爬虫: npm run scrape-missingkids"
