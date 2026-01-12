# Cloudflare API 配置指南

本指南将帮助您正确配置 Cloudflare API 认证信息，解决当前的认证失败问题。

## 🔍 当前问题

从错误日志可以看出，认证失败的原因是：
- 邮箱地址是默认的 `your-email@example.com`
- Zone ID 是默认的 `your-zone-id`
- API 密钥可能格式不正确（错误码 6103）

## 📋 配置步骤

### 1. 获取 Cloudflare 登录邮箱

您的 Cloudflare 登录邮箱是您注册 Cloudflare 账户时使用的邮箱地址。

### 2. 获取 Global API Key

请按照以下步骤获取您的 Global API Key：

1. 访问 [Cloudflare API 令牌页面](https://dash.cloudflare.com/profile/api-tokens)
2. 使用您的 Cloudflare 账户登录
3. 在页面下方的 "API Keys" 部分找到 "Global API Key"
4. 点击 "View" 按钮
5. 输入您的 Cloudflare 密码进行验证
6. 复制显示的 Global API Key（长字符串）

**注意：** 不要使用 "API Token"，必须使用 "Global API Key"！

### 3. 获取 Zone ID

Zone ID 是您的网站在 Cloudflare 中的唯一标识符：

1. 登录 Cloudflare 控制面板
2. 选择您要查询统计数据的网站
3. 点击左侧菜单中的 "概述"（Overview）
4. 在右侧面板中找到 "Zone ID"
5. 点击右侧的复制按钮复制 Zone ID

### 4. 更新 .env 文件

使用文本编辑器打开 `.env` 文件，更新以下参数：

```
# Cloudflare API 配置
CLOUDFLARE_API_KEY=您刚才复制的Global API Key
CLOUDFLARE_ACCOUNT_ID=您的账户ID（可选，当前已设置）
CLOUDFLARE_DATABASE_ID=您的数据库ID（可选，当前已设置）
# Cloudflare GraphQL API 配置
CLOUDFLARE_AUTH_EMAIL=您的Cloudflare登录邮箱
CLOUDFLARE_ZONE_ID=您刚才复制的Zone ID
```

**示例：**
```
# Cloudflare API 配置
CLOUDFLARE_API_KEY=JBEhiZd0YGD_DexvDpVEH6Xk89p43LjNj0ng1Grq
CLOUDFLARE_ACCOUNT_ID=197ff91e7b8164532e5a54f708eb14a0
CLOUDFLARE_DATABASE_ID=1c5802dd-3bd6-4804-9209-8bc4c26cc40b
# Cloudflare GraphQL API 配置
CLOUDFLARE_AUTH_EMAIL=myemail@example.com
CLOUDFLARE_ZONE_ID=9a7f8b6c5d4e3f2a1b0c9d8e7f6a5b4c
```

## 🧪 测试配置

配置完成后，您可以运行以下命令测试认证是否成功：

```bash
./test-cloudflare-auth.sh
```

如果认证成功，您将看到类似以下输出：

```
✅ API 认证成功!
📊 响应状态码: 200
📝 测试结果:
"your-email@example.com"
"your-username"
```

## 🚀 运行统计查询

认证成功后，您可以运行以下命令查询统计数据：

```bash
./query-cloudflare-stats.sh
```

## 💡 常见问题解答

### Q: 我仍然收到 "Invalid format for X-Auth-Key header" 错误

**A:** 请确认您使用的是 **Global API Key**，而不是 **API Token**。Global API Key 是一个长字符串，而 API Token 是格式化的字符串。

### Q: 我找不到 Zone ID

**A:** 请确保您已经选择了一个网站，Zone ID 只在具体网站的概述页面显示。

### Q: 我收到 "Zone not found" 错误

**A:** 请确认您的 Zone ID 正确，并且您的 API 密钥对该 Zone 有访问权限。

## 📄 参考链接

- [Cloudflare API 文档](https://developers.cloudflare.com/api/)
- [获取 Global API Key](https://dash.cloudflare.com/profile/api-tokens)
- [查找 Zone ID](https://developers.cloudflare.com/fundamentals/get-started/basic-tasks/find-account-and-zone-ids/)