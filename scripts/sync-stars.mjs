#!/usr/bin/env node
/**
 * 拉取当前用户全部 GitHub Star，生成 public/data/stars.json。
 *
 * 只读：不会 star / unstar 任何仓库。
 * 密钥：只从环境变量 STAR_TOKEN 读取，绝不打印到日志。
 *
 * 本地运行：
 *   STAR_TOKEN=ghp_xxx node scripts/sync-stars.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API = 'https://api.github.com';
const PER_PAGE = 100;
const MAX_PAGES = 100;
const OUTPUT_FILE = path.resolve(process.cwd(), 'public/data/stars.json');

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.error(`::error title=同步 Star 失败::${message.replace(/\r?\n/g, ' ')}`);
  }
  process.exit(1);
}

function note(message) {
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::notice::${message}`);
  else console.log(message);
}

function warn(message) {
  console.warn(`⚠ ${message}`);
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::warning::${message}`);
}

const token = (process.env.STAR_TOKEN ?? '').trim();

if (!token) {
  fail(
    [
      '缺少环境变量 STAR_TOKEN，无法读取你的 Star 列表。',
      '注意：默认的 GITHUB_TOKEN 只能访问本仓库，不能代表你去读 /user/starred，所以必须单独配置只读 PAT。',
      '配置方式：仓库 Settings → Secrets and variables → Actions → New repository secret，名称填 STAR_TOKEN。',
      'PAT 权限：classic 勾选 read:user；fine-grained 只需该账号的 “Starring” 读取权限。',
    ].join('\n'),
  );
}

async function fetchPage(page) {
  const url = `${API}/user/starred?per_page=${PER_PAGE}&page=${page}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'fav-home-sync-stars',
    },
  });

  if (response.ok) {
    const body = await response.json();
    if (!Array.isArray(body)) fail('GitHub API 返回了非数组结果，无法继续。');
    return body;
  }

  let detail = '';
  try {
    const body = await response.json();
    if (body && typeof body.message === 'string') detail = `（${body.message}）`;
  } catch {
    /* 忽略无法解析的错误体 */
  }

  const remaining = response.headers.get('x-ratelimit-remaining');
  const reset = response.headers.get('x-ratelimit-reset');
  const resetHint =
    remaining === '0' && reset
      ? `\n速率限制已用完，将在 ${new Date(Number(reset) * 1000).toISOString()} 重置。`
      : '';

  if (response.status === 401) {
    fail(`STAR_TOKEN 无效或已过期（401）${detail}。请重新生成只读 PAT 并更新 Secret。`);
  }
  if (response.status === 403 || response.status === 429) {
    fail(`GitHub API 拒绝请求（${response.status}）${detail}。可能是权限不足或速率限制。${resetHint}`);
  }
  fail(`GitHub API 请求失败：HTTP ${response.status} ${response.statusText}${detail}。${resetHint}`);
}

function toItem(repo) {
  return {
    name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description ?? null,
    language: repo.language ?? null,
    stargazers_count: Number(repo.stargazers_count ?? 0),
    updated_at: repo.updated_at ?? null,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    archived: Boolean(repo.archived),
    fork: Boolean(repo.fork),
  };
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(OUTPUT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const repositories = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await fetchPage(page);
    repositories.push(...batch);
    console.log(`第 ${page} 页：${batch.length} 个仓库，累计 ${repositories.length} 个`);

    if (batch.length < PER_PAGE) break;
    if (page === MAX_PAGES) warn(`已达到 ${MAX_PAGES} 页上限，剩余 Star 未同步。`);
  }

  if (repositories.length === 0) {
    fail('拉取到 0 个 Star，为避免覆盖现有数据，本次不写入 stars.json。请确认 STAR_TOKEN 对应的账号确实有 Star。');
  }

  const payload = {
    updated_at: new Date().toISOString(),
    items: repositories.map(toItem),
  };

  const previous = await readPrevious();
  const unchanged =
    previous &&
    Array.isArray(previous.items) &&
    JSON.stringify(previous.items) === JSON.stringify(payload.items);

  if (unchanged) {
    note('Star 列表没有变化，保留现有 stars.json（不更新时间戳）。');
    return;
  }

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  note(`已写入 public/data/stars.json，共 ${payload.items.length} 个仓库。`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
