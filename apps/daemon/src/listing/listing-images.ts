/**
 * 多模型生图 — 完全复刻 ListingGen src/lib/apimart.ts
 * 三模型适配（Gemini/Seedance/GPT-Image-2）+ 串行队列
 */
import { listListingImages, updateListingImage, getListingImage } from './listing-db.js';

// ─── generateImage — 复刻 ListingGen apimart.ts generateImage ────

export async function generateImage(
  apiKey: string, model: string, prompt: string,
  baseUrl: string, referenceImage?: string,
): Promise<string | null> {
  const hasRef = referenceImage && referenceImage.startsWith('data:image');

  if (hasRef) {
    const result = await tryGenerate(apiKey, model, prompt, baseUrl, referenceImage);
    if (result) return result;
    console.log('generateImage: retrying without reference image');
  }
  return tryGenerate(apiKey, model, prompt, baseUrl);
}

// ─── getMaxPolls — 复刻原版 ─────────────────────────────

function getMaxPolls(model: string): number {
  if (model.includes('doubao') || model.includes('seedance')) return 180;
  if (model.includes('gpt') || model.includes('image-2')) return 180;
  return 20; // Gemini
}

// ─── tryGenerate — 复刻原版 tryGenerate ──────────────────

async function tryGenerate(
  apiKey: string, model: string, prompt: string,
  baseUrl: string, referenceImage?: string,
): Promise<string | null> {
  const submitBody: Record<string, unknown> = { model, prompt, n: 1 };

  const isDoubao = model.includes('doubao') || model.includes('seedance');
  const isGptImage = model.includes('gpt-image') || model.includes('gpt-image-2');
  const isGemini = model.includes('gemini');

  if (!isDoubao && !isGptImage) {
    submitBody.response_format = 'b64_json';
  }

  if (referenceImage?.startsWith('data:image')) {
    if (isGptImage) {
      submitBody.image_urls = [referenceImage];
    } else {
      submitBody.image = referenceImage;
    }
  }

  if (isGptImage) {
    submitBody.size = '1:1';
  }

  console.log(`[Gen] submit model=${model}, hasRef=${!!referenceImage}`);
  const submitRes = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(submitBody),
  });
  const submitJson = await submitRes.json() as Record<string, unknown>;

  if (submitJson.error) {
    console.error('[Gen] submit error:', JSON.stringify(submitJson.error).substring(0, 300));
    return null;
  }

  const data = submitJson.data as Array<Record<string, unknown>> | undefined;
  if (!data || data.length === 0) {
    console.error('[Gen] submit returned no data:', JSON.stringify(submitJson).substring(0, 300));
    return null;
  }

  const taskId = data[0]?.task_id as string | undefined;
  if (!taskId) {
    if (data[0]?.url) return data[0].url as string;
    if (data[0]?.b64_json) return `data:image/png;base64,${data[0].b64_json}`;
    return null;
  }

  const maxPolls = getMaxPolls(model);
  for (let i = 0; i < maxPolls; i++) {
    await sleep(3000);
    try {
      const pollRes = await fetch(`${baseUrl}/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const pollJson = await pollRes.json() as Record<string, unknown>;
      const pollData = (pollJson.data || pollJson) as Record<string, unknown>;
      const status = pollData.status as string;

      if (status === 'success' || status === 'completed' || status === 'done') {
        const result = (pollData.result || pollData.output || pollData) as Record<string, unknown>;
        const images = (result?.images || result?.data || result?.image_urls) as unknown;
        const imgData = Array.isArray(images) ? images[0] : images;

        if (imgData) {
          let imageUrl: string | null = null;
          if (typeof imgData === 'string') imageUrl = imgData;
          else if (imgData && typeof imgData === 'object') {
            const d = imgData as Record<string, unknown>;
            const urlVal = d.url;
            if (Array.isArray(urlVal)) imageUrl = urlVal[0] as string;
            else if (typeof urlVal === 'string') imageUrl = urlVal;
            else imageUrl = (d.image_url || d.output_url || d.src || '') as string;
          }

          if (imageUrl && typeof imageUrl === 'string') {
            console.log(`[Gen] image ready (${i + 1} polls, ${(i + 1) * 3}s)`);
            try {
              return await downloadImageAsBase64(imageUrl);
            } catch (e) {
              console.error('[Gen] download failed:', e);
              return null;
            }
          }
          if (imgData && typeof imgData === 'object') {
            const b64 = (imgData as Record<string, unknown>).b64_json as string | undefined;
            if (b64) return `data:image/png;base64,${b64}`;
          }
        }
        console.error('[Gen] completed but no image found:', JSON.stringify(pollData).substring(0, 300));
        return null;
      }

      if (status === 'failed' || status === 'error') {
        console.error('[Gen] task failed:', JSON.stringify(pollData.error || pollData.message || 'unknown').substring(0, 200));
        return null;
      }

      if (i % 10 === 0 && i > 0) {
        console.log(`[Gen] polling... ${i * 3}s, status=${status}`);
      }
    } catch (e) {
      console.error('[Gen] poll error:', e);
    }
  }
  console.error(`[Gen] timeout after ${maxPolls * 3}s:`, taskId);
  return null;
}

// ─── Queue — 串行逐图 ───────────────────────────────────

export interface ImageProgressCallback {
  (event: { moduleTag: string; status: string; imageBase64?: string }): void;
}

export async function processImageQueue(
  runId: string, referenceImageBase64: string | undefined,
  apiKey: string, baseUrl: string, model: string,
  onProgress?: ImageProgressCallback,
): Promise<void> {
  const images = listListingImages(runId);
  if (images.length === 0) return;

  console.log(`[Queue] Starting ${images.length} images for run ${runId} with model ${model}`);

  for (const image of images) {
    if (!image.prompt) continue;
    try {
      console.log(`[Queue] Generating ${image.moduleTag} (${image.id})`);
      updateListingImage(image.id, { status: 'generating' });
      onProgress?.({ moduleTag: image.moduleTag, status: 'generating' });

      const isImageToImage = image.moduleTag.startsWith('MAIN') ||
        ['DETAIL_2', 'DETAIL_3', 'DETAIL_4', 'VIDEO_COVER'].includes(image.moduleTag);

      const img = isImageToImage && referenceImageBase64
        ? await generateImage(apiKey, model, image.prompt, baseUrl, `data:image/png;base64,${referenceImageBase64}`)
        : await generateImage(apiKey, model, image.prompt, baseUrl);

      if (img) {
        updateListingImage(image.id, { status: 'completed', imageBase64: img.replace(/^data:image\/\w+;base64,/, '') });
        onProgress?.({ moduleTag: image.moduleTag, status: 'completed', imageBase64: img });
      } else {
        updateListingImage(image.id, { status: 'failed' });
        onProgress?.({ moduleTag: image.moduleTag, status: 'failed' });
      }
      console.log(`[Gen] ${image.moduleTag} ${img ? 'completed' : 'failed'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Gen] ${image.moduleTag} failed: ${msg}`);
      updateListingImage(image.id, { status: 'failed' });
      onProgress?.({ moduleTag: image.moduleTag, status: 'failed' });
    }
  }
  console.log(`[Queue] Done for run ${runId}`);
}

export async function regenerateSingleImage(
  imageId: string, prompt: string, referenceImageBase64: string | undefined,
  apiKey: string, baseUrl: string, model: string,
  onProgress?: ImageProgressCallback,
): Promise<void> {
  const img = getListingImage(imageId);
  if (!img) throw new Error('Image not found');
  updateListingImage(imageId, { status: 'generating' });
  onProgress?.({ moduleTag: img.moduleTag, status: 'generating' });

  try {
    const isImageToImage = img.moduleTag.startsWith('MAIN') ||
      ['DETAIL_2', 'DETAIL_3', 'DETAIL_4', 'VIDEO_COVER'].includes(img.moduleTag);
    const result = isImageToImage && referenceImageBase64
      ? await generateImage(apiKey, model, prompt, baseUrl, `data:image/png;base64,${referenceImageBase64}`)
      : await generateImage(apiKey, model, prompt, baseUrl);

    if (result) {
      updateListingImage(imageId, { status: 'completed', imageBase64: result.replace(/^data:image\/\w+;base64,/, '') });
      onProgress?.({ moduleTag: img.moduleTag, status: 'completed', imageBase64: result });
    } else {
      updateListingImage(imageId, { status: 'failed' });
      onProgress?.({ moduleTag: img.moduleTag, status: 'failed' });
    }
  } catch (err) {
    updateListingImage(imageId, { status: 'failed' });
    throw err;
  }
}

// ─── Helpers — 复刻原版 ─────────────────────────────────

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

async function downloadImageAsBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${btoa(binary)}`;
}
