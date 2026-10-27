// @ts-check
import { defineConfig } from 'astro/config';

/**
 * 部署到子路径站点（例如 GitHub Pages 的项目站点 https://user.github.io/repo/）时，
 * 用环境变量指定 base，例如 PUBLIC_BASE_PATH=/repo-name。
 * 本地开发默认 base = '/'。
 */
const base = process.env.PUBLIC_BASE_PATH?.trim() || '/';
const site = process.env.PUBLIC_SITE_URL?.trim() || undefined;

export default defineConfig({
  site,
  base,
  // 统一使用带斜杠的地址：GitHub Pages / 静态托管都会把 /foo 重定向到 /foo/
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'auto',
  },
});
