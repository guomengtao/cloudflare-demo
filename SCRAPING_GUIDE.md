# MissingKids.org 数据爬取指南

## 安装依赖

```bash
# 安装Playwright和相关依赖
npm install

# 安装浏览器（Chromium）
npx playwright install
```

## 运行爬虫

### 基础版本
```bash
npm run scrape-missingkids
```

### 增强版本（推荐）
```bash
node scrape-missingkids-enhanced.js
```

## 爬取的数据字段

每个失踪儿童案件包含以下信息：
- **姓名**：失踪儿童的姓名
- **案件号**：NCMC或AMBER案件编号
- **年龄**：失踪时的年龄
- **失踪日期**：最后被见到的时间
- **地点**：失踪地点
- **照片链接**：最多3张照片的URL
- **详情页地址**：完整案件信息的页面链接
- **描述**：案件的基本描述

## 输出文件

爬取的数据将保存为JSON格式：
- `missingkids-data.json` - 基础版本输出
- `missingkids-enhanced-data.json` - 增强版本输出

## 注意事项

1. **尊重网站**：爬取时添加适当延迟，避免对服务器造成压力
2. **数据用途**：仅用于公益目的，帮助寻找失踪儿童
3. **更新频率**：建议每周运行一次以获取最新数据
4. **错误处理**：脚本包含完整的错误处理和重试机制

## 自定义配置

可以修改脚本中的配置参数：
- `maxPages`: 最大爬取页数
- `delayBetweenRequests`: 请求间隔时间
- `outputFile`: 输出文件名