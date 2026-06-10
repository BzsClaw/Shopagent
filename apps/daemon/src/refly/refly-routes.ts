/**
 * Refly API mock routes — login, providers, canvas, workflow execution.
 */
import type { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const canvases      = new Map<string, any>();
const providers     = new Map<string, any>();
const providerItems = new Map<string, any[]>();
const results       = new Map<string, any>();

const DEFAULT_USER = {
  uid: 'shopagent', avatar: '', name: 'shopagent', nickname: 'ShopAgent',
  email: 'agent@shopagent.local', emailVerified: true,
  uiLocale: 'zh-CN', outputLocale: 'zh-CN', hasBetaAccess: true,
  preferences: {
    hasBeenInvited: true, hasFilledForm: true, providerMode: 'custom',
    operationMode: 'mouse', disableHoverCard: false,
  },
};

const TOKEN = 'shopagent-mock-session-token';
const COOKIE = [
  '_rf_uid=shopagent; Path=/; Max-Age=86400; SameSite=Lax',
  '_rf_email=agent%40shopagent.local; Path=/; Max-Age=86400; SameSite=Lax',
];

function ok(data: unknown) { return { success: true, data }; }

function cors(_req: Request, res: Response, next: () => void) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (_req.method === 'OPTIONS') { res.status(204).end(); return; }
  next();
}

export function registerReflyRoutes(router: Router): void {
  router.use('/api/refly', (req: Request, _res: Response, next: () => void) => {
    console.log('[refly]', req.method, req.path, JSON.stringify(req.body ?? {}).slice(0, 200));
    next();
  });
  router.use('/api/refly', cors);
  // Global auth cookie — every API response keeps you logged in
  router.use('/api/refly', (_req: Request, res: Response, next: () => void) => {
    res.setHeader('Set-Cookie', COOKIE);
    next();
  });

  // Auth
  router.post('/api/refly/auth/email/login', (_req, res) => { res.json(ok({ accessToken: TOKEN })); });
  router.post('/api/refly/auth/email/signup', (_req, res) => { res.json(ok({ sessionId: randomUUID(), skipVerification: true })); });
  router.get('/api/refly/auth/config', (_req, res) => res.json(ok({ providers: ['email'], turnstileEnabled: false })));
  router.post('/api/refly/auth/refreshToken', (_req, res) => res.json(ok({ accessToken: TOKEN })));
  router.post('/api/refly/auth/logout', (_req, res) => res.json(ok({})));
  router.get('/api/refly/auth/account/list', (_req, res) => res.json(ok([DEFAULT_USER])));

  // User
  router.get('/api/refly/v1/user', (_req, res) => res.json(ok(DEFAULT_USER)));
  router.put('/api/refly/v1/user', (req, res) => res.json(ok({ ...DEFAULT_USER, ...req.body })));
  router.get('/api/refly/v1/user/settings', (_req, res) => res.json(ok(DEFAULT_USER)));

  // Invitation
  router.post('/api/refly/v1/invitation/skip', (_req, res) => res.json(ok({ ok: true })));
  router.post('/api/refly/v1/invitation/activate', (_req, res) => res.json(ok({ activated: true })));

  // Canvas
  router.get('/api/refly/v1/canvas', (_req, res) => res.json(ok(Array.from(canvases.values()))));
  router.get('/api/refly/v1/canvas/list', (_req, res) => res.json(ok(Array.from(canvases.values()))));
  router.post('/api/refly/v1/canvas/create', (req, res) => { const id = randomUUID(), now = Date.now(); canvases.set(id, { id, title: req.body?.title ?? 'Untitled', nodes: [], edges: [], createdAt: now, updatedAt: now }); res.status(201).json(ok(canvases.get(id))); });
  router.post('/api/refly/v1/canvas/data', (req, res) => { const c = canvases.get(req.body?.canvasId); res.json(ok(c ?? { id: req.body?.canvasId, title: '', nodes: [], edges: [] })); });
  router.post('/api/refly/v1/canvas/detail', (req, res) => { const c = canvases.get(req.body?.canvasId); c ? res.json(ok(c)) : res.status(404).json({ success: false }); });
  router.post('/api/refly/v1/canvas/update', (req, res) => { const { canvasId, ...r } = req.body ?? {}; const c = canvases.get(canvasId); if (!c) return res.status(404).json({ success: false }); Object.assign(c, r, { updatedAt: Date.now() }); res.json(ok(c)); });
  router.post('/api/refly/v1/canvas/getState', (req, res) => { const c = canvases.get(req.body?.canvasId); res.json(ok(c ? { nodes: c.nodes, edges: c.edges } : { nodes: [], edges: [] })); });
  router.post('/api/refly/v1/canvas/setState', (req, res) => { const { canvasId, nodes, edges } = req.body ?? {}; const c = canvases.get(canvasId); if (c) { if (nodes !== undefined) c.nodes = nodes; if (edges !== undefined) c.edges = edges; c.updatedAt = Date.now(); } res.json(ok({ ok: true })); });
  router.get('/api/refly/v1/canvas/:id', (req, res) => { const c = canvases.get(req.params.id as string); c ? res.json(ok(c)) : res.status(404).json({ success: false }); });
  router.put('/api/refly/v1/canvas/:id', (req, res) => { const c = canvases.get(req.params.id as string); if (!c) return res.status(404).json({ success: false }); Object.assign(c, req.body ?? {}, { updatedAt: Date.now() }); res.json(ok(c)); });
  router.delete('/api/refly/v1/canvas/:id', (req, res) => { canvases.delete(req.params.id as string); res.json(ok({ ok: true })); });

  // Providers
  router.get('/api/refly/v1/provider/list', (_req, res) => res.json(ok(Array.from(providers.values()))));
  router.post('/api/refly/v1/provider/create', (req, res) => { const b = req.body ?? {}; const p = { providerId: b.providerId || ('custom-' + randomUUID().slice(0,8)), ...b, enabled: true }; providers.set(p.providerId, p); res.json(ok(p)); });
  router.post('/api/refly/v1/provider/update', (req, res) => { const b = req.body ?? {}; if (b.providerId && providers.has(b.providerId)) Object.assign(providers.get(b.providerId)!, b); res.json(ok({ ...b, updated: true })); });
  router.post('/api/refly/v1/provider/delete', (req, res) => { if (req.body?.providerId) providers.delete(req.body.providerId); res.json(ok({ ok: true })); });
  router.post('/api/refly/v1/provider/test-connection', async (req, res) => {
    let { apiKey, baseUrl, providerId } = req.body ?? {};
    if (!apiKey && providerId) { const s = providers.get(providerId); if (s) { apiKey = s.apiKey; baseUrl = s.baseUrl || baseUrl; } }
    if (!apiKey) return res.json(ok({ status: 'failed', message: 'API Key is required' }));
    try { const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 10000); const r = await fetch((baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '') + '/v1/models', { headers: { Authorization: 'Bearer ' + apiKey }, signal: ctrl.signal }); res.json(ok(r.ok ? { status: 'success', message: 'OK ' + r.status } : { status: 'failed', message: 'HTTP ' + r.status })); } catch (e: any) { res.json(ok({ status: 'failed', message: e?.message || String(e) })); }
  });

  // Provider Items
  router.get('/api/refly/v1/provider/item/list', (_req, res) => { const all: any[] = []; for (const items of providerItems.values()) all.push(...items); res.json(ok(all)); });
  router.get('/api/refly/v1/provider/item/option/list', (_req, res) => res.json(ok([])));
  router.post('/api/refly/v1/provider/item/create', (req, res) => { const b = req.body ?? {}; const pid = b.providerId || 'unknown'; const item = { ...b, itemId: b.itemId || ('item-' + randomUUID().slice(0,8)) }; providerItems.set(pid, [...(providerItems.get(pid) || []), item]); res.json(ok(item)); });
  router.post('/api/refly/v1/provider/item/batchCreate', (req, res) => { const pid = req.body?.providerId || 'unknown'; const items = (req.body?.items ?? []).map((item: any, i: number) => ({ ...item, itemId: item.itemId || ('item-' + randomUUID().slice(0,8)), providerId: pid })); providerItems.set(pid, [...(providerItems.get(pid) || []), ...items]); res.json(ok({ created: true, items })); });
  router.post('/api/refly/v1/provider/item/delete', (req, res) => { const { providerId: pid, itemId } = req.body ?? {}; if (pid && itemId) providerItems.set(pid, (providerItems.get(pid) || []).filter((i: any) => i.itemId !== itemId)); res.json(ok({ ok: true })); });

  // Models
  router.get('/api/refly/v1/model/list', (_req, res) => res.json(ok([{ modelId: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', providerKey: 'deepseek', category: 'llm', enabled: true }, { modelId: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', providerKey: 'deepseek', category: 'llm', enabled: true }])));
  router.get('/api/refly/v1/model/list/default', (_req, res) => res.json(ok({ llm: 'deepseek-v4-pro' })));
  router.put('/api/refly/v1/model/default', (_req, res) => res.json(ok({ ok: true })));

  // Action / Skill — workflow execution
  router.get('/api/refly/v1/action/result', (req, res) => {
    const r = results.get(req.query?.resultId as string);
    res.json(ok(r ?? { resultId: req.query?.resultId, status: 'finish' }));
  });
  router.post('/api/refly/v1/skill/invoke', (req, res) => {
    const id = req.body?.resultId || randomUUID();
    results.set(id, { resultId: id, status: 'finish', title: req.body?.title ?? '' });
    res.json(ok(results.get(id)));
  });
  router.post('/api/refly/v1/skill/streamInvoke', (req, res) => {
    const id = req.body?.resultId || randomUUID();
    const q = req.body?.input?.query || req.body?.title || '';
    results.set(id, { resultId: id, status: 'finish', title: req.body?.title ?? '' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    function sse(ev: string, d: any) { res.write('data: ' + JSON.stringify({ event: ev, resultId: id, ...d }) + '\n\n'); }
    sse('start', {});
    sse('stream', { content: 'Processing: ' + q });
    sse('end', { status: 'finish' });
    res.end();
  });

  // Misc
  router.get('/api/refly/v1/misc/public', (_req, res) => res.json(ok({ siteName: 'ShopAgent' })));
  router.get('/api/refly/v1/misc/promptSuggestions', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/form/definition', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/subscription', (_req, res) => res.json(ok({ plan: 'free', status: 'active' })));
  router.get('/api/refly/v1/subscription/modelList', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/notification/list', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/template/category/list', (_req, res) => res.json(ok([])));

  // Copilot / Credit / Drive / Schedule / Tools
  router.get('/api/refly/v1/copilot/session/list', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/copilot/session/detail', (_req, res) => res.json(ok({})));
  router.get('/api/refly/v1/credit/canvas', (_req, res) => res.json(ok({ available: true })));
  router.get('/api/refly/v1/credit/balance', (_req, res) => res.json(ok({ balance: 9999 })));
  router.get('/api/refly/v1/drive/file/list', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/tool/list', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/tool/inventory/list', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/tool/user/list', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/tool/toolset/list', (_req, res) => res.json(ok([])));
  router.get('/api/refly/v1/mcp-server/list', (_req, res) => res.json(ok([])));
  router.post('/api/refly/v1/schedule/list', (_req, res) => res.json(ok({ records: [], total: 0 })));
  router.post('/api/refly/v1/schedule/records/list', (_req, res) => res.json(ok({ records: [], total: 0 })));
  router.post('/api/refly/v1/schedule/records/tools', (_req, res) => res.json(ok([])));
  router.post('/api/refly/v1/canvas/workflow/variables', (_req, res) => res.json(ok([])));

  // Voucher
  router.get('/api/refly/v1/voucher/available', (_req, res) => res.json(ok([])));
  router.post('/api/refly/v1/voucher/invitation/claim', (_req, res) => res.json(ok({ claimed: true })));
  router.post('/api/refly/v1/voucher/validate', (_req, res) => res.json(ok({ valid: true })));

  console.log('[refly] Mock API routes registered');
}
