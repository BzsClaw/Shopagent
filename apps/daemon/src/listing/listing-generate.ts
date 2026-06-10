/**
 * Listing 生成调度 (M5) — 复刻 ListingGen apimart.ts 的 API 调用模式
 * 使用 OpenAI-compatible API（DeepSeek / APIMart 中转站）
 * 支持流式 SSE（token 逐字推送）和非流式两种模式。
 */
import type { ListingGenerateRequest, ListingOutput } from '@open-design/contracts';
import { loadListingSkill, buildListingPrompt } from './skill-loader.js';
import { parseListingOutput } from './tag-parser.js';
import { createListingRun, updateListingRun, createListingImage } from './listing-db.js';

// ─── 常量 ──────────────────────────────────────────────

const LLM_TIMEOUT_MS = 120_000; // LLM 调用超时 120s
const LLM_MAX_TOKENS = 4096;

// ─── generateListing ───────────────────────────────────

export interface GenerateResult { runId: string; output: ListingOutput; }

export async function generateListing(
  req: ListingGenerateRequest,
  opts: {
    onToken?: (token: string) => void;
    onStatus?: (status: string) => void;
    onOutput?: (output: ListingOutput) => void;
  } = {},
): Promise<GenerateResult> {
  const llmApiKey = req.llmApiKey || process.env.DEEPSEEK_API_KEY;
  const llmBaseUrl = req.llmBaseUrl || 'https://api.deepseek.com/v1';
  if (!llmApiKey) throw Object.assign(
    new Error('DeepSeek API Key 未配置。请在设置中填入 Key，或设置环境变量 DEEPSEEK_API_KEY。'),
    { statusCode: 400 },
  );

  const skill = loadListingSkill(req.skillId);
  if (!skill) throw Object.assign(
    new Error(`Skill not found: ${req.skillId}`),
    { statusCode: 400 },
  );

  const prompt = buildListingPrompt(skill, req.product);

  const runId = createListingRun({
    skillId: req.skillId, platform: skill.platform, productData: req.product,
    ...(req.projectId ? { projectId: req.projectId } : {}),
  });
  updateListingRun(runId, { status: 'llm_generating' });
  opts.onStatus?.('llm_generating');

  let rawOutput: string;
  try {
    // 如果有 onToken 回调 → 流式；否则 → 非流式（更快，适合 CLI --json）
    const wantsStream = !!opts.onToken;
    rawOutput = wantsStream
      ? await chatCompletionStream(llmApiKey, 'deepseek-chat', [
          { role: 'system', content: prompt },
          { role: 'user', content: '请严格按输出指令格式产出完整 Listing。' },
        ], llmBaseUrl, opts.onToken!)
      : await chatCompletion(llmApiKey, 'deepseek-chat', [
          { role: 'system', content: prompt },
          { role: 'user', content: '请严格按输出指令格式产出完整 Listing。' },
        ], llmBaseUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateListingRun(runId, { status: 'failed', error: message });
    throw err;
  }

  opts.onStatus?.('parsing');
  let output: ListingOutput;
  try {
    output = parseListingOutput(rawOutput);
  } catch (err) {
    const message = `解析 LLM 输出失败: ${err instanceof Error ? err.message : String(err)}`;
    updateListingRun(runId, { status: 'failed', error: message });
    throw Object.assign(new Error(message), { statusCode: 500 });
  }

  updateListingRun(runId, { resultData: output, status: 'images_generating' });
  opts.onOutput?.(output);
  createImagePlaceholders(runId, output);
  return { runId, output };
}

// ─── chatCompletion（非流式） ──────────────────────────

async function chatCompletion(
  apiKey: string, model: string,
  messages: Array<{ role: string; content: string }>,
  baseUrl: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: LLM_MAX_TOKENS, stream: false }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error(`API Key 无效 (HTTP ${res.status})。请检查 DeepSeek API Key 是否正确。`);
      }
      if (res.status === 429) {
        throw new Error('API 调用频率超限，请稍后重试。');
      }
      throw new Error(`API 返回错误 (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('API 返回空内容，请检查输入是否完整。');
    return content.trim();
  } catch (err) {
    if (err instanceof DOMException || (err as Error).name === 'AbortError') {
      throw new Error(`LLM 调用超时 (${LLM_TIMEOUT_MS / 1000}s)，请稍后重试。`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── chatCompletionStream（流式，token 逐字推送）───────

async function chatCompletionStream(
  apiKey: string, model: string,
  messages: Array<{ role: string; content: string }>,
  baseUrl: string,
  onToken: (token: string) => void,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let fullContent = '';

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: LLM_MAX_TOKENS, stream: true }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error(`API Key 无效 (HTTP ${res.status})。请检查 DeepSeek API Key。`);
      }
      throw new Error(`API 返回错误 (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('响应体为空');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            fullContent += token;
            onToken(token);
          }
        } catch { /* 跳过非 JSON 行 */ }
      }
    }
  } catch (err) {
    // 如果已有部分内容（超时前收到了部分 token），保留已有内容
    if (fullContent) {
      console.warn(`LLM stream interrupted after ${fullContent.length} chars: ${err instanceof Error ? err.message : String(err)}`);
      return fullContent.trim();
    }
    if (err instanceof DOMException || (err as Error).name === 'AbortError') {
      throw new Error(`LLM 调用超时 (${LLM_TIMEOUT_MS / 1000}s)，请稍后重试。`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  return fullContent.trim();
}

// ─── 导出 chatCompletion 供 test-connection 使用 ──────────

export async function testLlmConnection(apiKey: string, baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch { return false; }
}

// ─── Image placeholders ─────────────────────────────────

function createImagePlaceholders(runId: string, output: ListingOutput): void {
  const model = process.env.APIMART_DEFAULT_MODEL || 'gemini-3.1-flash-image-preview';
  const modules: Array<{ tag: string; prompt: string }> = [
    { tag: 'MAIN_A', prompt: output.mainA.prompt },
    { tag: 'MAIN_B', prompt: output.mainB.prompt },
    { tag: 'MAIN_C', prompt: output.mainC.prompt },
  ];
  for (const d of output.details) {
    if (d.prompt) modules.push({ tag: `DETAIL_${d.index}`, prompt: d.prompt });
  }
  if (output.videoScript.coverPrompt) {
    modules.push({ tag: 'VIDEO_COVER', prompt: output.videoScript.coverPrompt });
  }
  for (const m of modules) {
    if (!m.prompt) continue;
    createListingImage({ runId, moduleTag: m.tag, model, prompt: m.prompt });
  }
}
