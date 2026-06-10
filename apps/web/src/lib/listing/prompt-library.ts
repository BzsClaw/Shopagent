/**
 * 提示词模板库 — 移植自 ListingGen src/lib/prompt-library.ts
 * localStorage 持久化
 */
const STORAGE_KEY = 'shopagent_prompt_library';

export interface PromptTemplate {
  id: string; name: string; category: string; tags: string[]; prompt: string;
  bestModel?: string; createdAt: string;
}

export const PROMPT_CATEGORIES = [
  '主图A · 卖点放大型', '主图B · 场景代入型', '主图C · 极简纯净型',
  '详情图1 · 痛点开场', '详情图2 · 差异化对比', '详情图3 · 内容物清单',
  '详情图4 · 便携收纳', '详情图5 · 使用场景', '详情图6 · 信任兜底',
];

function load(): PromptTemplate[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function save(templates: PromptTemplate[]) { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); }
function genId(): string { return `pt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

export function getPromptLibrary(): PromptTemplate[] { return load(); }
export function getPromptsByCategory(category: string): PromptTemplate[] { return load().filter((p) => p.category === category); }
export function addPrompt(data: Omit<PromptTemplate, 'id' | 'createdAt'>): PromptTemplate {
  const templates = load(); const next: PromptTemplate = { ...data, id: genId(), createdAt: new Date().toISOString().slice(0, 10) };
  templates.push(next); save(templates); return next;
}
export function updatePrompt(id: string, data: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>) {
  const templates = load(); const idx = templates.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const existing = templates[idx]!;
  templates[idx] = { id: existing.id, name: data.name ?? existing.name, category: data.category ?? existing.category, tags: data.tags ?? existing.tags, prompt: data.prompt ?? existing.prompt, bestModel: data.bestModel ?? existing.bestModel, createdAt: existing.createdAt };
  save(templates);
}
export function removePrompt(id: string) { save(load().filter((p) => p.id !== id)); }
export function exportPromptLibrary(): string { return JSON.stringify(load(), null, 2); }
export function importPromptLibrary(json: string): PromptTemplate[] {
  const parsed = JSON.parse(json); if (!Array.isArray(parsed)) throw new Error('格式错误');
  const incoming = parsed.filter((p: unknown) => p && typeof p === 'object' && typeof (p as PromptTemplate).name === 'string' && typeof (p as PromptTemplate).prompt === 'string') as PromptTemplate[];
  const existing = load(); const existingKeys = new Set(existing.map((p) => `${p.name}|${p.category}`));
  const merged = [...existing, ...incoming.filter((p) => !existingKeys.has(`${p.name}|${p.category}`))];
  save(merged); return merged;
}
