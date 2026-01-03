# Cloudflare Demo Project

一个简单的 Cloudflare Pages 演示项目。

## 功能

- 显示 "hello" 页面

## 本地开发

```bash
npm install
npm run dev
```

## 部署

```bash
npm run deploy
```

## GitHub 设置

### 方法 1：使用 GitHub Token（推荐，最快）

1. **获取 GitHub Token**：
   - 访问 https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 勾选 `repo` 权限
   - 点击 "Generate token" 并复制 token

2. **运行脚本**：
```bash
export GH_TOKEN=your_token_here
./create-repo-with-token.sh
```

### 方法 2：浏览器登录

运行脚本并按照提示在浏览器中完成登录：

```bash
./setup-github.sh
```

如果网络有问题，可以手动登录：
```bash
gh auth login --web
# 然后运行
./setup-github.sh
```

### 方法 3：手动创建（最简单）

1. **在 GitHub 上创建仓库**：
   - 访问 https://github.com/new
   - 仓库名：`cloudflare-demo`
   - 选择 Public
   - **不要**勾选 "Initialize with README"
   - 点击 "Create repository"

2. **推送代码**：
```bash
git remote add origin https://github.com/YOUR_USERNAME/cloudflare-demo.git
git branch -M main
git push -u origin main
```

将 `YOUR_USERNAME` 替换为你的 GitHub 用户名。

## 使用 Cloudflare Pages

1. 将代码推送到 GitHub（使用上面的步骤）
2. 在 Cloudflare Dashboard 中连接到 GitHub 仓库
3. 选择此仓库并部署

