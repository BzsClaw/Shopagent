/**
 * 提示词模板库 — daemon SQLite 持久化
 * Migrated from localStorage to SQLite (Bug #3 fix).
 */
export interface PromptTemplate {
  id: string; name: string; category: string; tags: string[]; prompt: string;
  bestModel?: string; createdAt: string;
}

export const PROMPT_CATEGORIES = [
  '主图A · 卖点放大型', '主图B · 场景代入型', '主图C · 极简纯净型',
  '详情图1 · 痛点开场', '详情图2 · 差异化对比', '详情图3 · 内容物清单',
  '详情图4 · 便携收纳', '详情图5 · 使用场景', '详情图6 · 信任兜底',
];

// ─── Daemon API ──────────────────────────────────────

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch('/api/listing' + path, init);
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

// ─── Public API ──────────────────────────────────────

let _cache: PromptTemplate[] | null = null;

export async function getPromptLibrary(): Promise<PromptTemplate[]> {
  try {
    const rows = await api('/prompts');
    _cache = rows as PromptTemplate[];
    return _cache;
  } catch {
    return _cache ?? [];
  }
}

export function getPromptLibrarySync(): PromptTemplate[] {
  return _cache ?? [];
}

export async function getPromptsByCategory(category: string): Promise<PromptTemplate[]> {
  const all = await getPromptLibrary();
  return all.filter((p) => p.category === category);
}

export async function addPrompt(data: Omit<PromptTemplate, 'id' | 'createdAt'>): Promise<PromptTemplate> {
  const result = await api('/prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  // Invalidate cache
  _cache = null;
  return { ...data, id: result.id, createdAt: new Date().toISOString().slice(0, 10) };
}

export function updatePrompt(id: string, data: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>) {
  // Not yet implemented server-side; no-op for now
}

export async function removePrompt(id: string): Promise<void> {
  await api('/prompts/' + encodeURIComponent(id), { method: 'DELETE' });
  _cache = null;
}

export async function exportPromptLibrary(): Promise<string> {
  const all = await getPromptLibrary();
  return JSON.stringify(all, null, 2);
}

export async function importPromptLibrary(json: string): Promise<PromptTemplate[]> {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('格式错误');
  const incoming = parsed.filter(
    (p: unknown) => p && typeof p === 'object'
      && typeof (p as PromptTemplate).name === 'string'
      && typeof (p as PromptTemplate).prompt === 'string'
  ) as PromptTemplate[];

  const existing = await getPromptLibrary();
  const existingKeys = new Set(existing.map((p) => `${p.name}|${p.category}`));

  const merged = [...existing, ...incoming.filter((p) => !existingKeys.has(`${p.name}|${p.category}`))];

  // Persist new entries one by one
  for (const p of incoming.filter((p) => !existingKeys.has(`${p.name}|${p.category}`))) {
    try {
      await addPrompt({ name: p.name, category: p.category, tags: p.tags ?? [], prompt: p.prompt, bestModel: p.bestModel });
    } catch { /* skip duplicate */ }
  }
  _cache = null;
  return merged;
}
