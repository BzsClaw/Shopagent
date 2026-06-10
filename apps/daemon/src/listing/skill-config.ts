/**
 * SKILL 配置（软件层，不动 SKILL 原文）
 * 定义表单字段映射 + LLM 输出解析规则
 * 移植自 ListingGen src/lib/skill-config.ts
 */

/** 表单字段定义 */
export interface SkillField {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "image";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

/** SKILL 输出的标记锚点 — buildSkillPrompt 中 inputs 和 methodology 的分割线 */
export const SKILL_SPLIT_MARKER = "请产出以下四大模块";

/** 输出解析标记 */
export const PARSE_MARKERS = {
  titleA: "标题 A",
  titleB: "标题 B",
  keywordCheck: "关键词覆盖核查",
  mainImageA: "A 版",
  mainImageB: "B 版",
  mainImageC: "C 版",
  detailModules: ["模块 1", "模块 2", "模块 3", "模块 4", "模块 5", "模块 6"],
  detailEnd: "全局要求",
  promptBlock: "生图提示词（英文）",
  textStart: "✦ Key Features",
  detailSectionStart: "── 模块 1",
  hypothesis: "测试假设",
  badgeTopLeft: "左上角",
  badgeTopRight: "右上角",
  overlayText: "配图文字",
  description: "说明文字",
} as const;

/** Shopee Listing v3.0 表单字段（对应 SKILL【输入区】） */
export const LISTING_FORM_FIELDS: SkillField[] = [
  { name: "productName", label: "产品名称", type: "text", required: true, placeholder: "例：便携牛仔裤应急修补缝纫包" },
  { name: "sewingSubcategory", label: "缝纫子类目（可选）", type: "select", required: false, options: [
    "不指定（通用）",
    "缝纫机配件（压脚/梭芯）",
    "机针/手缝针",
    "线（涤纶线/绣线）",
    "裁剪工具（剪刀/轮刀）",
    "珠针与夹子",
    "测量标记（软尺/划粉）",
    "扣件闭合件（纽扣/拉链）",
    "装饰边点缀（缎带/蕾丝）",
    "衬料粘合衬",
    "熨烫塑形",
    "工具包套装",
    "实用工具杂项",
  ]},
  { name: "targetMarket", label: "目标语言", type: "select", required: true, options: [
    "英语", "中文", "印尼语", "泰语", "越南语", "菲律宾语", "马来语", "西班牙语", "葡萄牙语",
  ]},
  { name: "surfaceKeywords", label: "表层关键词", type: "text", required: true, placeholder: "品类大词 1-2 个" },
  { name: "sceneKeywords", label: "场景层关键词", type: "text", required: true, placeholder: "使用场景词 2-4 个" },
  { name: "emotionKeywords", label: "情绪层关键词/用户痛点", type: "text", required: true, placeholder: "用户怕什么 2-4 个" },
  { name: "identityKeywords", label: "身份层关键词", type: "text", required: false, placeholder: "目标人群（可选）" },
  { name: "coreDifferentiation", label: "核心差异化卖点", type: "textarea", required: true, placeholder: "最想主打的 1 个不一样" },
  { name: "otherSellingPoints", label: "其他卖点", type: "textarea", required: true, placeholder: "2-4 个" },
  { name: "competitorComplaints", label: "对手高频差评", type: "textarea", required: false, placeholder: "竞品差评摘抄（可选）" },
  { name: "productSpecs", label: "产品规格参数", type: "textarea", required: true, placeholder: "材质/尺寸/重量等" },
];

/** 详情图模块名称（对应 SKILL 模块 1-6） */
export const DETAIL_MODULE_NAMES = [
  "痛点开场",
  "差异化对比",
  "内容物清单",
  "便携 / 收纳",
  "使用场景",
  "信任兜底",
];
