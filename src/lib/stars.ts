/**
 * public/data/stars.json 的结构（由 .github/workflows/sync-stars.yml 生成）。
 * 前端只读这个静态文件，不直接请求 GitHub API。
 */
export interface StarItem {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  topics: string[];
  archived: boolean;
  fork: boolean;
}

export interface StarsPayload {
  updated_at: string;
  items: StarItem[];
}

export function isStarItem(value: unknown): value is StarItem {
  if (typeof value !== 'object' || value === null) return false;
  const star = value as Record<string, unknown>;

  return (
    typeof star.name === 'string' &&
    typeof star.full_name === 'string' &&
    typeof star.html_url === 'string' &&
    typeof star.stargazers_count === 'number'
  );
}

/** 常见的语言色，用于卡片上的小圆点；未知语言用主题色 */
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Go: '#00add8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#89909a',
  'C#': '#178600',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Ruby: '#701516',
  PHP: '#4f5d95',
  Dart: '#00b4ab',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  Zig: '#ec915c',
  Lua: '#5b8ec4',
  'Jupyter Notebook': '#da5b0b',
  Dockerfile: '#384d54',
  Astro: '#ff5a03',
  Markdown: '#4a7fa5',
  Nix: '#7e7eff',
  Haskell: '#5e5086',
  Elixir: '#6e4a7e',
  Clojure: '#db5855',
  'Objective-C': '#438eff',
  PowerShell: '#012456',
};
