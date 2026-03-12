# 小红书海报生成器 (Next.js 版)

这是一个使用 Next.js + Tailwind CSS 制作的小红书长图海报批量生成器。
通过输入长篇干货文章，接入火山引擎大模型流式输出 AI 重构的结构化数据，前端利用 HTML2Canvas 实现可视化排版编辑与批量切图下载。

## 【重要】使用前必读：关于安全与环境变量
为了保障您的 API Key 不会直接泄露在前端浏览器代码中，本版本已全面升级到 Next.js 全栈架构，把对大模型的请求封装到了后端的 `/api/generate` 路由。

**本地运行步骤**：
1. 请复制 `.env.example` 为 `.env.local`。
2. 在 `.env.local` 中填入你的火山引擎 API KEY (`VOLCENGINE_API_KEY=xxx`)。
3. 执行 `npm run dev` 即可开始本地开发预览。

## 部署到 Cloudflare Pages 的教程

本项目已经全面兼容 Next.js App Router 并且可以无缝部署到 Cloudflare Pages 享受免费全球 CDN 加速。

### 步骤 1：上传代码到 GitHub
只要您看到这份文档，说明代码已经在您的仓库 `xiaoshongshuautomake` 中。无需任何修改。

### 步骤 2：在 Cloudflare 创建项目
1. 登录 Cloudflare 控制台，选择左侧菜单的 **Workers & Pages** -> **Pages**。
2. 点击 **Connect to Git (连接到 Git)**，授权并选择 `NBananapie/xiaoshongshuautomake` 这个仓库。
3. 点击 **Begin setup (开始设置)**。

### 步骤 3：配置构建命令与环境变量 (🔥 最关键一步)

在构建设置页面，请确认以下设置正确：
- **Framework preset (框架预设)**: `Next.js`
- **Build command (构建命令)**: `npm run build`
- **Build output directory (构建输出目录)**: `.vercel/output/static` (Cloudflare 会自动识别 Next 预设生成该目录，若识别失败也可保持空白或默认值，通常选择 `Next.js` 预设即可无需干预)。

展开底部的 **Environment variables (环境变量)** 面板，添加以下变量：

| Variable name (变量名) | Value (值) |
| :--- | :--- |
| `VOLCENGINE_API_KEY` | `【填入您在火山引擎申请的 真实的 API_KEY】` |
| `NODE_VERSION` | `20` (推荐，Next.js14+对Node版本有要求) |

### 步骤 4：保存并部署
点击 **Save and Deploy (保存并部署)**。
等待几分钟后，Cloudflare 会生成一个类似 `https://xiaoshongshuautomake.pages.dev` 的链接，你的海报生成器就正式上线了！而且前端完全看不到 API Key，非常安全。

---

## 项目功能特性继承
- 全面继承了直觉式的 **"全局组拖拽 + 子元素独立微调拖拉"** 逻辑。
- 全面继承了 **"原图直接拖动，双击即可无缝进入编辑打字，失焦即变回模块"** 的类似 PPT 控制手感。
- 全面继承了 **"右侧吸附式十几种精调配色主题栏与批量应用机制"**。
- 支持暗黑赛博/新春大红等跨页渐变色和颜色风格Prompt强制注入。
