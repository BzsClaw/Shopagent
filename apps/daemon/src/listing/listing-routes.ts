/**
 * Listing HTTP API 路由 (M4)
 * 注册到 OD server.ts 的 /api/listing/* 路径下。
 * Reference: PRD §6.2 M4, OD apps/daemon/src/chat-routes.ts
 */
import type { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Safely extract a single string from Express req.params */
function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}
import type {
  ListingGenerateRequest,
  ListingRunStatus,
  ListingImageStatus,
  ListingProductInput,
  ListingOutput,
} from '@open-design/contracts';
import { listListingSkills, loadListingSkill, buildListingPrompt } from './skill-loader.js';
import { parseListingOutput } from './tag-parser.js';
import { generateListing } from './listing-generate.js';
import { processImageQueue, regenerateSingleImage, generateImage as generateImageDirect } from './listing-images.js';
import {
  getListingRun,
  updateListingRun,
  listListingRuns,
  getListingImage,
  listListingImages,
  createListingRun,
  createListingImage,
} from './listing-db.js';

// ─── 数据目录解析（与 db.ts 一致） ──────────────────

function resolveDataDir(): string {
  const root = process.env.OD_WORKSPACE_ROOT || process.cwd();
  const override = process.env.OD_DATA_DIR;
  const dir = override ? path.resolve(override) : path.join(root, '.od');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

const DATA_DIR = resolveDataDir();
const KEYWORD_FILE = path.join(DATA_DIR, 'listing-keywords.json');
const PROMPT_FILE = path.join(DATA_DIR, 'listing-prompts.json');

// ─── 关键词/模板库（文件持久化） ──────────────────

let keywordStore: Record<string, string[]> = {};
let promptStore: Record<string, string[]> = {};

function loadStores(): void {
  try { if (existsSync(KEYWORD_FILE)) keywordStore = JSON.parse(readFileSync(KEYWORD_FILE, 'utf-8')); } catch { /* */ }
  try { if (existsSync(PROMPT_FILE)) promptStore = JSON.parse(readFileSync(PROMPT_FILE, 'utf-8')); } catch { /* */ }
}

function saveKeywordStore(): void {
  try { writeFileSync(KEYWORD_FILE, JSON.stringify(keywordStore, null, 2), 'utf-8'); } catch { /* */ }
}

function savePromptStore(): void {
  try { writeFileSync(PROMPT_FILE, JSON.stringify(promptStore, null, 2), 'utf-8'); } catch { /* */ }
}

// 模块加载时从文件恢复
loadStores();

// ─── 路由注册 ──────────────────────────────────────────

export function registerListingRoutes(router: Router): void {
  // GET /api/listing/skills
  router.get('/api/listing/skills', (_req: Request, res: Response) => {
    try {
      const skills = listListingSkills();
      res.json(skills);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list skills' });
    }
  });

  // POST /api/listing/generate
  router.post('/api/listing/generate', async (req: Request, res: Response) => {
    try {
      const body = req.body as ListingGenerateRequest;
      if (!body.skillId || !body.product?.productName || !body.product?.surfaceKeywords) {
        res.status(400).json({ error: 'Missing required fields: skillId, product.productName, product.surfaceKeywords' });
        return;
      }

      // 检查 Accept header 决定 SSE vs JSON
      const acceptSse = req.headers.accept?.includes('text/event-stream');

      if (acceptSse) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const sse = (event: string, data: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try {
          const result = await generateListing(body, {
            onStatus: (status) => sse('status', { status }),
            onToken: (token) => sse('token', { token }),
            onOutput: (output) => sse('output', output),
          });

          // 触发异步生图
          const refImage = body.product.productImageBase64;
          const imgApiKey = body.imageApiKey || process.env.APIMART_API_KEY || '';
          const imgBaseUrl = body.imageBaseUrl || process.env.APIMART_API_BASE || '';
          const imgModel = body.imageModel || process.env.APIMART_DEFAULT_MODEL || 'gemini-3.1-flash-image-preview';
          if (imgApiKey) {
            processImageQueue(result.runId, refImage, imgApiKey, imgBaseUrl, imgModel, (evt) => {
              sse('image', evt);
            }).catch((err) => {
              sse('error', { error: err instanceof Error ? err.message : String(err) });
            }).finally(() => {
              updateListingRun(result.runId, { status: 'completed' });
              sse('done', { status: 'completed', runId: result.runId });
              res.end();
            });
          } else {
            updateListingRun(result.runId, { status: 'completed' });
            sse('done', { status: 'completed', runId: result.runId });
            res.end();
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const statusCode = (err as Record<string, unknown>).statusCode as number | undefined;
          sse('error', { error: message, statusCode });
          res.end();
        }
      } else {
        // JSON 响应（先返回 runId，不等待）
        const result = await generateListing(body);
        const refImage = body.product.productImageBase64;
        const imgApiKey = body.imageApiKey || process.env.APIMART_API_KEY || '';
        const imgBaseUrl = body.imageBaseUrl || process.env.APIMART_API_BASE || '';
        const imgModel = body.imageModel || process.env.APIMART_DEFAULT_MODEL || 'gemini-3.1-flash-image-preview';
        if (imgApiKey) {
          processImageQueue(result.runId, refImage, imgApiKey, imgBaseUrl, imgModel).catch((err) => {
            console.error('Image queue error:', err);
          }).finally(() => {
            updateListingRun(result.runId, { status: 'completed' });
          });
        } else {
          updateListingRun(result.runId, { status: 'completed' });
        }
        res.json({ runId: result.runId, status: 'images_generating' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const statusCode = (err as Record<string, unknown>).statusCode as number | undefined;
      res.status(statusCode ?? 500).json({ error: message });
    }
  });

  // GET /api/listing/runs/:id
  router.get('/api/listing/runs/:id', (req: Request, res: Response) => {
    const run = getListingRun(param(req, 'id'));
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }

    const images = listListingImages(run.id);
    const imageStatuses: ListingImageStatus[] = images.map((img) => ({
      id: img.id,
      moduleTag: img.moduleTag,
      model: img.model,
      status: img.status,
    }));

    const status: ListingRunStatus = {
      id: run.id,
      status: run.status as ListingRunStatus['status'],
      images: imageStatuses,
    };
    if (run.resultData) status.output = run.resultData;
    if (run.error) status.error = run.error;
    res.json(status);
  });

  // POST /api/listing/runs/:id/images/:imageId/regenerate
  router.post('/api/listing/runs/:id/images/:imageId/regenerate', async (req: Request, res: Response) => {
    try {
      const imageId = param(req, 'imageId');
      const regenBody = req.body as {
        prompt?: string; referenceImageBase64?: string; modelId?: string;
        imageApiKey?: string; imageBaseUrl?: string;
      };

      const image = getListingImage(imageId!);
      if (!image) { res.status(404).json({ error: 'Image not found' }); return; }

      const acceptSse = req.headers.accept?.includes('text/event-stream');
      if (acceptSse) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const sse = (event: string, data: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try {
          await regenerateSingleImage(
            imageId!,
            regenBody.prompt ?? image.prompt,
            regenBody.referenceImageBase64,
            regenBody.imageApiKey || process.env.APIMART_API_KEY || '',
            regenBody.imageBaseUrl || process.env.APIMART_API_BASE || '',
            regenBody.modelId ?? image.model,
            (evt) => sse('image', evt),
          );
          sse('done', { status: 'completed' });
        } catch (err) {
          sse('error', { error: err instanceof Error ? err.message : String(err) });
        }
        res.end();
      } else {
        await regenerateSingleImage(
          imageId!,
          regenBody.prompt ?? image.prompt,
          regenBody.referenceImageBase64,
          regenBody.imageApiKey || process.env.APIMART_API_KEY || '',
          regenBody.imageBaseUrl || process.env.APIMART_API_BASE || '',
          regenBody.modelId ?? image.model,
        );
        res.json({ status: 'completed' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/listing/keywords
  router.get('/api/listing/keywords', (_req: Request, res: Response) => {
    res.json(keywordStore);
  });

  // POST /api/listing/keywords
  router.post('/api/listing/keywords', (req: Request, res: Response) => {
    try {
      keywordStore = { ...keywordStore, ...(req.body as Record<string, string[]>) };
      saveKeywordStore();
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: 'Invalid keyword data' });
    }
  });

  // GET /api/listing/prompts
  router.get('/api/listing/prompts', (_req: Request, res: Response) => {
    res.json(promptStore);
  });

  // POST /api/listing/prompts
  router.post('/api/listing/prompts', (req: Request, res: Response) => {
    try {
      promptStore = { ...promptStore, ...(req.body as Record<string, string[]>) };
      savePromptStore();
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: 'Invalid prompt data' });
    }
  });

  // GET /api/listing/runs
  router.get('/api/listing/runs', (req: Request, res: Response) => {
    const projectId = req.query.projectId as string | undefined;
    const runs = listListingRuns(projectId);
    res.json(runs.map((r) => ({
      id: r.id,
      skillId: r.skillId,
      platform: r.platform,
      status: r.status,
      createdAt: r.createdAt,
    })));
  });

  // POST /api/listing/build-prompt — 浏览器调用，获取组装好的 prompt
  router.post('/api/listing/build-prompt', (req: Request, res: Response) => {
    try {
      const { skillId, product } = req.body as { skillId: string; product: ListingProductInput };
      const skill = loadListingSkill(skillId);
      if (!skill) { res.status(400).json({ error: 'Skill not found' }); return; }
      const prompt = buildListingPrompt(skill, product);
      res.json({ prompt });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/listing/parse-output — 浏览器调用，解析 LLM 输出并存储
  router.post('/api/listing/parse-output', (req: Request, res: Response) => {
    try {
      const { rawOutput, skillId, product } = req.body as { rawOutput: string; skillId: string; product: ListingProductInput };
      const skill = loadListingSkill(skillId);
      const platform = skill?.platform || 'shopee';
      const runId = createListingRun({ skillId, platform, productData: product });
      const output = parseListingOutput(rawOutput);
      updateListingRun(runId, { resultData: output, status: 'completed' });
      createImagePlaceholders(runId, output);
      res.json(output);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/listing/images/generate — 直接生图代理（前端调用）
  router.post('/api/listing/images/generate', async (req: Request, res: Response) => {
    try {
      const { prompt, referenceImageBase64, apiKey, baseUrl, model } = req.body as {
        prompt: string; referenceImageBase64?: string;
        apiKey: string; baseUrl: string; model: string;
      };
      if (!prompt || !apiKey || !baseUrl) {
        res.status(400).json({ error: 'Missing prompt, apiKey, or baseUrl' }); return;
      }
      const result = await generateImageDirect(apiKey, model, prompt, baseUrl, referenceImageBase64);
      res.json({ ok: true, imageBase64: result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  function createImagePlaceholders(runId: string, output: ListingOutput): void {
    const model = process.env.APIMART_DEFAULT_MODEL || 'gemini-3.1-flash-image-preview';
    const mods: Array<{ tag: string; prompt: string }> = [
      { tag: 'MAIN_A', prompt: output.mainA.prompt },
      { tag: 'MAIN_B', prompt: output.mainB.prompt },
      { tag: 'MAIN_C', prompt: output.mainC.prompt },
    ];
    for (const d of output.details) { if (d.prompt) mods.push({ tag: `DETAIL_${d.index}`, prompt: d.prompt }); }
    if (output.videoScript.coverPrompt) mods.push({ tag: 'VIDEO_COVER', prompt: output.videoScript.coverPrompt });
    for (const m of mods) { if (m.prompt) createListingImage({ runId, moduleTag: m.tag, model, prompt: m.prompt }); }
  }

  // POST /api/listing/test-connection
  router.post('/api/listing/test-connection', async (req: Request, res: Response) => {
    try {
      const { type, apiKey, baseUrl } = req.body as { type: string; apiKey: string; baseUrl?: string };
      const url = baseUrl ?? (
        type === 'deepseek' ? 'https://api.deepseek.com/v1' :
        type === 'apimart' ? (process.env.APIMART_API_BASE || 'https://api.apimart.ai/v1') :
        ''
      );
      if (!url) { res.status(400).json({ error: 'Unknown connection type' }); return; }

      const resp = await fetch(`${url}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const ok = resp.ok;
      const errorText = ok ? undefined : await resp.text().catch(() => '');
      res.json({ ok, error: errorText?.slice(0, 200) });
    } catch (err) {
      res.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/listing/save-project — 保存 listing 输出为项目
  router.post('/api/listing/save-project', async (req: Request, res: Response) => {
    try {
      const { productName, productImageBase64, output, imageResults } = req.body as {
        productName: string;
        productImageBase64?: string;
        output?: Record<string, unknown>;
        imageResults?: Array<{ tag: string; status: string; imageBase64?: string }>;
      };

      if (!productName) { res.status(400).json({ error: 'productName required' }); return; }
      if (!productImageBase64) { res.status(400).json({ error: 'productImageBase64 required' }); return; }

      const projectId = crypto.randomUUID();
      const projectsDir = path.join(DATA_DIR, 'projects', projectId);
      mkdirSync(projectsDir, { recursive: true });

      // 写入产品图
      writeFileSync(path.join(projectsDir, 'product.png'), Buffer.from(productImageBase64, 'base64'));

      // 写入 listing 完整数据
      writeFileSync(
        path.join(projectsDir, 'listing-output.json'),
        JSON.stringify({ productName, output: output || null, images: imageResults || [], savedAt: new Date().toISOString() }, null, 2),
        'utf-8',
      );

      // 调用 daemon 内部 API 创建项目记录
      const daemonPort = process.env.OD_PORT || '7456';
      const createRes = await fetch(`http://127.0.0.1:${daemonPort}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: projectId,
          name: productName,
          metadata: { kind: 'other', nameSource: 'prompt', listingProject: true },
        }),
      });

      if (!createRes.ok) {
        const text = await createRes.text().catch(() => '');
        res.status(500).json({ error: `Project creation failed: ${text.slice(0, 200)}` });
        return;
      }

      res.json({ projectId });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}
