/**
 * SKILL 文件读取器 + Prompt 组装器
 * 移植自 ListingGen src/lib/skill-parser.ts + src/lib/skill-config.ts + src/lib/prompt-config.ts
 *
 * 完整 prompt 结构（由 buildListingPrompt 组装）:
 * ┌─────────────────────────┐
 * │ META_INSTRUCTION         │ ← prompt-config.ts（工程层协议）
 * │ 输入区（用户真实数据）     │ ← 唯一数据源
 * │ 方法论（SKILL 原文）      │ ← 规则书，可自由修改
 * └─────────────────────────┘
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILL_SPLIT_MARKER, LISTING_FORM_FIELDS } from './skill-config.js';
import { META_INSTRUCTION } from './prompt-config.js';
import type { ListingSkill, ListingFieldDef, ListingProductInput } from '@open-design/contracts';

// ─── 类型 ───────────────────────────────────────────────

export interface ParsedSkill {
  id: string;
  name: string;
  platform: string;
  fullContent: string;
  methodology: string;
  filePath: string;
  fields: ListingFieldDef[];
}

// ─── SKILL 加载 ─────────────────────────────────────────

/** SKILL 文件所在目录（相对于项目根目录）。使用 fileURLToPath 确保 Windows 兼容。 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILLS_LISTING_DIR = path.resolve(__dirname, '../../../../skills/listing');

/**
 * 从 skills/listing/ 目录加载指定 SKILL
 */
export function loadListingSkill(skillId: string): ParsedSkill | null {
  const filePath = path.join(SKILLS_LISTING_DIR, `${skillId}.md`);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, 'utf-8');
  return parseSkillContent(raw, filePath);
}

/**
 * 列出所有可用的 listing SKILL
 */
export function listListingSkills(): ListingSkill[] {
  if (!existsSync(SKILLS_LISTING_DIR)) return [];

  const result: ListingSkill[] = [];
  const entries = readdirSync(SKILLS_LISTING_DIR);

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(SKILLS_LISTING_DIR, entry);
    if (!statSync(filePath).isFile()) continue;

    const raw = readFileSync(filePath, 'utf-8');
    const parsed = parseSkillContent(raw, filePath);
    result.push({
      id: parsed.id,
      name: parsed.name,
      platform: parsed.platform,
      fields: parsed.fields,
    });
  }

  return result;
}

// ─── 内部函数 ────────────────────────────────────────────

function parseSkillContent(raw: string, filePath: string): ParsedSkill {
  const id = path.basename(filePath, '.md');
  const platform = id.startsWith('shopee') ? 'shopee'
    : id.startsWith('amazon') ? 'amazon'
    : id.startsWith('tiktok') ? 'tiktokshop'
    : 'unknown';

  const splitIdx = raw.indexOf(SKILL_SPLIT_MARKER);
  const methodology = splitIdx !== -1 ? raw.substring(splitIdx) : raw;

  return {
    id,
    name: id,
    platform,
    fullContent: raw,
    methodology: stripVisualNoise(methodology).trim(),
    filePath,
    fields: LISTING_FORM_FIELDS as ListingFieldDef[],
  };
}

// ─── Prompt 组装 ─────────────────────────────────────────

/**
 * 组装完整 system prompt，所有字段精确对齐 SKILL【输入区】11 个字段。
 * META_INSTRUCTION + 输入区（用户数据）+ 方法论（SKILL 规则书）
 */
export function buildListingPrompt(
  skill: ParsedSkill,
  product: ListingProductInput,
): string {
  const inputLines = [
    `【产品名称】：${product.productName || ''}`,
    `【目标市场/语言】：${getMarketLabel(product.targetMarket)}，${product.language === 'zh-CN' ? '中文' : '英文'}为主`,
    `【表层关键词】：${product.surfaceKeywords || ''}`,
    `【场景层关键词】：${product.sceneKeywords || ''}`,
    `【情绪层关键词/用户痛点】：${product.emotionKeywords || ''}`,
    `【身份层关键词】：${product.identityKeywords || '不指定'}`,
    `【核心差异化卖点】：${product.coreDifferentiation || ''}`,
    `【其他卖点】：${product.otherSellingPoints || ''}`,
    `【对手高频差评】：${product.competitorComplaints || '无'}`,
    `【价格定位】：中端`,
    `【产品规格参数】：${product.productSpecs || ''}`,
    `【真实产品白底图】：${product.productImageBase64 ? '已上传' : '未上传（请补充）'}`,
  ].join('\n');

  // 缝纫子类目处理
  const subcatLine = product.subcategory && product.subcategory !== '不指定（通用）'
    ? `\n【缝纫子类目】：${product.subcategory}`
    : '';

  const fullInputLines = inputLines + subcatLine;

  return `${META_INSTRUCTION}

==================================================================
第一部分：输入区（用户真实产品数据，唯一数据源）
==================================================================
${fullInputLines}
==================================================================

==================================================================
第二部分：方法论（规则书）
==================================================================
${skill.methodology}`;
}

// ─── 辅助函数 ────────────────────────────────────────────

function getMarketLabel(code: string): string {
  const map: Record<string, string> = {
    MY: '马来西亚站',
    SG: '新加坡站',
    TH: '泰国站',
    PH: '菲律宾站',
    ID: '印尼站',
    VN: '越南站',
    TW: '台湾站',
  };
  return map[code] ?? `${code}站`;
}

// ─── 视觉噪音清洗 ─────────────────────────────────────────

/** 去掉 SKILL 中的视觉噪音（框线、Markdown），保留语义 */
function stripVisualNoise(s: string): string {
  return s
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      // 纯框线字符行
      if (/^[═╬─┼╔╗╚╝╠╣╦╩┌┐└┘├┤┴┬│-]+$/.test(t) && t.length > 2) return false;
      return true;
    })
    .join('\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^###?\s+/gm, '')
    .replace(/```/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

export { stripVisualNoise };
