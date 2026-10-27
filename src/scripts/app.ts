import { LANGUAGE_COLORS, isStarItem, type StarItem, type StarsPayload } from '../lib/stars';

const root = document.documentElement;
const THEME_KEY = 'fav-home-theme';

function $<T extends Element = HTMLElement>(selector: string, scope: ParentNode = document): T | null {
  return scope.querySelector<T>(selector);
}

function $$<T extends Element = HTMLElement>(selector: string, scope: ParentNode = document): T[] {
  return Array.from(scope.querySelectorAll<T>(selector));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

/* ------------------------------------------------------------------ */
/* 主题                                                                */
/* ------------------------------------------------------------------ */

const themeToggle = $<HTMLButtonElement>('[data-theme-toggle]');

function paintThemeButton(): void {
  if (!themeToggle) return;
  const isDark = root.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
  const text = $<HTMLElement>('[data-theme-toggle-text]', themeToggle);
  if (text) text.textContent = isDark ? '切换到浅色模式' : '切换到深色模式';
}

paintThemeButton();

themeToggle?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略即可 */
  }
  paintThemeButton();
});

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

const TAB_IDS = ['stars', 'website', 'skill', 'mcp'] as const;
type TabId = (typeof TAB_IDS)[number];

function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

const tabButtons = $$<HTMLButtonElement>('[data-tab]');
const panels = new Map<TabId, HTMLElement>();
for (const panel of $$<HTMLElement>('[data-panel]')) {
  const id = panel.dataset.panel;
  if (id && isTabId(id)) panels.set(id, panel);
}

let activeTab: TabId = 'stars';

function activateTab(id: TabId, options: { focusTab?: boolean; updateHash?: boolean; scroll?: boolean } = {}): void {
  activeTab = id;

  for (const button of tabButtons) {
    const isActive = button.dataset.tab === id;
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  }
  for (const [panelId, panel] of panels) panel.hidden = panelId !== id;

  if (options.focusTab) $<HTMLButtonElement>(`[data-tab="${id}"]`)?.focus();
  if (options.updateHash) history.replaceState(null, '', `#${id}`);
  if (options.scroll) {
    const panel = panels.get(id);
    const top = panel?.getBoundingClientRect().top ?? 0;
    if (panel && top < 0) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    const id = button.dataset.tab;
    if (!id || !isTabId(id) || id === activeTab) return;
    activateTab(id, { updateHash: true, scroll: true });
  });
}

$<HTMLElement>('.tabs__inner')?.addEventListener('keydown', (event) => {
  const key = (event as KeyboardEvent).key;
  if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;

  event.preventDefault();
  const current = TAB_IDS.indexOf(activeTab);
  const next =
    key === 'Home'
      ? 0
      : key === 'End'
        ? TAB_IDS.length - 1
        : key === 'ArrowRight'
          ? (current + 1) % TAB_IDS.length
          : (current - 1 + TAB_IDS.length) % TAB_IDS.length;

  const target = TAB_IDS[next];
  if (target) activateTab(target, { focusTab: true, updateHash: true });
});

function tabFromHash(): TabId | null {
  const raw = location.hash.replace(/^#/, '');
  return raw && isTabId(raw) ? raw : null;
}

/* ------------------------------------------------------------------ */
/* 搜索与筛选状态                                                       */
/* ------------------------------------------------------------------ */

const MANUAL_TYPES = ['website', 'skill', 'mcp'] as const;
type ManualType = (typeof MANUAL_TYPES)[number];

function isManualType(value: string): value is ManualType {
  return (MANUAL_TYPES as readonly string[]).includes(value);
}

const state = {
  query: '',
  tokens: [] as string[],
  category: { website: 'all', skill: 'all', mcp: 'all' } as Record<ManualType, string>,
  language: 'all',
};

const searchInput = $<HTMLInputElement>('[data-search-input]');
const searchClear = $<HTMLButtonElement>('[data-search-clear]');
const status = $<HTMLElement>('[data-status]');

function announce(message: string): void {
  if (!status) return;
  status.textContent = message;
}

function tokenize(query: string): string[] {
  return query.split(/\s+/).filter(Boolean);
}

function matchesTokens(text: string, tokens: string[]): boolean {
  return tokens.every((token) => text.includes(token));
}

function syncClearButton(): void {
  if (!searchClear || !searchInput) return;
  searchClear.hidden = searchInput.value.trim() === '';
}

function updateCounter(type: TabId, visible: number, total: number): void {
  const counter = $(`[data-panel-count="${type}"]`);
  if (counter) counter.textContent = visible === total ? `${total} 项` : `${visible} / ${total} 项`;

  const tabCount = $(`[data-tab-count="${type}"]`);
  if (tabCount) tabCount.textContent = visible === total ? String(total) : `${visible}/${total}`;
}

function applyManualFilters(): void {
  for (const type of MANUAL_TYPES) {
    const grid = $(`[data-grid="${type}"]`);
    if (!grid) continue;

    const category = state.category[type];
    const cards = $$<HTMLElement>('.card', grid);
    let visible = 0;

    for (const card of cards) {
      const okCategory = category === 'all' || card.dataset.category === category;
      const okQuery = matchesTokens(card.dataset.search ?? '', state.tokens);
      const ok = okCategory && okQuery;
      card.hidden = !ok;
      if (ok) visible += 1;
    }

    updateCounter(type, visible, cards.length);

    const empty = $(`[data-empty="${type}"]`);
    if (empty) empty.hidden = visible > 0;
  }
}

function paintChips(wrap: HTMLElement): void {
  const scope = wrap.dataset.chips ?? '';
  for (const chip of $$<HTMLButtonElement>('.chip', wrap)) {
    const value = chip.dataset.filter ?? chip.dataset.lang ?? 'all';
    const active =
      scope === 'stars'
        ? value === state.language
        : isManualType(scope)
          ? value === state.category[scope]
          : false;
    chip.setAttribute('aria-pressed', String(active));
  }
}

for (const wrap of $$<HTMLElement>('[data-chips]')) {
  wrap.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button');
    if (!button || !wrap.contains(button)) return;

    const scope = wrap.dataset.chips ?? '';

    if (scope === 'stars') {
      state.language = button.dataset.lang ?? 'all';
    } else if (isManualType(scope)) {
      state.category[scope] = button.dataset.filter ?? 'all';
    } else {
      return;
    }

    paintChips(wrap);
    applyFilters({ announce: true });
  });
}

function isFiltering(): boolean {
  if (state.tokens.length > 0 || state.language !== 'all') return true;
  return MANUAL_TYPES.some((type) => state.category[type] !== 'all');
}

function applyFilters(options: { announce?: boolean } = {}): void {
  applyManualFilters();

  if (starsStatus === 'ready') {
    renderStars();
  }

  if (!options.announce) return;

  if (!isFiltering()) {
    announce('已清除筛选条件');
    return;
  }

  if (activeTab === 'stars') {
    const hint = starsStatus === 'ready' ? `当前筛选出 ${filteredStars().length} 个 Star 项目` : 'Star 数据加载中';
    announce(hint);
    return;
  }

  const grid = $(`[data-grid="${activeTab}"]`);
  const visible = grid ? $$<HTMLElement>('.card', grid).filter((card) => !card.hidden).length : 0;
  announce(`当前筛选出 ${visible} 条`);
}

let queryFrame = 0;

function scheduleQueryUpdate(): void {
  if (queryFrame) cancelAnimationFrame(queryFrame);
  queryFrame = requestAnimationFrame(() => {
    queryFrame = 0;
    state.query = (searchInput?.value ?? '').trim().toLowerCase();
    state.tokens = tokenize(state.query);
    syncClearButton();
    applyFilters({ announce: true });
  });
}

searchInput?.addEventListener('input', scheduleQueryUpdate);

searchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (searchInput) searchInput.value = '';
    state.query = '';
    state.tokens = [];
    syncClearButton();
    applyFilters({ announce: true });
  }
});

searchClear?.addEventListener('click', () => {
  if (!searchInput) return;
  searchInput.value = '';
  state.query = '';
  state.tokens = [];
  syncClearButton();
  applyFilters({ announce: true });
  searchInput.focus();
});

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key !== '/') return;

  const target = event.target as HTMLElement | null;
  if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

  event.preventDefault();
  searchInput?.focus();
  searchInput?.select();
});

/* ------------------------------------------------------------------ */
/* 复制                                                                */
/* ------------------------------------------------------------------ */

const copyTimers = new WeakMap<HTMLButtonElement, number>();

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* 落到下面的兜底方案（非 https、权限被拒） */
    }
  }

  const area = el('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    area.remove();
  }
  if (!copied) throw new Error('copy failed');
}

function flashCopyState(button: HTMLButtonElement, label: HTMLElement | null, text: string): void {
  const original = button.dataset.copyLabel ?? '复制';
  if (label) label.textContent = text;
  button.classList.add('is-copied');

  const timer = copyTimers.get(button);
  if (timer) window.clearTimeout(timer);

  copyTimers.set(
    button,
    window.setTimeout(() => {
      if (label) label.textContent = original;
      button.classList.remove('is-copied');
    }, 1600),
  );
}

document.addEventListener('click', (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-copy]');
  if (!button) return;

  const text = button.dataset.copy ?? '';
  if (!text) return;

  const label = $<HTMLElement>('[data-copy-label-text]', button);

  void copyText(text)
    .then(() => {
      flashCopyState(button, label, '已复制');
      announce('已复制到剪贴板');
    })
    .catch(() => {
      flashCopyState(button, label, '复制失败');
      announce('复制失败，请手动选中文本复制');
    });
});

/* ------------------------------------------------------------------ */
/* 图标加载失败兜底                                                     */
/* ------------------------------------------------------------------ */

document.addEventListener(
  'error',
  (event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement) || !target.hasAttribute('data-icon-img')) return;
    target.closest('[data-icon-wrap]')?.classList.add('is-failed');
  },
  true,
);

/* ------------------------------------------------------------------ */
/* Star 数据                                                           */
/* ------------------------------------------------------------------ */

let starsStatus: 'loading' | 'ready' | 'error' = 'loading';
let stars: StarItem[] = [];
let starIndex: { star: StarItem; text: string }[] = [];

const starsPanel = $<HTMLElement>('[data-panel="stars"]');
const starsGrid = $<HTMLElement>('[data-grid="stars"]');
const starsEmpty = $<HTMLElement>('[data-empty="stars"]');
const starsError = $<HTMLElement>('[data-stars-error]');
const starsErrorDetail = $<HTMLElement>('[data-stars-error-detail]');
const starsUpdated = $<HTMLElement>('[data-stars-updated]');

function starSearchText(star: StarItem): string {
  return [star.name, star.full_name, star.description ?? '', star.language ?? '', ...(star.topics ?? [])]
    .join(' ')
    .toLowerCase();
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(value / 1000)}k`;
}

const relativeFormatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });

function relativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';

  const diff = time - Date.now();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const abs = Math.abs(diff);

  if (abs < hour) return relativeFormatter.format(Math.round(diff / minute), 'minute');
  if (abs < day) return relativeFormatter.format(Math.round(diff / hour), 'hour');
  if (abs < 30 * day) return relativeFormatter.format(Math.round(diff / day), 'day');
  if (abs < 365 * day) return relativeFormatter.format(Math.round(diff / (30 * day)), 'month');
  return relativeFormatter.format(Math.round(diff / (365 * day)), 'year');
}

function filteredStars(): StarItem[] {
  return starIndex
    .filter(({ star, text }) => {
      const language = star.language ?? '未标注';
      const okLanguage = state.language === 'all' || language === state.language;
      return okLanguage && matchesTokens(text, state.tokens);
    })
    .map(({ star }) => star);
}

function createBadge(text: string, tone: 'warn' | 'soft'): HTMLElement {
  const badge = el('span', `badge badge--${tone}`);
  badge.textContent = text;
  return badge;
}

function createStarCard(star: StarItem): HTMLElement {
  const card = el('article', 'card card--star');

  const head = el('header', 'card__head');
  const heading = el('div', 'card__heading');
  const title = el('h3', 'card__title');
  const link = el('a');
  link.href = star.html_url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = star.name || star.full_name;
  title.append(link);

  const sub = el('p', 'card__sub');
  const owner = el('span', 'card__category');
  owner.textContent = star.full_name;
  sub.append(owner);

  heading.append(title, sub);
  head.append(heading);

  if (star.archived || star.fork) {
    const badges = el('div', 'badges');
    if (star.archived) badges.append(createBadge('已归档', 'warn'));
    if (star.fork) badges.append(createBadge('Fork', 'soft'));
    head.append(badges);
  }

  card.append(head);

  if (star.description) {
    const note = el('p', 'card__note');
    note.textContent = star.description;
    card.append(note);
  }

  if (star.topics && star.topics.length > 0) {
    const tags = el('ul', 'tags');
    tags.setAttribute('aria-label', 'topics');
    for (const topic of star.topics.slice(0, 6)) {
      const tag = el('li', 'tag');
      tag.textContent = topic;
      tags.append(tag);
    }
    card.append(tags);
  }

  const meta = el('div', 'card__meta');

  if (star.language) {
    const language = el('span', 'meta__lang');
    const dot = el('i', 'lang-dot');
    dot.style.backgroundColor = LANGUAGE_COLORS[star.language] ?? 'var(--muted)';
    const text = el('span');
    text.textContent = star.language;
    language.append(dot, text);
    meta.append(language);
  }

  const starCount = el('span', 'meta__stars');
  starCount.title = `${star.stargazers_count.toLocaleString('en-US')} stars`;
  starCount.textContent = `★ ${formatCompact(star.stargazers_count)}`;
  meta.append(starCount);

  const updated = el('span', 'meta__updated');
  if (star.updated_at) {
    const date = new Date(star.updated_at);
    updated.title = Number.isNaN(date.getTime()) ? star.updated_at : date.toLocaleString('zh-CN');
    const relative = relativeTime(star.updated_at);
    if (relative) updated.textContent = `更新于 ${relative}`;
  }
  if (updated.textContent) meta.append(updated);

  card.append(meta);

  const foot = el('footer', 'card__foot');
  const origin = el('a', 'card__link');
  origin.href = star.html_url;
  origin.target = '_blank';
  origin.rel = 'noopener noreferrer';
  origin.textContent = '原地址 ↗';
  const host = el('span', 'card__host');
  host.textContent = 'GitHub';
  foot.append(origin, host);
  card.append(foot);

  return card;
}

function makeSkeleton(): HTMLElement {
  const card = el('div', 'card card--skeleton');
  card.setAttribute('aria-hidden', 'true');
  for (const className of [
    'skeleton skeleton--title',
    'skeleton skeleton--line',
    'skeleton skeleton--line',
    'skeleton skeleton--short',
  ]) {
    card.append(el('span', className));
  }
  return card;
}

function createChip(label: string, value: string, count: number, pressed: boolean): HTMLButtonElement {
  const chip = el('button', 'chip');
  chip.type = 'button';
  chip.dataset.lang = value;
  chip.setAttribute('aria-pressed', String(pressed));

  const text = el('span');
  text.textContent = label;
  const badge = el('span', 'chip__count');
  badge.textContent = String(count);
  chip.append(text, badge);
  return chip;
}

function renderLanguageChips(): void {
  const wrap = $<HTMLElement>('[data-chips="stars"]');
  if (!wrap) return;

  const counts = new Map<string, number>();
  for (const { star } of starIndex) {
    const language = star.language ?? '未标注';
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'));

  const chips = [createChip('全部', 'all', starIndex.length, state.language === 'all')];
  for (const [language, count] of entries) {
    chips.push(createChip(language, language, count, state.language === language));
  }

  wrap.replaceChildren(...chips);
  wrap.hidden = false;
}

function renderStars(): void {
  if (!starsGrid) return;

  const list = filteredStars();
  starsGrid.replaceChildren(...list.map(createStarCard));
  starsGrid.setAttribute('aria-busy', 'false');
  starsGrid.hidden = false;

  if (starsEmpty) {
    const filtered = state.tokens.length > 0 || state.language !== 'all';
    starsEmpty.hidden = list.length > 0;
    starsEmpty.textContent = filtered
      ? '没有匹配的 Star，换个关键词或语言试试。'
      : '还没有同步到 Star 项目，先运行一次 sync-stars 工作流。';
  }

  updateCounter('stars', list.length, stars.length);
}

async function loadStars(): Promise<void> {
  const url = starsPanel?.dataset.starsUrl;
  if (!url) {
    showStarsError('页面缺少 data-stars-url，无法定位 stars.json');
    return;
  }

  starsStatus = 'loading';
  if (starsError) starsError.hidden = true;
  if (starsErrorDetail) {
    starsErrorDetail.hidden = true;
    starsErrorDetail.textContent = '';
  }
  if (starsEmpty) starsEmpty.hidden = true;
  if (starsGrid) {
    starsGrid.hidden = false;
    starsGrid.setAttribute('aria-busy', 'true');
    starsGrid.replaceChildren(makeSkeleton(), makeSkeleton(), makeSkeleton());
  }

  const counter = $('[data-panel-count="stars"]');
  if (counter) counter.textContent = '加载中…';

  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());

    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || !Array.isArray((payload as StarsPayload).items)) {
      throw new Error('stars.json 结构不正确：缺少 items 数组');
    }

    const data = payload as StarsPayload;
    stars = data.items.filter(isStarItem);
    starIndex = stars.map((star) => ({ star, text: starSearchText(star) }));
    starsStatus = 'ready';

    renderLanguageChips();
    renderStars();

    if (starsUpdated && data.updated_at) {
      const date = new Date(data.updated_at);
      if (!Number.isNaN(date.getTime())) {
        const absolute = date.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
        const relative = relativeTime(data.updated_at);
        starsUpdated.textContent = `最后同步：${absolute}${relative ? `（${relative}）` : ''}`;
        starsUpdated.hidden = false;
      }
    }
  } catch (error) {
    showStarsError(error instanceof Error ? error.message : String(error));
    console.error('[stars] 加载失败：', error);
  }
}

function showStarsError(detail: string): void {
  starsStatus = 'error';
  stars = [];
  starIndex = [];

  if (starsGrid) {
    starsGrid.replaceChildren();
    starsGrid.setAttribute('aria-busy', 'false');
    starsGrid.hidden = true;
  }
  if (starsEmpty) starsEmpty.hidden = true;
  if (starsError) starsError.hidden = false;
  if (starsErrorDetail) {
    starsErrorDetail.textContent = `错误详情：${detail}`;
    starsErrorDetail.hidden = false;
  }

  const chips = $<HTMLElement>('[data-chips="stars"]');
  if (chips) chips.hidden = true;

  const counter = $('[data-panel-count="stars"]');
  if (counter) counter.textContent = '加载失败';
  const tabCount = $('[data-tab-count="stars"]');
  if (tabCount) tabCount.textContent = '!';
}

$<HTMLButtonElement>('[data-stars-retry]')?.addEventListener('click', () => {
  void loadStars();
});

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

activateTab(tabFromHash() ?? 'stars');
syncClearButton();
applyFilters();
void loadStars();

window.addEventListener('hashchange', () => {
  const id = tabFromHash();
  if (id && id !== activeTab) activateTab(id);
});
