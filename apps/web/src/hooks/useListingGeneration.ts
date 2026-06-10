/**
 * Listing 生成状态管理 hook (M13)
 * 模块级 store，跨页面导航不丢失。
 * 移植自 ListingGen src/hooks/use-generation.ts 的状态管理模式。
 * Reference: PRD §6.2 M13
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  ListingOutput,
  ListingImageStatus,
  ListingProductInput,
  ListingRunStatus,
} from '@open-design/contracts';

// ─── 模块级 store（跨组件共享，导航不丢失） ─────────────

interface GenerationState {
  runId: string | null;
  status: 'idle' | 'llm_generating' | 'images_generating' | 'completed' | 'failed';
  output: ListingOutput | null;
  images: Map<string, ListingImageStatus>;
  error: string | null;
}

const moduleState: GenerationState = {
  runId: null,
  status: 'idle',
  output: null,
  images: new Map(),
  error: null,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

// ─── Daemon URL ─────────────────────────────────────────

function daemonUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:7456`;
  }
  return 'http://127.0.0.1:7456';
}

// ─── Hook ───────────────────────────────────────────────

export function useListingGeneration() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const startGeneration = useCallback(async (input: ListingProductInput & { skillId: string }): Promise<string> => {
    // Reset
    moduleState.status = 'llm_generating';
    moduleState.output = null;
    moduleState.images.clear();
    moduleState.error = null;
    notify();

    const base = daemonUrl();
    const res = await fetch(`${base}/api/listing/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ skillId: input.skillId, product: input }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      moduleState.status = 'failed';
      moduleState.error = (err as { error: string }).error;
      notify();
      throw new Error(moduleState.error ?? 'Generation failed');
    }

    // SSE stream — 使用已有的 processSseEvents 解析器
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    await processSseEvents(reader, {
      onStatus: (status) => {
        moduleState.status = status as GenerationState['status'];
        notify();
      },
      onOutput: (output) => {
        moduleState.output = output;
        moduleState.status = 'images_generating';
        notify();
      },
      onImage: (evt) => {
        moduleState.images.set(evt.moduleTag, {
          id: evt.moduleTag,
          moduleTag: evt.moduleTag,
          model: '',
          status: evt.status as ListingImageStatus['status'],
        });
        // 同步更新 output 中的图片状态
        if (moduleState.output && evt.status === 'completed' && evt.imageBase64) {
          applyImageToOutput(moduleState.output, evt.moduleTag, evt.imageBase64);
        }
        notify();
      },
      onDone: () => {
        if (moduleState.status !== 'failed') {
          moduleState.status = 'completed';
        }
        notify();
      },
      onError: (error) => {
        moduleState.status = 'failed';
        moduleState.error = error;
        notify();
      },
    });

    return moduleState.runId ?? '';
  }, []);

  const regenerateImage = useCallback(async (runId: string, imageId: string) => {
    const base = daemonUrl();
    const res = await fetch(`${base}/api/listing/runs/${runId}/images/${imageId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Regenerate failed');
  }, []);

  return {
    get runId() { return moduleState.runId; },
    get status() { return moduleState.status; },
    get output() { return moduleState.output; },
    get images() { return moduleState.images; },
    get error() { return moduleState.error; },
    startGeneration,
    regenerateImage,
    setRunId: (id: string | null) => { moduleState.runId = id; notify(); },
    setStatus: (s: GenerationState['status']) => { moduleState.status = s; notify(); },
    setOutput: (o: ListingOutput | null) => { moduleState.output = o; notify(); },
    updateImage: (tag: string, patch: ListingImageStatus) => {
      moduleState.images.set(tag, patch);
      notify();
    },
    setError: (e: string | null) => { moduleState.error = e; notify(); },
  };
}

/**
 * Raw SSE handler — parses event stream manually.
 * Call this from the SSE reader loop.
 */
export function processSseEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: {
    onStatus?: (status: string) => void;
    onToken?: (token: string) => void;
    onOutput?: (output: ListingOutput) => void;
    onImage?: (evt: { moduleTag: string; status: string; imageBase64?: string }) => void;
    onDone?: () => void;
    onError?: (error: string) => void;
  },
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  const pump = async (): Promise<void> => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6).trim());
            dispatchSse(currentEvent, data, callbacks);
          } catch { /* skip */ }
          currentEvent = '';
        }
      }
    }
  };

  return pump();
}

function dispatchSse(
  event: string,
  data: Record<string, unknown>,
  cbs: Parameters<typeof processSseEvents>[1],
) {
  switch (event) {
    case 'status':
      cbs.onStatus?.(data.status as string);
      break;
    case 'token':
      cbs.onToken?.(data.token as string);
      break;
    case 'output':
      cbs.onOutput?.(data as unknown as ListingOutput);
      break;
    case 'image':
      cbs.onImage?.(data as unknown as { moduleTag: string; status: string; imageBase64?: string });
      break;
    case 'done':
      cbs.onDone?.();
      break;
    case 'error':
      cbs.onError?.(data.error as string);
      break;
  }
}

/**
 * 将生图结果同步到 ListingOutput 结构中，确保 UI 组件能读取到最新的图片状态。
 * 移植自 ListingGen 原版的 updateDetailImage 逐图更新模式。
 */
function applyImageToOutput(output: ListingOutput, moduleTag: string, imageBase64: string): void {
  if (moduleTag === 'MAIN_A') { output.mainA.status = 'completed'; output.mainA.imageBase64 = imageBase64; }
  else if (moduleTag === 'MAIN_B') { output.mainB.status = 'completed'; output.mainB.imageBase64 = imageBase64; }
  else if (moduleTag === 'MAIN_C') { output.mainC.status = 'completed'; output.mainC.imageBase64 = imageBase64; }
  else if (moduleTag === 'VIDEO_COVER') { output.videoScript.coverImageBase64 = imageBase64; }
  else if (moduleTag.startsWith('DETAIL_')) {
    const idx = parseInt(moduleTag.split('_')[1]!) - 1;
    if (idx >= 0 && idx < output.details.length) {
      output.details[idx]!.status = 'completed';
      output.details[idx]!.imageBase64 = imageBase64;
    }
  }
}
