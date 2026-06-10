// ShopAgent — listing contracts
// Shared DTOs for daemon ↔ web API communication.
// Reference: PRD §6.2 M0

/** User-provided product input fields — mirrors SKILL【输入区】11 fields exactly. */
export interface ListingProductInput {
  productName: string;               // 产品名称
  subcategory: string;               // 缝纫子类目（可选，"不指定"=通用）
  surfaceKeywords: string;           // 表层关键词（品类大词 1-2 个）
  sceneKeywords: string;             // 场景层关键词（使用场景 2-4 个）
  emotionKeywords: string;           // 情绪层关键词/用户痛点
  identityKeywords?: string;         // 身份层关键词（可选）
  coreDifferentiation: string;       // 核心差异化卖点
  otherSellingPoints: string;        // 其他卖点
  competitorComplaints?: string;     // 对手高频差评（可选）
  productSpecs: string;              // 产品规格参数
  targetMarket: string;              // 目标市场：MY/SG/TH/PH/...
  language: string;                  // 输出语言：en/zh-CN
  productImageBase64?: string;       // 产品白底图 base64
}

/** Skill metadata surfaced via GET /api/listing/skills. */
export interface ListingSkill {
  id: string;
  name: string;
  platform: string;
  fields: ListingFieldDef[];
}

export interface ListingFieldDef {
  name: string;
  label: string;
  type: 'text' | 'select' | 'image' | 'textarea';
  required: boolean;
  options?: string[];
}

/** POST /api/listing/generate request body. */
export interface ListingGenerateRequest {
  skillId: string;
  product: ListingProductInput;
  projectId?: string;
  /** API config overrides (from Web UI localStorage) */
  llmApiKey?: string;
  llmBaseUrl?: string;
  imageApiKey?: string;
  imageBaseUrl?: string;
  imageModel?: string;
}

/** Structured listing output after TAG parsing. */
export interface ListingOutput {
  titleA: TitleOutput;
  titleB: TitleOutput;
  keywordCheck: KeywordCheck;
  mainA: ImageModule;
  mainB: ImageModule;
  mainC: ImageModule;
  textDesc: string;
  videoScript: VideoScriptOutput;
  details: DetailModule[];
}

export interface TitleOutput {
  text: string;
  charCount: number;
  tags: Record<string, string>;
}

export interface KeywordCheck {
  items: Record<string, boolean>;
}

export interface ImageModule {
  badge?: string;
  prompt: string;
  type: 'image-to-image' | 'text-to-image';
  imageBase64?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export interface VideoScriptOutput {
  shots: VideoShot[];
  coverPrompt: string;
  coverImageBase64?: string;
}

export interface VideoShot {
  name: string;
  duration: string;
  content: string;
  reference: string;
}

export interface DetailModule {
  index: number;
  overlay: string;
  desc: string;
  type: 'text-to-image' | 'image-to-image';
  prompt: string;
  imageBase64?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

/** GET /api/listing/runs/:id response. */
export interface ListingRunStatus {
  id: string;
  status: 'queued' | 'llm_generating' | 'images_generating' | 'completed' | 'failed';
  output?: ListingOutput;
  images: ListingImageStatus[];
  error?: string;
}

export interface ListingImageStatus {
  id: string;
  moduleTag: string;
  model: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

/** DB row shapes (internal). */
export interface ListingRun {
  id: string;
  projectId: string | null;
  skillId: string;
  platform: string;
  productData: ListingProductInput;
  resultData: ListingOutput | null;
  status: string;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ListingImage {
  id: string;
  runId: string;
  moduleTag: string;
  model: string;
  prompt: string;
  imageBase64: string | null;
  imageUrl: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  taskId: string | null;
  createdAt: number;
  updatedAt: number;
}
