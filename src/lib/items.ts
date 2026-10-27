import { load } from 'js-yaml';
import itemsSource from '../../data/items.yml?raw';

export const ITEM_TYPES = ['website', 'skill', 'mcp'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const INSTALL_KINDS = ['npx', 'uvx', 'shell', 'docker', 'config-only'] as const;
export type InstallKind = (typeof INSTALL_KINDS)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  website: '网站',
  skill: 'Skill',
  mcp: 'MCP',
};

export const INSTALL_KIND_LABELS: Record<InstallKind, string> = {
  npx: 'npx',
  uvx: 'uvx',
  shell: 'shell',
  docker: 'docker',
  'config-only': '仅配置',
};

/** 形如 ${GITHUB_TOKEN} 的占位符 */
const PLACEHOLDER = /\$\{[A-Za-z0-9_]+\}/;

export interface InstallInfo {
  kind: InstallKind;
  command?: string;
  /** 结构化的客户端配置（原样来自 YAML 对象或 JSON 字符串） */
  config?: Record<string, unknown>;
  /** 已经格式化好的多行 JSON，页面直接渲染、复制 */
  configJson?: string;
  path_hint?: string;
}

export interface Item {
  /** 构建期生成的稳定 id，用于锚点 */
  id: string;
  type: ItemType;
  name: string;
  url: string;
  category: string;
  tags: string[];
  note: string;
  icon?: string;
  install?: InstallInfo;
  /** 名称 / 备注 / 分类 / 标签 / 命令的小写拼接，供前端搜索 */
  searchText: string;
  /** 命令或配置里是否还有 ${...} 占位符 */
  hasPlaceholders: boolean;
}

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class ItemConfigError extends Error {
  constructor(index: number, message: string) {
    super(`data/items.yml 第 ${index + 1} 条数据有问题：${message}`);
    this.name = 'ItemConfigError';
  }
}

function readString(
  record: RawRecord,
  key: string,
  index: number,
  options: { required?: boolean } = {},
): string | undefined {
  const { required = true } = options;
  const value = record[key];

  if (value === undefined || value === null || value === '') {
    if (required) throw new ItemConfigError(index, `缺少必填字段 "${key}"`);
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ItemConfigError(index, `字段 "${key}" 必须是字符串`);
  }

  const trimmed = value.trim();
  if (!trimmed && required) throw new ItemConfigError(index, `字段 "${key}" 不能为空`);
  return trimmed || undefined;
}

function readUrl(record: RawRecord, index: number): string {
  const value = readString(record, 'url', index)!;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ItemConfigError(index, `"url" 不是合法链接：${value}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ItemConfigError(index, `"url" 只支持 http / https：${value}`);
  }
  return value;
}

function readIcon(record: RawRecord, index: number): string | undefined {
  const value = readString(record, 'icon', index, { required: false });
  if (!value) return undefined;

  if (value.startsWith('/') || value.startsWith('data:image/')) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return value;
  } catch {
    /* 落到下面统一报错 */
  }
  throw new ItemConfigError(index, `"icon" 需要是 http(s) 链接、站内绝对路径或 data:image：${value}`);
}

function readTags(record: RawRecord, index: number): string[] {
  const value = record.tags;
  if (value === undefined || value === null) return [];

  const list = Array.isArray(value) ? value : String(value).split(/[,，]/);
  return list
    .map((tag) => {
      if (typeof tag !== 'string' && typeof tag !== 'number') {
        throw new ItemConfigError(index, '"tags" 必须是字符串数组');
      }
      return String(tag).trim();
    })
    .filter(Boolean);
}

function readInstall(value: unknown, index: number, type: ItemType): InstallInfo | undefined {
  if (value === undefined || value === null) {
    if (type !== 'website') {
      throw new ItemConfigError(index, `${type} 条目需要 "install" 配置（kind / command / config）`);
    }
    return undefined;
  }
  if (!isRecord(value)) {
    throw new ItemConfigError(index, '"install" 必须是对象');
  }

  const kindValue = value.kind;
  if (typeof kindValue !== 'string' || !(INSTALL_KINDS as readonly string[]).includes(kindValue)) {
    throw new ItemConfigError(
      index,
      `"install.kind" 只能是 ${INSTALL_KINDS.join(' / ')}，当前是 ${JSON.stringify(kindValue)}`,
    );
  }
  const kind = kindValue as InstallKind;

  const command = readString(value, 'command', index, { required: kind !== 'config-only' });
  const pathHint = readString(value, 'path_hint', index, { required: false });

  let config: Record<string, unknown> | undefined;
  let configJson: string | undefined;
  const rawConfig = value.config;

  if (rawConfig !== undefined && rawConfig !== null) {
    if (typeof rawConfig === 'string') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawConfig);
      } catch {
        throw new ItemConfigError(index, '"install.config" 是字符串但不是合法 JSON，请检查引号与逗号');
      }
      if (!isRecord(parsed)) throw new ItemConfigError(index, '"install.config" 的 JSON 必须是一个对象');
      config = parsed;
      configJson = rawConfig.trim();
    } else if (isRecord(rawConfig)) {
      config = rawConfig;
      configJson = JSON.stringify(rawConfig, null, 2);
    } else {
      throw new ItemConfigError(index, '"install.config" 必须是对象，或一段 JSON 字符串');
    }
  }

  if (kind === 'config-only' && !config) {
    throw new ItemConfigError(index, 'kind 为 config-only 时必须提供 "install.config"');
  }
  if (kind !== 'config-only' && !command && !config) {
    throw new ItemConfigError(index, '需要 "install.command" 或 "install.config" 至少一项');
  }

  if (config) {
    const suspicious = findUnmaskedEnv(config);
    if (suspicious.length > 0) {
      console.warn(
        `[items.yml] 第 ${index + 1} 条的 ${suspicious.join(', ')} 看起来是真实密钥，` +
          '请改成 ${PLACEHOLDER} 形式的占位符，不要把密钥提交进仓库。',
      );
    }
  }

  return { kind, command, config, configJson, path_hint: pathHint };
}

/** 找出 env 里不像占位符的值，构建时提醒（不阻断构建） */
function findUnmaskedEnv(value: unknown, path = 'install.config'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, i) => findUnmaskedEnv(entry, `${path}[${i}]`));
  }
  if (!isRecord(value)) return [];

  return Object.entries(value).flatMap(([key, child]) => {
    if (key === 'env' && isRecord(child)) {
      return Object.entries(child)
        .filter(([, envValue]) => {
          if (typeof envValue !== 'string') return true;
          const trimmed = envValue.trim();
          if (!trimmed) return false;
          return !PLACEHOLDER.test(trimmed) && !/^<.+>$/.test(trimmed);
        })
        .map(([envKey]) => `${path}.env.${envKey}`);
    }
    return findUnmaskedEnv(child, `${path}.${key}`);
  });
}

export function parseItems(source: string): Item[] {
  let document: unknown;
  try {
    document = load(source);
  } catch (error) {
    throw new Error(`data/items.yml 解析失败：${(error as Error).message}`);
  }

  if (!isRecord(document) || !Array.isArray(document.items)) {
    throw new Error('data/items.yml 需要顶层 `items:` 数组');
  }

  const entries = document.items;
  if (entries.length === 0) {
    throw new Error('data/items.yml 的 `items` 不能为空');
  }

  return entries.map((entry, index) => {
    if (!isRecord(entry)) throw new ItemConfigError(index, '每条数据必须是对象');

    const typeValue = readString(entry, 'type', index)!;
    if (!(ITEM_TYPES as readonly string[]).includes(typeValue)) {
      throw new ItemConfigError(index, `"type" 只能是 ${ITEM_TYPES.join(' / ')}，当前是 "${typeValue}"`);
    }
    const type = typeValue as ItemType;

    const name = readString(entry, 'name', index)!;
    const url = readUrl(entry, index);
    const category = readString(entry, 'category', index, { required: false }) ?? '未分类';
    const note = readString(entry, 'note', index, { required: false }) ?? '';
    const tags = readTags(entry, index);
    const icon = readIcon(entry, index);
    const install = readInstall(entry.install, index, type);

    const searchable = [name, note, category, tags.join(' '), install?.command ?? ''].join(' ');

    return {
      id: `${type}-${index}`,
      type,
      name,
      url,
      category,
      tags,
      note,
      icon,
      install,
      searchText: searchable.toLowerCase(),
      hasPlaceholders: PLACEHOLDER.test(`${install?.command ?? ''}\n${install?.configJson ?? ''}`),
    } satisfies Item;
  });
}

export function groupByType(list: Item[]): Record<ItemType, Item[]> {
  const grouped: Record<ItemType, Item[]> = { website: [], skill: [], mcp: [] };
  for (const item of list) grouped[item.type].push(item);
  return grouped;
}

export function listCategories(list: Item[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of list) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

/** 构建期解析：语法 / 枚举 / 必填字段错误会让构建直接失败，错误信息带条目序号 */
export const items: Item[] = parseItems(itemsSource);

export const itemsByType = groupByType(items);

export const itemCounts = {
  website: itemsByType.website.length,
  skill: itemsByType.skill.length,
  mcp: itemsByType.mcp.length,
  total: items.length,
} as const;
