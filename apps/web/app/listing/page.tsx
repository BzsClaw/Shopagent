/**
 * Listing 工作台 — 复刻 ListingGen 原版：浏览器直连 API，daemon 只做 prompt + 解析
 */
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ListingProductInput, ListingOutput, ImageModule, DetailModule } from '@open-design/contracts';
import { navigate } from '../../src/router';
import { InputPanel } from '../../src/components/listing/InputPanel';
import { OutputPanel } from '../../src/components/listing/OutputPanel';
import { ApiKeySettings } from '../../src/components/listing/ApiKeySettings';
import styles from '../../src/components/listing/ListingWorkbench.module.css';

// ─── LLM 直连（复刻 ListingGen apimart.ts chatCompletion）───
async function chatCompletion(apiKey: string, baseUrl: string, model: string, prompt: string): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: '请严格按输出指令格式产出完整 Listing。' },
      ], temperature: 0.7, max_tokens: 4096, stream: false,
    }),
  });
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`API ${res.status}: ${t.slice(0, 300)}`); }
  const d = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const c = d.choices?.[0]?.message?.content;
  if (!c) throw new Error('API 返回空内容');
  return c.trim();
}

// ─── 生图直连（复刻 ListingGen apimart.ts generateImage）───
async function generateImageDirect(apiKey: string, baseUrl: string, model: string, prompt: string, referenceImage?: string): Promise<string | null> {
  const body: Record<string, unknown> = { model, prompt, n: 1 };
  const isDoubao = model.includes('doubao') || model.includes('seedance');
  const isGptImage = model.includes('gpt-image') || model.includes('gpt-image-2');
  if (!isDoubao && !isGptImage) body.response_format = 'b64_json';
  if (isGptImage) body.size = '1:1';

  // 图生图：传入参考图（产品白底图），三模型参数名不同
  if (referenceImage?.startsWith('data:image')) {
    if (isGptImage) { body.image_urls = [referenceImage]; }
    else { body.image = referenceImage; }
  }

  const submitRes = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const submitJson = await submitRes.json() as Record<string, unknown>;
  if (submitJson.error) { console.error('[Gen] submit error:', String(submitJson.error).slice(0, 200)); return null; }
  const data = submitJson.data as Array<Record<string, unknown>> | undefined;
  if (!data?.length) return null;

  const taskId = data[0]?.task_id as string | undefined;
  if (!taskId) {
    if (data[0]?.url) return data[0].url as string;
    if (data[0]?.b64_json) return `data:image/png;base64,${data[0].b64_json}`;
    return null;
  }
  const maxPolls = model.includes('doubao') || model.includes('seedance') || model.includes('gpt') || model.includes('image-2') ? 180 : 20;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const pollRes = await fetch(`${baseUrl}/tasks/${taskId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      const pollJson = await pollRes.json() as Record<string, unknown>;
      const pollData = (pollJson.data || pollJson) as Record<string, unknown>;
      if (['success','completed','done'].includes(pollData.status as string)) {
        const r = (pollData.result || pollData.output || pollData) as Record<string, unknown>;
        const imgs = (r?.images || r?.data || r?.image_urls) as unknown;
        const img = Array.isArray(imgs) ? imgs[0] : imgs;
        if (!img) return null;
        let url: string | null = null;
        if (typeof img === 'string') url = img;
        else if (typeof img === 'object') { const o = img as Record<string, unknown>; const u = o.url; url = Array.isArray(u) ? u[0] as string : typeof u === 'string' ? u : (o.image_url || o.output_url || o.src || '') as string; if (o.b64_json) return `data:image/png;base64,${o.b64_json}`; }
        if (url) {
          if (url.startsWith('data:')) return url;
          const dr = await fetch(url); const buf = await dr.arrayBuffer(); const bytes = new Uint8Array(buf); let bin = ''; for (let j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]!);
          return `data:${dr.headers.get('content-type') || 'image/jpeg'};base64,${btoa(bin)}`;
        }
        return null;
      }
      if (['failed','error'].includes(pollData.status as string)) return null;
    } catch { /* retry */ }
  }
  return null;
}

// ─── 页面 ────────────────────────────────────────────────

export default function ListingPage() {
  useEffect(() => { document.title = 'Listing 工作台 — Open Yourself'; }, []);

  const [output, setOutput] = useState<ListingOutput | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const imagesRef = useRef<Map<string, { status: string; imageBase64?: string }>>(new Map());
  const productImageRef = useRef<string | undefined>(undefined); // 产品白底图 base64，用于图生图参考
  const [, setTick] = useState(0);

  const updateImage = useCallback((tag: string, p: { status: string; imageBase64?: string }) => {
    imagesRef.current.set(tag, { ...imagesRef.current.get(tag), ...p });
    setTick(n => n + 1);

    // 同步更新 output 状态，确保 ImageCard UI 能立刻看到生图进度
    setOutput(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      if (tag === 'MAIN_A') { next.mainA.status = p.status as ImageModule['status']; if (p.imageBase64) next.mainA.imageBase64 = p.imageBase64; }
      else if (tag === 'MAIN_B') { next.mainB.status = p.status as ImageModule['status']; if (p.imageBase64) next.mainB.imageBase64 = p.imageBase64; }
      else if (tag === 'MAIN_C') { next.mainC.status = p.status as ImageModule['status']; if (p.imageBase64) next.mainC.imageBase64 = p.imageBase64; }
      else if (tag === 'VIDEO_COVER') { if (p.imageBase64) next.videoScript.coverImageBase64 = p.imageBase64; }
      else if (tag.startsWith('DETAIL_')) {
        const idx = parseInt(tag.split('_')[1]!) - 1;
        if (idx >= 0 && idx < next.details.length) {
          next.details[idx]!.status = p.status as DetailModule['status'];
          if (p.imageBase64) next.details[idx]!.imageBase64 = p.imageBase64;
        }
      }
      return next;
    });
  }, []);

  // ─── 拖拽分割线 ───
  const [leftPct, setLeftPct] = useState(40);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setLeftPct(Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 28), 62));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  // ─── 保存到项目 ───
  const handleSave = useCallback(async () => {
    if (!productImageRef.current) return;
    setSaving(true);
    try {
      const res = await fetch('/api/listing/save-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: output?.titleA?.text?.split(' ').slice(0,6).join(' ') || 'Listing Project',
          productImageBase64: productImageRef.current,
          output,
          imageResults: Array.from(imagesRef.current.entries()).map(([tag, data]) => ({ tag, ...data })),
        }),
      });
      if (!res.ok) { const e = await res.json().catch(()=>({error:'Unknown'})); throw new Error(e.error || 'Save failed'); }
      const { projectId } = await res.json() as { projectId: string };
      navigate({ kind: 'project', projectId, conversationId: null, fileName: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  }, [output]);

  const canSave = status === 'done' && !!output;

  // ─── 生成文案（浏览器直连 DeepSeek，原版方式）───
  const handleGenerateText = useCallback(async (input: ListingProductInput) => {
    setGenerating(true); setStatus('llm_generating'); setOutput(null); setError(null);
    productImageRef.current = input.productImageBase64; // 保存参考图供生图队列使用

    try {
      // 1. 从 daemon 获取组装好的 prompt
      const promptRes = await fetch('/api/listing/build-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: 'shopee-listing-v3', product: input }),
      });
      if (!promptRes.ok) throw new Error('Failed to build prompt');
      const { prompt } = await promptRes.json() as { prompt: string };

      // 2. 浏览器直连 DeepSeek API
      const llmKey = localStorage.getItem('shopagent:deepseekKey') || '';
      const llmUrl = localStorage.getItem('shopagent:deepseekUrl') || 'https://api.deepseek.com/v1';
      if (!llmKey) throw new Error('请在设置中填入 DeepSeek API Key');

      const rawText = await chatCompletion(llmKey, llmUrl, 'deepseek-chat', prompt);

      // 3. 发送给 daemon 解析 + 存储
      const parseRes = await fetch('/api/listing/parse-output', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: 'shopee-listing-v3', product: input, rawOutput: rawText }),
      });
      if (!parseRes.ok) throw new Error('Failed to parse output');
      const parsed = await parseRes.json() as ListingOutput;
      setOutput(parsed);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('failed');
    }
    setGenerating(false);
  }, []);

  // ─── 生图队列（浏览器直连 APIMart，原版方式）───
  // 图生图需要参考白底图的模块 tag
  const IMG2IMG_TAGS = new Set(['MAIN_A', 'MAIN_B', 'MAIN_C', 'DETAIL_2', 'DETAIL_3', 'DETAIL_4', 'VIDEO_COVER']);

  const queueRef = useRef<Array<{ moduleTag: string; prompt: string; needsRef: boolean }>>([]);
  const processingRef = useRef(false);
  const [queueSize, setQueueSize] = useState(0);

  const enqueue = useCallback((moduleTag: string, prompt: string) => {
    console.log('[ShopAgent] enqueue:', moduleTag, 'prompt len:', prompt?.length || 0);
    if (!prompt) { console.warn('[ShopAgent] enqueue skipped: empty prompt'); return; }
    const needsRef = IMG2IMG_TAGS.has(moduleTag);
    queueRef.current.push({ moduleTag, prompt, needsRef });
    setQueueSize(queueRef.current.length);
    updateImage(moduleTag, { status: 'generating' });
  }, [updateImage]);

  const processQueue = useCallback(async () => {
    console.log('[ShopAgent] processQueue called, queue len:', queueRef.current.length);
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const task = queueRef.current.shift()!;
      setQueueSize(queueRef.current.length);
      try {
        const imgKey = localStorage.getItem('shopagent:apimartKey') || '';
        const imgUrl = localStorage.getItem('shopagent:apimartUrl') || 'https://api.apimart.ai/v1';
        const imgModel = localStorage.getItem('shopagent:imageModel') || 'gemini-3.1-flash-image-preview';
        if (!imgKey) { updateImage(task.moduleTag, { status: 'failed' }); continue; }
        // 图生图类：传入产品白底图作为参考图
        const ref = task.needsRef && productImageRef.current
          ? `data:image/png;base64,${productImageRef.current}`
          : undefined;
        const r = await generateImageDirect(imgKey, imgUrl, imgModel, task.prompt, ref);
        updateImage(task.moduleTag, { status: r ? 'completed' : 'failed', imageBase64: r || undefined });
      } catch { updateImage(task.moduleTag, { status: 'failed' }); }
    }
    processingRef.current = false;
    setQueueSize(0);
  }, [updateImage]);

  useEffect(() => { if (queueSize > 0) processQueue(); }, [queueSize, processQueue]);

  const handleRegenerateImage = useCallback((moduleTag: string, prompt: string) => {
    console.log('[ShopAgent] handleRegenerateImage:', moduleTag, 'prompt:', prompt?.slice(0, 30));
    enqueue(moduleTag, prompt);
  }, [enqueue]);

  return (
    <div className={styles.workbench}>
      <header className={styles.chrome}>
        <button
          className={styles.backBtn}
          onClick={() => navigate({ kind: 'home', view: 'home' })}
          title="回到主页"
        >← 主页</button>
        <span className={styles.logo}>📋</span>
        <h1 className={styles.title}>Listing 工作台</h1>
        <span className={styles.badge}>Shopee v3</span>

        <div style={{ flex: 1 }} />
        {status === 'llm_generating' && <span className={styles.statusPill}><span className={styles.pillSpinner} /> AI 文案生成中...</span>}
        {status === 'done' && <span className={styles.statusDone}>✓ 完成</span>}
        {status === 'failed' && <span className={styles.statusFail}>✗ 失败</span>}
        <button className={styles.settingsBtn} onClick={() => setSettingsOpen(true)} title="设置">⚙</button>
      </header>

      <div ref={containerRef} className={`${styles.split} ${dragging ? styles.dragging : ''}`}>
        <div style={{ width: `${leftPct}%` }} className={styles.leftPane}>
          <InputPanel onGenerate={handleGenerateText} generating={generating} onSave={handleSave} canSave={canSave} saving={saving} />
        </div>
        <div className={`${styles.divider} ${dragging ? styles.dividerActive : ''}`} onMouseDown={() => setDragging(true)} />
        <div className={styles.rightPane}>
          <OutputPanel output={output} status={status} onRegenerateImage={handleRegenerateImage} />
        </div>
      </div>

      {settingsOpen && (
        <div className={styles.modalOverlay} onClick={() => setSettingsOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>⚙ API 配置</span>
              <button className={styles.modalClose} onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <ApiKeySettings />
          </div>
        </div>
      )}
    </div>
  );
}
