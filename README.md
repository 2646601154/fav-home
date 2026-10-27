# 个人数字花园 / 导航主页

一个静态的个人主页，把三类东西放在一起：

- **GitHub Star 项目**：GitHub Actions 每天自动同步，前端只读 `public/data/stars.json`。
- **收藏网站**：手工维护。
- **Skills / MCP**：手工维护，带安装命令、客户端配置 JSON、路径提示，可一键复制。

技术栈：Astro（最新稳定版）+ TypeScript + 原生 CSS，零 UI 框架、零后端、零数据库。

## 特性

- 四个板块：Star 项目 / 收藏网站 / Skills / MCP，每个板块带数量。
- 搜索框同时匹配名称、备注、标签、star 描述（多关键词用空格分隔，全部命中才显示）。
- 分类筛选；Star 板块按语言筛选。
- 深色 / 浅色模式，跟随系统、记住选择、无闪屏。
- Skills / MCP 的“安装方式”默认折叠，命令与 JSON 配置都能复制（**只复制，不执行**）。
- MCP 配置里的密钥全部是 `${PLACEHOLDER}` 占位符，页面会提示替换。
- 移动端单列、平板两列、桌面三列；键盘可操作，`/` 聚焦搜索框。
- 构建期校验 `data/items.yml`：类型写错、缺字段、`install.kind` 非法都会让构建失败并指出第几条。

## 目录结构

```text
.
├─ data/
│  └─ items.yml                 # 手工维护：website / skill / mcp
├─ public/
│  ├─ data/stars.json           # Actions 生成（仓库里先放了 mock）
│  ├─ favicon.svg
│  └─ .nojekyll                 # GitHub Pages 需要（否则下划线开头的资源会 404）
├─ scripts/
│  └─ sync-stars.mjs            # 拉取 /user/starred 生成 stars.json
├─ src/
│  ├─ components/
│  │  ├─ CopyButton.astro
│  │  ├─ InstallBlock.astro
│  │  ├─ ItemCard.astro
│  │  ├─ SearchBar.astro
│  │  ├─ SectionTabs.astro
│  │  └─ ThemeToggle.astro
│  ├─ lib/
│  │  ├─ items.ts               # 解析 + 校验 items.yml
│  │  └─ stars.ts               # stars.json 的类型、语言颜色
│  ├─ pages/index.astro
│  ├─ scripts/app.ts            # 主题 / Tab / 搜索筛选 / 复制 / Star 渲染
│  ├─ styles/global.css
│  └─ site.config.ts            # 昵称、简介、头像、GitHub 链接
├─ .github/workflows/
│  ├─ deploy.yml                # 构建并部署到 GitHub Pages
│  └─ sync-stars.yml            # 每天同步 Star + 手动触发
├─ astro.config.mjs
├─ package.json
└─ tsconfig.json
```

## 本地运行

需要 Node 20+（CI 用 22）。

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 产物在 dist/
npm run preview  # 预览构建产物
npm run check    # TypeScript / Astro 类型检查（可选）
```

## 改个人信息

编辑 `src/site.config.ts`：昵称、首字母、简介、GitHub 主页、头像、页脚。头像留空就用昵称首字母占位。

## 维护 `data/items.yml`

统一用 `items` 数组，用 `type` 区分：

```yaml
items:
  - type: website          # website | skill | mcp
    name: Excalidraw
    url: https://excalidraw.com
    category: 工具
    tags: [绘图, 白板]
    note: 手绘风格白板
    icon: https://excalidraw.com/favicon.ico   # 可选，仅 website；加载失败自动回退首字母
```

skill / mcp 额外需要 `install`：

```yaml
  - type: mcp
    name: filesystem
    url: https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
    category: 文件系统
    tags: [官方, 本地]
    note: 读写本地文件
    install:
      kind: npx          # npx | uvx | shell | docker | config-only
      command: npx -y @modelcontextprotocol/server-filesystem /path/to/dir
      config:            # 可以直接写 YAML 对象，也可以写一段 JSON 字符串
        mcpServers:
          filesystem:
            command: npx
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir']
      path_hint: 将 /path/to/dir 替换为你自己的目录
```

规则：

- `type` 只能是 `website` / `skill` / `mcp`。
- `install.kind` 只能是 `npx` / `uvx` / `shell` / `docker` / `config-only`；`config-only` 必须提供 `config`。
- `config` 是 YAML 对象或 JSON 字符串都可以，页面统一格式化成多行 JSON 再展示和复制（Astro 会做 HTML 转义，不会破坏页面）。
- **密钥只写占位符**：`${GITHUB_TOKEN}`、`${API_KEY}`。构建时如果发现 `env` 里像真实密钥的值，会在控制台警告。
- 分类和标签随意填，分类会自动出现在筛选条里。

改完跑一次 `npm run build`，校验失败会直接报第几条、哪个字段。

## Star 自动同步

### 1. 生成只读 PAT

默认的 `GITHUB_TOKEN` 只能访问当前仓库，**不能**代表你去读 `/user/starred`，所以需要一个 PAT：

- classic token：勾选 `read:user` 即可。
- fine-grained token：给该账号 “Starring” 读取权限（以及读取公开资料）。

千万不要给写权限，也不要用 `repo` 全权限。

### 2. 配置 Secret

仓库 **Settings → Secrets and variables → Actions → New repository secret**：

- Name: `STAR_TOKEN`
- Value: 上一步的 PAT

### 3. 手动触发一次

**Actions → Sync GitHub stars → Run workflow**（分支选 `main`）。

工作流行为：

- 每天 UTC 03:17 自动跑一次，也支持手动触发。
- 分页调用 `GET /user/starred?per_page=100&page=N` 拉全部 Star，写回 `public/data/stars.json` 并提交。
- 没有变化就不提交。
- `STAR_TOKEN` 缺失时工作流**直接失败**并给出提示，不会生成空数据；拉到 0 个 Star 也不会覆盖旧文件。
- Token 只从 Secret 注入环境变量，命令里不打印、不 `echo`，日志里也没有。

本地想试一下：

```bash
# macOS / Linux
STAR_TOKEN=ghp_xxx node scripts/sync-stars.mjs

# PowerShell
$env:STAR_TOKEN="ghp_xxx"; node scripts/sync-stars.mjs
```

### stars.json 结构

```json
{
  "updated_at": "2026-01-01T00:00:00Z",
  "items": [
    {
      "name": "repo-name",
      "full_name": "owner/repo-name",
      "html_url": "https://github.com/owner/repo-name",
      "description": "repo description",
      "language": "TypeScript",
      "stargazers_count": 1234,
      "updated_at": "2025-12-31T00:00:00Z",
      "topics": ["tag1", "tag2"],
      "archived": false,
      "fork": false
    }
  ]
}
```

页面 `fetch` 这个文件渲染卡片；加载失败（首次部署还没同步、路径不对、网络问题）会显示重试提示，不影响网站 / Skills / MCP 三个板块。

## 部署

### GitHub Pages（推荐，已内置工作流）

1. 把仓库推送到 GitHub，默认分支为 `main`。
2. **Settings → Pages → Build and deployment → Source 选 “GitHub Actions”**。
3. push 后 `.github/workflows/deploy.yml` 会自动构建并发布。

`deploy.yml` 会自己判断部署路径：

- 仓库叫 `<owner>.github.io` → `PUBLIC_BASE_PATH=/`
- 其他仓库 → `PUBLIC_BASE_PATH=/<repo>`

本地模拟子路径构建：

```bash
# PowerShell
$env:PUBLIC_BASE_PATH="/my-homepage"
npm run build
```

### Vercel

导入仓库即可，框架预设选 **Astro**（Build Command `npm run build`，Output Directory `dist`）。部署在根路径，不需要设置 `PUBLIC_BASE_PATH`。

### Cloudflare Pages

- Framework preset: **Astro**
- Build command: `npm run build`
- Build output directory: `dist`
- 根路径部署，不需要 `PUBLIC_BASE_PATH`。

### 其他静态托管

`npm run build` 后把 `dist/` 扔到任意静态服务器即可；如果是子路径，构建前设置 `PUBLIC_BASE_PATH=/子路径`。

## 安全约定

- 仓库里没有任何真实 Token / API Key；MCP `env` 只出现 `${PLACEHOLDER}`。
- 页面不实现服务端执行、不实现一键安装；复制按钮只写剪贴板（`navigator.clipboard.writeText`，非 https 环境回退到 `execCommand`）。
- GitHub Actions 日志不输出 Token；`.env*` 已在 `.gitignore` 中。
- `stars.json` 由服务端 Action 生成，前端不直接请求 GitHub API，也没有任何 Token 暴露在浏览器里。
