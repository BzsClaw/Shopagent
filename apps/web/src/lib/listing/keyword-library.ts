/**
 * 关键词库 — 移植自 ListingGen src/lib/keyword-library.ts
 * localStorage 持久化，分类管理
 */
const STORAGE_KEY = 'shopagent_keyword_library';

export const DEFAULT_CATEGORIES = ['表层词', '场景词', '情绪词', '身份词', '差异化卖点', '其他卖点'];

export interface KeywordLibrary { [category: string]: string[] }

function load(): KeywordLibrary {
  if (typeof window === 'undefined') return {};
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : getDefault(); } catch { return getDefault(); }
}
function save(lib: KeywordLibrary) { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(lib)); }
function getDefault(): KeywordLibrary { return Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c, []])); }
function ensureCategories(lib: KeywordLibrary): KeywordLibrary {
  const next = { ...lib }; for (const cat of DEFAULT_CATEGORIES) { if (!next[cat]) next[cat] = []; } return next;
}

export function getKeywordLibrary(): KeywordLibrary { return ensureCategories(load()); }
export function getCategoryKeywords(category: string): string[] { return getKeywordLibrary()[category] || []; }
export function addKeyword(category: string, keyword: string) {
  const lib = getKeywordLibrary(); if (!lib[category]) lib[category] = [];
  const t = keyword.trim(); if (t && !lib[category].includes(t)) lib[category].push(t); save(lib);
}
export function removeKeyword(category: string, keyword: string) {
  const lib = getKeywordLibrary(); if (lib[category]) lib[category] = lib[category].filter((k) => k !== keyword); save(lib);
}
export function addCategory(category: string) { const lib = getKeywordLibrary(); if (!lib[category]) { lib[category] = []; save(lib); } }
export function removeCategory(category: string) { const lib = getKeywordLibrary(); delete lib[category]; save(lib); }
export function exportKeywordLibrary(): string { return JSON.stringify(getKeywordLibrary(), null, 2); }
export function importKeywordLibrary(json: string): KeywordLibrary {
  const parsed = JSON.parse(json);
  if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('格式错误');
  const lib: KeywordLibrary = {};
  for (const [k, v] of Object.entries(parsed)) { if (Array.isArray(v)) lib[k] = v.filter((x): x is string => typeof x === 'string'); }
  const merged = { ...getKeywordLibrary(), ...lib }; save(merged); return merged;
}
