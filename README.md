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

### 自动创建仓库（推荐）

运行以下脚本自动创建 GitHub 仓库并推送代码：

```bash
./setup-github.sh
```

如果首次使用，脚本会引导你完成 GitHub 认证。

### 使用 GitHub Token（无需浏览器）

1. 在 https://github.com/settings/tokens 创建 token（需要 `repo` 权限）
2. 运行：
```bash
export GH_TOKEN=your_token_here
./setup-github.sh
```

### 手动设置

1. 在 GitHub 上创建新仓库（名为 `cloudflare-demo`）
2. 运行以下命令：
```bash
git remote add origin https://github.com/YOUR_USERNAME/cloudflare-demo.git
git branch -M main
git push -u origin main
```

## 使用 Cloudflare Pages

1. 将代码推送到 GitHub（使用上面的步骤）
2. 在 Cloudflare Dashboard 中连接到 GitHub 仓库
3. 选择此仓库并部署

