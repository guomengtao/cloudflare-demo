# Cloudflare Dashboard 数据库绑定说明

## ✅ 数据库已创建

数据库 `cloudflare-demo-db` 已经通过 CLI 创建成功：
- **数据库 ID**: `1c5802dd-3bd6-4804-9209-8bc4c26cc40b`
- **数据库名称**: `cloudflare-demo-db`

## 在 Dashboard 中查看数据库

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择你的账户
3. 在左侧菜单中找到 **Workers & Pages**
4. 点击 **D1** 或 **Databases**
5. 你应该能看到 `cloudflare-demo-db` 数据库

## 绑定数据库到 Pages 项目（重要！）

这是让数据库在 Pages 中工作的关键步骤：

### 方法 1：通过 Dashboard（推荐）

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Pages**
3. 点击你的项目 `cloudflare-demo`
4. 进入 **Settings** 标签
5. 滚动到 **Functions** 部分
6. 找到 **D1 Database Bindings**
7. 点击 **Add binding**
8. 填写：
   - **Variable name**: `DB` （必须与代码中的 binding 名称一致）
   - **Database**: 选择 `cloudflare-demo-db`
9. 点击 **Save**

### 方法 2：通过 wrangler.toml（已配置）

数据库配置已经在 `wrangler.toml` 中设置好了：
```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudflare-demo-db"
database_id = "1c5802dd-3bd6-4804-9209-8bc4c26cc40b"
```

但是，**Pages 项目需要在 Dashboard 中手动绑定**，因为 Pages 的绑定配置是独立的。

## 验证数据库是否工作

绑定完成后，访问：
- Database Demo: https://cloudflare-demo-qhe.pages.dev/database.html
- Chat Demo: https://cloudflare-demo-qhe.pages.dev/chat.html

如果仍然看到 "Database not configured" 错误，请检查：
1. 绑定名称是否为 `DB`（大写）
2. 数据库是否已正确绑定到 Pages 项目
3. 等待几分钟让配置生效

## 查看数据库数据

在 Dashboard 中：
1. 进入 **Workers & Pages** → **D1**
2. 点击 `cloudflare-demo-db`
3. 点击 **Query** 标签
4. 可以运行 SQL 查询，例如：
   ```sql
   SELECT * FROM items;
   SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 10;
   ```

## 本地开发测试

使用本地数据库测试：
```bash
npx wrangler pages dev . --d1=DB=cloudflare-demo-db
```

使用远程数据库测试：
```bash
npx wrangler pages dev . --d1=DB=cloudflare-demo-db --remote
```

