# Pipeline 架构说明

## 架构概述

本项目采用三层架构设计，旨在解决原有系统耦合度过高和容错性差的问题，实现"错则停、不干预、自动化流水线"的目标。

### 三层模型

1. **控制器层 (The Orchestrator)**
   - `pipeline.js` (原 `task-run.js`)
   - 职责：最高指挥官，负责无限循环、错误捕获、轮次统计
   - 逻辑：调用 `processor.js`，如果返回失败，记录原因，等待N秒后开始下一轮

2. **核心逻辑层 (The Processor)**
   - `processor.js` (原 `orm-run-webp.js`)
   - 职责：定义"5个关键步骤"
   - 逻辑：顺序调用服务层，一旦某一步出错（throw error），立即停止后续步骤

3. **服务抽象层 (The Services)**
   - `service-db.js` (原 `task-gh-id.js` + 数据库查询)
     - 职责：与 Cloudflare D1 交互，提供 `getCurrentId()` 和 `updateId(max_id)`
   - `service-image.js` (原 `webp.js`)
     - 职责：下载、转换、清理临时文件
   - `service-b2.js` (原 `b2-image-manager.js`)
     - 职责：负责 Backblaze B2 的上传和 URL 生成

## 文件说明

### pipeline.js

任务总控，负责：
- 无限循环执行任务
- 错误捕获和处理
- 轮次统计和状态显示
- 等待时间管理

**使用方法：**
```bash
node pipeline.js [min_wait] [max_wait]
```

**参数说明：**
- `min_wait`：成功后最小等待秒数（默认：9）
- `max_wait`：成功后最大等待秒数（默认：18）

### processor.js

核心逻辑处理器，定义了5个关键步骤：
1. 获取当前进度ID
2. 从数据库拉取案件数据
3. 从HTML中提取有效图片URL
4. 处理并上传图片到B2存储
5. 更新数据库进度

### service-db.js

数据库服务，负责：
- 获取当前进度ID
- 提交进度ID（原子化增加）
- 获取案件内容
- 获取案件信息
- 更新案件统计信息

### service-image.js

图片服务，负责：
- 从HTML中提取有效图片URL
- 转换图片为WebP格式
- 清理临时文件

### service-b2.js

B2存储服务，负责：
- 上传图片到B2存储
- 生成B2存储的URL

## 架构优势

1. **文件职责清晰**
   - 想改上传逻辑？只动 `service-b2.js`
   - 想改进度算法？只动 `service-db.js`

2. **错误隔离**
   - 如果B2超时，错误会从 `service-b2` 抛出，被 `pipeline.js` 捕获
   - `processor.js` 后面的步骤永远不会被执行，进度被锁死在原地

3. **禁止干预**
   - 主逻辑里没有任何默认返回1的代码
   - 数据库服务层只接受"成功后的数字"

## 运行方式

### 开发环境

```bash
cd /Users/Banner/Documents/tom
node pipeline/pipeline.js
```

### 生产环境

```bash
cd /Users/Banner/Documents/tom
NODE_ENV=production node pipeline/pipeline.js 15 30
```

## 监控与日志

- 使用 `consola` 库进行日志记录
- 显示轮次统计信息（成功、跳过、无图片、错误）
- 显示倒计时信息
- 生产环境日志级别更低，减少输出

## 注意事项

1. 确保已安装所有依赖：`npm install`
2. 确保已配置好环境变量（`.env` 文件）
3. 确保 `task-gh-id.js` 等原有文件仍然存在且可正常工作
4. 首次运行时，会从数据库获取当前进度ID，不会默认从1开始

## 与原有架构的兼容性

新架构保留了对原有核心功能的兼容：
- 仍然使用 Cloudflare D1 作为数据库
- 仍然使用 Backblaze B2 作为存储
- 仍然使用相同的图片转换逻辑
- 仍然使用 `task-gh-id.js` 进行进度管理

但改进了架构设计，提高了代码的可维护性和容错性。