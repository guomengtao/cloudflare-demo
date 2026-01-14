# Backblaze B2 图片管理系统升级指南

## 概述

本项目提供了两个版本的 Backblaze B2 图片管理系统升级脚本，用于处理失踪人员信息的图片转换和上传任务。

## 脚本版本

### 1. 简化版本 (`upgrade-b2-image-manager-simple.js`)

**适用场景**：不需要数据库连接，直接从文件或硬编码数据读取案件信息。

**主要功能**：
- 从 `cases-to-process.json` 文件加载案件数据
- 自动创建州/县/城市/案件ID的目录结构
- 图片下载（带重试机制）
- WebP格式转换
- B2批量上传
- 任务限制（每2个任务后停止）

### 2. 完整版本 (`upgrade-b2-image-manager-complete.js`)

**适用场景**：需要连接 Cloudflare D1 数据库，从数据库读取待处理案件。

**主要功能**：
- 从 Cloudflare D1 数据库获取符合条件的案件
- 条件：`image_webp_status = 0 AND html_status = 200`
- 自动更新案件状态（0→100→200）
- 统计图片数量并更新到数据库
- 图片下载、转换和B2上传
- 任务限制（每2个任务后停止）

## 环境配置

### 1. 安装依赖

```bash
npm install
npm install sharp
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件，配置以下内容：

```dotenv
# Backblaze B2 配置
B2_BUCKET_NAME=your-bucket-name
B2_ENDPOINT=https://s3.your-region.backblazeb2.com
B2_ACCESS_KEY_ID=your-access-key-id
B2_SECRET_ACCESS_KEY=your-secret-access-key
B2_REGION=your-region

# Cloudflare D1 配置（完整版本需要）
CLOUDFLARE_API_KEY=your-cloudflare-api-key
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_DATABASE_ID=your-cloudflare-database-id
```

## 数据库结构

完整版本需要以下数据库表结构：

```sql
CREATE TABLE IF NOT EXISTS missing_persons_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT UNIQUE NOT NULL,
    missing_city TEXT,
    missing_county TEXT,
    missing_state TEXT,
    images_json TEXT,
    html_status INTEGER DEFAULT 0,
    image_webp_status INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    webp_images_json TEXT,
    webp_success_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 使用说明

### 使用简化版本

1. 编辑 `cases-to-process.json` 文件，添加案件数据：

```json
[
  {
    "case_id": "case-12345",
    "images_json": "[\"https://example.com/image1.jpg\", \"https://example.com/image2.jpg\"]",
    "missing_state": "California",
    "missing_county": "Los Angeles",
    "missing_city": "Los Angeles"
  }
]
```

2. 运行脚本：

```bash
node upgrade-b2-image-manager-simple.js
```

### 使用完整版本

1. 确保 Cloudflare D1 数据库已配置并包含数据
2. 运行脚本：

```bash
node upgrade-b2-image-manager-complete.js
```

## 案件状态说明

- `image_webp_status = 0`: 待处理
- `image_webp_status = 100`: 处理中
- `image_webp_status = 200`: 处理完成
- `image_webp_status = 300`: 处理失败

## 目录结构

图片会下载到以下目录结构：

```
img/
└── [missing_state]/
    └── [missing_county]/
        └── [missing_city]/
            └── [case_id]/
                ├── image-0.jpg
                ├── image-0.webp
                ├── image-1.jpg
                └── image-1.webp
```

## B2 存储路径

图片会上传到 B2 的以下路径：

```
cases/[case_id]/[image-type]-[timestamp]-[random-string].webp
```

## 注意事项

1. **AWS SDK 警告**：脚本使用 AWS SDK v2，会显示弃用警告，不影响功能
2. **下载限制**：某些网站可能会限制频繁下载，脚本已包含重试机制
3. **任务限制**：脚本会在处理完2个任务后自动停止
4. **错误处理**：脚本包含完善的错误处理，失败的案件会被标记为错误状态
5. **日志记录**：每一步操作都会在控制台打印详细日志

## 故障排除

### 1. 数据库连接失败

- 确保 Cloudflare D1 数据库已正确配置
- 确保 `wrangler` 命令已安装：`npm install -g wrangler`
- 确保已登录 Cloudflare：`wrangler login`

### 2. 图片下载失败

- 检查网络连接
- 确认图片 URL 可访问
- 某些网站可能需要特殊的 User-Agent 头

### 3. B2 上传失败

- 检查 B2 凭证是否正确
- 确保桶名称和端点配置正确
- 检查网络连接

## 升级建议

1. **使用 AWS SDK v3**：将 AWS SDK 升级到 v3 版本
2. **添加更多状态码**：细化案件处理状态
3. **添加通知功能**：处理完成后发送通知
4. **添加监控功能**：监控任务执行情况
5. **使用队列系统**：使用 Redis 或其他队列系统管理任务