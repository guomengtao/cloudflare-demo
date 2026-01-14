# Backblaze B2 图片存储部署指南

## 项目概述
为失踪人口数据库提供企业级图片存储解决方案，结合 Backblaze B2 和 Cloudflare CDN，实现高性能、低成本、高可用的图片服务。

## 已创建的文件

### 核心文件
1. **`b2-image-manager.js`** - Backblaze B2 图片管理系统
   - 批量上传功能
   - CDN URL 生成
   - 图片映射管理
   - 统计和监控

2. **`b2-cdn-worker.js`** - Cloudflare Workers CDN 脚本
   - 图片优化和转换
   - 全球CDN加速
   - 缓存策略
   - 错误处理

3. **`b2-image-integration.html`** - 前端集成示例
   - 响应式图片加载
   - 懒加载实现
   - 性能监控
   - 错误处理

## 部署步骤

### 第一步：Backblaze B2 配置

1. **登录 Backblaze 控制台**
   - 访问: https://secure.backblaze.com
   - 使用现有账户或注册新账户

2. **创建存储桶**
   ```
   桶名称: gudq-missing-assets
   类型: Public (公开访问)
   区域: US East (推荐)
   ```

3. **获取应用密钥**
   - 进入 "Application Keys" 页面
   - 创建新的应用密钥
   - 记录以下信息：
     ```
     keyID: c6790dd2f167 (已提供)
     applicationKey: [新生成的密钥]
     endpoint: s3.us-east-005.backblazeb2.com
     ```

### 第二步：Cloudflare Workers 配置

1. **注册 Cloudflare 账户**
   - 访问: https://dash.cloudflare.com
   - 免费计划即可满足需求

2. **添加自定义域名**
   - 在 Cloudflare 中添加域名: `missingpersonsdb.com`
   - 按照指引修改DNS记录

3. **部署 Workers 脚本**
   - 进入 Workers 控制台
   - 创建新的 Worker
   - 名称: `b2-images-cdn`
   - 粘贴 `b2-cdn-worker.js` 内容
   - 部署

4. **配置自定义域名**
   - 在 Worker 设置中添加自定义域名
   - 域名: `images.missingpersonsdb.com`
   - SSL: Full (严格)

### 第三步：环境配置

1. **设置环境变量**
   ```bash
   # 在终端中执行
export B2_ACCESS_KEY_ID=c6790dd2f167
export B2_SECRET_ACCESS_KEY=你的应用密钥
export B2_BUCKET_NAME=gudq-missing-assets
   ```

2. **安装依赖**
   ```bash
   npm install aws-sdk
   ```

### 第四步：图片上传

1. **准备图片文件**
   - 组织图片目录结构:
   ```
   images/
   ├── romaldo-astran/
   │   ├── profile.jpg
   │   ├── evidence-1.jpg
   │   └── evidence-2.jpg
   ├── john-doe/
   │   ├── profile.jpg
   │   └── last-seen.jpg
   ```

2. **执行批量上传**
   ```bash
   node b2-image-manager.js
   ```

3. **验证上传结果**
   - 检查控制台输出
   - 查看生成的 `missing-persons-image-map.json`

## 技术架构

### 数据流图
```
用户请求 → Cloudflare CDN → 图片优化 → Backblaze B2 → 返回优化图片
```

### URL 结构示例
```
原始B2 URL: https://f005.backblazeb2.com/file/gudq-missing-assets/cases/romaldo-astran/profile-1640995200000-abc123.jpg

CDN URL: https://images.missingpersonsdb.com/cases/romaldo-astran/profile-1640995200000-abc123.jpg

优化URL: https://images.missingpersonsdb.com/cases/romaldo-astran/profile-1640995200000-abc123.jpg?width=600&format=webp
```

## 性能优化

### 图片格式支持
- **WebP**: 现代浏览器首选，体积减少30-50%
- **AVIF**: 最新格式，最佳压缩比
- **JPEG/PNG**: 兼容性备用

### 尺寸优化
- **缩略图**: 300px宽度，移动端使用
- **中等尺寸**: 600px宽度，平板使用
- **大尺寸**: 1200px宽度，桌面端使用

### 缓存策略
- **浏览器缓存**: 1天 (max-age=86400)
- **CDN缓存**: 1天
- **条件请求**: 支持 If-Modified-Since

## 成本估算

### Backblaze B2 成本
```
存储成本: 5万张图片 × 500KB/张 = 25GB × $0.005/GB = $0.125/月
下载成本: 100万次请求/月 × $0.01/1000次 = $10/月
总成本: 约 $10.13/月
```

### Cloudflare 成本
- Workers: 免费额度 100,000次/天
- CDN: 免费额度充足
- 自定义域名: 免费

## 监控和维护

### 关键指标监控
- 图片加载成功率
- 平均加载时间
- 存储使用量
- 请求频率

### 定期维护任务
- 每月检查存储桶使用情况
- 清理过期或无效图片
- 更新图片映射文件
- 监控CDN性能

## 故障排除

### 常见问题

1. **图片上传失败**
   - 检查应用密钥权限
   - 验证存储桶名称
   - 确认网络连接

2. **CDN访问缓慢**
   - 检查Cloudflare状态
   - 验证DNS解析
   - 测试不同地区访问

3. **图片显示异常**
   - 检查URL格式
   - 验证图片格式支持
   - 查看浏览器控制台错误

### 紧急联系方式
- Backblaze支持: https://www.backblaze.com/support.htm
- Cloudflare支持: https://support.cloudflare.com

## 安全考虑

### 访问控制
- 使用应用密钥而非主密钥
- 限制存储桶权限为公开读取
- 定期轮换密钥

### 数据保护
- 图片自动备份到Backblaze
- 使用HTTPS加密传输
- 实施防盗链措施

## 扩展计划

### 短期优化 (1-3个月)
- 实现图片自动压缩
- 添加水印功能
- 集成AI图片识别

### 长期规划 (3-6个月)
- 多区域存储部署
- 高级CDN优化
- 自动化监控告警

---

## 快速验证清单

- [ ] Backblaze B2 存储桶创建成功
- [ ] Cloudflare Workers 部署正常
- [ ] 自定义域名解析正确
- [ ] 环境变量配置完成
- [ ] 测试图片上传成功
- [ ] CDN URL 可正常访问
- [ ] 前端集成测试通过

完成以上步骤后，您的失踪人口数据库将拥有企业级的图片存储和CDN加速服务！