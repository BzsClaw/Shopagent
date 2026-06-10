/**
 * 关键词库 — daemon SQLite 持久化，按语言分类，支持标记
 */
const DEF_LANG = 'en';

export const LANGUAGES: Record<string, string> = {
  en: '英语 English', 'zh-CN': '中文 简体', th: '泰语 ไทย', vi: '越南语 Tiếng Việt',
  id: '印尼语 Bahasa', 'pt-BR': '葡萄牙语 Português', es: '西班牙语 Español',
};

const DEFAULT_CATEGORIES = ['表层词', '场景词', '情绪词', '身份词', '差异化卖点', '其他卖点', '竞品差评痛点'];
export { DEFAULT_CATEGORIES };
export function getDefaultCategories(): string[] { return [...DEFAULT_CATEGORIES]; }

export interface KeywordItem { text: string; tag: string | null; }

// ─── Daemon API helpers ────────────────────────────────

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch('/api/listing' + path, init);
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

// ─── Async API (language-aware) ─────────────────────────

export async function getKeywordLibraryAsync(language: string = DEF_LANG): Promise<Record<string, KeywordItem[]>> {
  try { return await api('/keywords?language=' + encodeURIComponent(language)); }
  catch { return {}; }
}

// Synchronous version for backward-compatibility (ResourceLibrary)
export function getKeywordLibrary(language: string = DEF_LANG): Record<string, string[]> {
  return {};
}
export const KEYWORD_TAGS = { star: '⭐', hot: '🔥', new: '🆕' } as Record<string, string>;

export async function saveKeywords(language: string, category: string, keywords: KeywordItem[]) {
  await api('/keywords', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, category, keywords }),
  });
}

export async function deleteKeywords(language: string, category: string) {
  await api('/keywords?language=' + encodeURIComponent(language) + '&category=' + encodeURIComponent(category), { method: 'DELETE' });
}

// ─── Backward-compatible wrappers (for ResourceLibrary) ──

export async function addKeyword(category: string, keyword: string, language = DEF_LANG) {
  const lib = await getKeywordLibraryAsync(language);
  const items = lib[category] || [];
  if (!items.some(i => i.text === keyword.trim())) {
    items.push({ text: keyword.trim(), tag: null });
    await saveKeywords(language, category, items);
  }
}

export async function removeKeyword(category: string, keyword: string, language = DEF_LANG) {
  const lib = await getKeywordLibraryAsync(language);
  const items = (lib[category] || []).filter(i => i.text !== keyword);
  await saveKeywords(language, category, items);
}

export async function toggleKeywordTag(category: string, keywordText: string, tag: string, language = DEF_LANG) {
  const lib = await getKeywordLibraryAsync(language);
  const items = lib[category] || [];
  const item = items.find(i => i.text === keywordText);
  if (item) { item.tag = item.tag === tag ? null : tag; }
  await saveKeywords(language, category, items);
}

export async function addCategory(category: string, language = DEF_LANG) {
  const lib = await getKeywordLibraryAsync(language);
  if (!lib[category]) await saveKeywords(language, category, []);
}

export async function exportKeywordLibrary(language: string = DEF_LANG): Promise<string> {
  const lib = await getKeywordLibraryAsync(language);
  const plain: Record<string, string[]> = {};
  for (const [cat, items] of Object.entries(lib)) { plain[cat] = items.map(i => i.text); }
  return JSON.stringify(plain, null, 2);
}

export async function importKeywordLibrary(data: string, language: string = DEF_LANG): Promise<void> {
  const parsed = JSON.parse(data);
  for (const [cat, texts] of Object.entries(parsed)) {
    if (Array.isArray(texts)) {
      await saveKeywords(language, cat, texts.map((t: string) => ({ text: String(t), tag: null })));
    }
  }
}
