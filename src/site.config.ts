/**
 * 站点个人信息：改这一个文件就够了。
 * 头像留空时用昵称首字母占位，不请求任何外部图片。
 */
export const siteConfig = {
  /** 昵称 / 站点名 */
  name: 'Xiaruoxin',
  /** 首字母占位；留空自动取 name 的第一个字符 */
  initials: 'X',
  /** 一句简介 */
  bio: '在收集好用的工具、Skill 和 MCP，顺手整理成一张可以搜索的索引。',
  /** GitHub 主页 */
  github: 'https://github.com/2646601154',
  /** 头像地址，留空用首字母占位，例如 /avatar.png 或完整 https 链接 */
  avatar: '',
  /** 页面标题 */
  title: 'My Digital Garden',
  /** 页面描述 */
  description: '个人数字花园：GitHub Star 项目、收藏网站、Skills 与 MCP 的导航页。',
  /** 页脚一句话 */
  footer: '用 Astro 构建，数据来自 GitHub Stars 与手工维护的 items.yml。',
} as const;
