/**
 * TAG 结构化解析器 — 从 LLM 原始输出中提取 ListingOutput
 * 移植自 ListingGen src/app/page.tsx 的解析逻辑
 *
 * 设计原则：
 *   - 用 [TAG]...[/TAG] 结构化标签精确提取
 *   - 标签外内容自动忽略，不依赖位置和顺序
 *   - 图生图/文生图类型用 DETAIL_TYPE_FIXED 硬编码表判断，不用正则猜测
 */
import type {
  ListingOutput,
  TitleOutput,
  ImageModule,
  DetailModule,
  VideoScriptOutput,
  VideoShot,
  KeywordCheck,
} from '@open-design/contracts';

// ─── 详情图类型硬编码 ──────────────────────────────────────

/** 详情 1/5/6 → 文生图，2/3/4 → 图生图（固定，不靠 LLM 输出） */
const DETAIL_TYPE_FIXED: Record<number, 'text-to-image' | 'image-to-image'> = {
  1: 'text-to-image',
  2: 'image-to-image',
  3: 'image-to-image',
  4: 'image-to-image',
  5: 'text-to-image',
  6: 'text-to-image',
};

// ─── 核心提取函数 ─────────────────────────────────────────

/** 从 LLM 原始输出提取 Tag 包裹的内容块。Tag 外内容自动忽略。 */
function extractBlock(raw: string, tag: string): string | null {
  const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
  const m = raw.match(regex);
  return m?.[1]?.trim() ?? null;
}

// ─── 主解析函数 ───────────────────────────────────────────

export function parseListingOutput(raw: string): ListingOutput {
  const cleaned = cleanLLMOutput(raw);

  const titleA = parseTitleBlock(cleaned, 'TITLE_A');
  const titleB = parseTitleBlock(cleaned, 'TITLE_B');
  const keywordCheck = parseKeywordCheckBlock(cleaned);

  const mainA = parseImageBlock(cleaned, 'MAIN_A', 'image-to-image');
  const mainB = parseImageBlock(cleaned, 'MAIN_B', 'image-to-image');
  const mainC = parseImageBlock(cleaned, 'MAIN_C', 'image-to-image');

  const textDesc = extractBlock(cleaned, 'TEXT_DESC') ?? '';

  const videoScript = parseVideoScriptBlock(cleaned);

  const details: DetailModule[] = [];
  for (let i = 1; i <= 6; i++) {
    details.push(parseDetailBlock(cleaned, i));
  }

  return {
    titleA,
    titleB,
    keywordCheck,
    mainA,
    mainB,
    mainC,
    textDesc,
    videoScript,
    details,
  };
}

// ─── 标题解析 ─────────────────────────────────────────────

export function parseTitleBlock(raw: string, tag: string): TitleOutput {
  const block = extractBlock(raw, tag);
  if (!block) throw new Error(`Missing block: [${tag}]`);

  const text = cleanTitleText(block);
  const charCount = extractCharsFromBlock(block);

  // 同时尝试从对应 TAGS 块提取标签信息
  const tagsBlock = extractBlock(raw, `${tag}_TAGS`);
  const tags: Record<string, string> = {};
  if (tagsBlock) {
    for (const line of tagsBlock.split('\n')) {
      const [k, ...v] = line.split(':');
      if (k && v.length) tags[k.trim()] = v.join(':').trim();
    }
  }

  return { text, charCount, tags };
}

export function parseKeywordCheckBlock(raw: string): KeywordCheck {
  const block = extractBlock(raw, 'KEYWORD_CHECK');
  if (!block) return { items: {} };

  const items: Record<string, boolean> = {};
  // 解析 "xxx ✓" 或 "xxx ✗" 格式
  const re = /(\S+)\s*([✓✗])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    items[m[1]!] = m[2] === '✓';
  }
  return { items };
}

// ─── 图片块解析 ───────────────────────────────────────────

export function parseImageBlock(
  raw: string,
  tag: string,
  type: 'image-to-image' | 'text-to-image',
): ImageModule {
  const block = extractBlock(raw, tag);
  if (!block) {
    return {
      prompt: '',
      type,
      status: 'pending',
    };
  }

  let badge: string | undefined;
  const badgeMatch = block.match(/badge:\s*(.+)/i);
  if (badgeMatch) {
    badge = badgeMatch[1]!.trim();
    if (badge === '|') badge = undefined; // 空的内容
  }

  let prompt = '';
  const promptMatch = block.match(/prompt:\s*([\s\S]+)/i);
  if (promptMatch) {
    prompt = promptMatch[1]!.trim();
  }

  const result: ImageModule = { prompt, type, status: 'pending' };
  if (badge) result.badge = badge;
  return result;
}

// ─── 详情块解析 ───────────────────────────────────────────

export function parseDetailBlock(raw: string, index: number): DetailModule {
  const tag = `DETAIL_${index}`;
  const block = extractBlock(raw, tag);
  if (!block) {
    return {
      index,
      overlay: '',
      desc: '',
      type: DETAIL_TYPE_FIXED[index] ?? 'text-to-image',
      prompt: '',
      status: 'pending',
    };
  }

  const overlayMatch = block.match(/overlay:\s*(.+)/i);
  const descMatch = block.match(/desc:\s*(.+)/i);
  const typeLine = block.match(/type:\s*(text-to-image|image-to-image)/i);
  const promptMatch = block.match(/prompt:\s*([\s\S]+)/i);

  const type = DETAIL_TYPE_FIXED[index] ?? (typeLine?.[1] as 'text-to-image' | 'image-to-image' | undefined) ?? 'text-to-image';

  return {
    index,
    overlay: overlayMatch?.[1]?.trim() ?? '',
    desc: descMatch?.[1]?.trim() ?? '',
    type,
    prompt: promptMatch?.[1]?.trim() ?? '',
    status: 'pending',
  };
}

// ─── 视频脚本解析 ─────────────────────────────────────────

export function parseVideoScriptBlock(raw: string): VideoScriptOutput {
  const block = extractBlock(raw, 'VIDEO_SCRIPT');
  if (!block) {
    return { shots: [], coverPrompt: '' };
  }

  const shots: VideoShot[] = [];
  const shotRe = /shot:\s*([^|]+)\|\s*duration:\s*([^|]+)\|\s*content:\s*([^|]+)\|\s*reference:\s*(.+)/gi;
  let m: RegExpExecArray | null;
  while ((m = shotRe.exec(block)) !== null) {
    shots.push({
      name: m[1]!.trim(),
      duration: m[2]!.trim(),
      content: m[3]!.trim(),
      reference: m[4]!.trim(),
    });
  }

  let coverPrompt = '';
  const coverMatch = block.match(/cover_prompt:\s*([\s\S]+?)(?:\n\s*\n|$)/i);
  if (coverMatch) {
    coverPrompt = coverMatch[1]!.trim();
  }

  return { shots, coverPrompt };
}

// ─── 清洗函数 ─────────────────────────────────────────────

export function cleanLLMOutput(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/###\s+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/```/g, '')
    .replace(/[═╬─┼╔╗╚╝╠╣╦╩┌┐└┘├┤┴┬│]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanTitleText(block: string): string {
  // 从已提取的标题 block 中获取纯标题文本
  return block
    .replace(/^标题\s*[AB].*?[：:]\s*/m, '')
    .replace(/[（(][^)）]*?[)）][：:]?\s*/g, '')
    .replace(/\s*\(\d+\s*chars?\s*\)\s*$/i, '')
    .trim();
}

export function extractCharsFromBlock(block: string): number {
  const m = block.match(/\((\d+)\s*chars?\s*\)/i);
  return m ? parseInt(m[1]!, 10) : 0;
}
