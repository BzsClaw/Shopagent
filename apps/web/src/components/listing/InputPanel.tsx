/**
 * 产品输入面板 (M10) — 对标 ListingGen InputPanel 原版
 * 精确复刻：SKILL选择 → 产品信息(两列grid) → 卖点定位(左右分栏+图) → 生成按钮
 */
'use client';

import { useState, useRef, useCallback } from 'react';
import type { ListingProductInput } from '@open-design/contracts';
import { navigate } from '../../router';
import { KeywordPicker } from './KeywordPicker';
import { ResourceLibrary } from './ResourceLibrary';
import styles from './InputPanel.module.css';

const FORM_KEY = 'shopagent:input:form';
const IMG_KEY = 'shopagent:input:image';

const INITIAL_FORM: ListingProductInput = {
  productName: '', subcategory: '不指定（通用）',
  surfaceKeywords: '', sceneKeywords: '', emotionKeywords: '',
  identityKeywords: '', coreDifferentiation: '', otherSellingPoints: '',
  competitorComplaints: '', productSpecs: '',
  targetMarket: 'MY', language: 'en',
};

function loadForm(): ListingProductInput {
  try { const raw = localStorage.getItem(FORM_KEY); if (raw) return { ...INITIAL_FORM, ...JSON.parse(raw) }; } catch { /* */ }
  return { ...INITIAL_FORM };
}

interface InputPanelProps {
  onGenerate: (input: ListingProductInput) => void;
  generating: boolean;
  onSave?: () => void;
  canSave?: boolean;
  saving?: boolean;
  hasSaved?: boolean;
}

export function InputPanel({ onGenerate, generating, onSave, canSave, saving, hasSaved }: InputPanelProps) {
  const [form, setForm] = useState<ListingProductInput>(loadForm);
  const [productImage, setProductImage] = useState<string | null>(() => {
    try { return localStorage.getItem(IMG_KEY); } catch { return null; }
  });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // persist
  const updateField = useCallback((field: keyof ListingProductInput, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      try { localStorage.setItem(FORM_KEY, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }, []);

  const updateImage = useCallback((base64: string | null) => {
    setProductImage(base64);
    try {
      if (base64) localStorage.setItem(IMG_KEY, base64);
      else localStorage.removeItem(IMG_KEY);
    } catch { /* */ }
  }, []);

  // ─── 图片上传 ───
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => updateImage(reader.result as string);
    reader.readAsDataURL(file);
  }, [updateImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const handleGenerate = () => {
    if (!form.productName || !form.surfaceKeywords || !form.coreDifferentiation) return;
    onGenerate({ ...form, productImageBase64: productImage?.split(',')[1] });
  };
  const canGen = !!form.productName && !!form.surfaceKeywords && !!form.coreDifferentiation && !generating;

  return (
    <div className={styles.panel}>

      {/* ====== 1. SKILL 选择 ====== */}
      <div className={styles.skillSection}>
        <div className={styles.skillHeader}>
          <label className={styles.label}>SKILL 模板</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={styles.libBtn} onClick={() => navigate({ kind: 'methodology' })}>📖 方法论</button>
            <button className={styles.libBtn} onClick={() => setLibraryOpen(true)}>📚 资源库</button>
          </div>
        </div>
        <select className={styles.select} value="shopee-listing-v3" disabled>
          <option>Listing V3</option>
        </select>
        <p className={styles.hint}>Listing 文案 + 主图 + 详情图一站式生成</p>
      </div>

      <ResourceLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} />

      <div className={styles.sep} />

      {/* ====== 2. 产品信息 ====== */}
      <h3 className={styles.sectionTitle}>产品信息</h3>

      <div className={styles.field}>
        <label className={styles.label}>产品名称 <span className={styles.required}>*</span></label>
        <input className={styles.input} placeholder="例：便携牛仔裤应急修补缝纫包"
          value={form.productName} onChange={(e) => updateField('productName', e.target.value)} />
      </div>

      {/* 两列：子类目 + 目标市场 */}
      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label}>缝纫子类目 <span className={styles.optional}>（可选）</span></label>
          <select className={styles.select} value={form.subcategory}
            onChange={(e) => updateField('subcategory', e.target.value)}>
            <option value="不指定（通用）">不指定（通用）</option>
            <option disabled>─ 精密金属件 ─</option>
            <option>缝纫机配件（压脚/梭芯）</option>
            <option>机针/手缝针</option>
            <option>裁剪工具（剪刀/轮刀）</option>
            <option>扣件闭合件（纽扣/拉链）</option>
            <option disabled>─ 纺织柔软品 ─</option>
            <option>线（涤纶线/绣线）</option>
            <option>装饰边点缀（缎带/蕾丝）</option>
            <option>衬料粘合衬</option>
            <option disabled>─ 套装与工具 ─</option>
            <option>工具包套装</option>
            <option>珠针与夹子</option>
            <option>测量标记（软尺/划粉）</option>
            <option>熨烫塑形</option>
            <option>实用工具杂项</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>目标语言 <span className={styles.required}>*</span></label>
          <select className={styles.select} value={form.language}
            onChange={(e) => updateField('language', e.target.value)}>
            <option value="en">英语</option><option value="zh-CN">中文</option>
            <option value="id">印尼语</option><option value="th">泰语</option>
            <option value="vi">越南语</option><option value="fil">菲律宾语</option>
            <option value="ms">马来语</option><option value="es">西班牙语</option>
            <option value="pt">葡萄牙语</option>
          </select>
        </div>
      </div>

      {/* 两列：表层关键词 + 场景关键词 */}
      <div className={styles.row2}>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label}>表层关键词 <span className={styles.required}>*</span></label>
            <KeywordPicker value={form.surfaceKeywords} onConfirm={(v) => updateField('surfaceKeywords', v)} defaultCategory="表层词" />
          </div>
          <input className={styles.input} placeholder="品类大词 1-2 个"
            value={form.surfaceKeywords} onChange={(e) => updateField('surfaceKeywords', e.target.value)} />
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label}>场景关键词 <span className={styles.required}>*</span></label>
            <KeywordPicker value={form.sceneKeywords} onConfirm={(v) => updateField('sceneKeywords', v)} defaultCategory="场景词" />
          </div>
          <input className={styles.input} placeholder="使用场景 2-4 个"
            value={form.sceneKeywords} onChange={(e) => updateField('sceneKeywords', e.target.value)} />
        </div>
      </div>

      {/* 单列：情绪关键词 */}
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label}>情绪层关键词 / 用户痛点 <span className={styles.required}>*</span></label>
          <KeywordPicker value={form.emotionKeywords} onConfirm={(v) => updateField('emotionKeywords', v)} defaultCategory="情绪词" />
        </div>
        <input className={styles.input} placeholder="用户怕什么 2-4 个"
          value={form.emotionKeywords} onChange={(e) => updateField('emotionKeywords', e.target.value)} />
      </div>

      {/* 单列：身份关键词(可选) */}
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label}>身份层关键词 <span className={styles.optional}>（可选）</span></label>
          <KeywordPicker value={form.identityKeywords ?? ''} onConfirm={(v) => updateField('identityKeywords', v)} defaultCategory="身份词" />
        </div>
        <input className={styles.input} placeholder="目标人群，如 beginners / professional tailor"
          value={form.identityKeywords} onChange={(e) => updateField('identityKeywords', e.target.value)} />
      </div>

      <div className={styles.sep} />

      {/* ====== 3. 卖点 & 定位（左右分栏） ====== */}
      <h3 className={styles.sectionTitle}>卖点 &amp; 定位</h3>

      <div className={styles.sellingRow}>
        {/* 左：表单区 */}
        <div className={styles.sellingLeft}>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>核心差异化卖点 <span className={styles.required}>*</span></label>
              <KeywordPicker value={form.coreDifferentiation} onConfirm={(v) => updateField('coreDifferentiation', v)} defaultCategory="差异化卖点" />
            </div>
            <textarea className={styles.textarea} placeholder="最想主打的 1 个不一样，例：不锈钢加固针不弯不断" rows={2}
              value={form.coreDifferentiation} onChange={(e) => updateField('coreDifferentiation', e.target.value)} />
          </div>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>其他卖点 <span className={styles.required}>*</span></label>
              <KeywordPicker value={form.otherSellingPoints} onConfirm={(v) => updateField('otherSellingPoints', v)} defaultCategory="其他卖点" />
            </div>
            <textarea className={styles.textarea} placeholder="2-4 个，如 32 件全套、便携收纳盒、12 色线" rows={2}
              value={form.otherSellingPoints} onChange={(e) => updateField('otherSellingPoints', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>对手高频差评 <span className={styles.optional}>（可选）</span></label>
            <textarea className={styles.textarea} placeholder="从竞品差评摘抄的抱怨" rows={2}
              value={form.competitorComplaints} onChange={(e) => updateField('competitorComplaints', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>产品规格参数 <span className={styles.required}>*</span></label>
            <textarea className={styles.textarea} placeholder="材质、尺寸、重量等，如：材质=不锈钢针+PP盒；尺寸=10×7×2.5cm；重量=85g" rows={3}
              value={form.productSpecs} onChange={(e) => updateField('productSpecs', e.target.value)} />
          </div>
        </div>

        {/* 右：白底图上传 */}
        <div className={styles.sellingRight}>
          <label className={styles.label}>产品白底图 <span className={styles.required}>*</span></label>
          <div className={styles.uploadWrap}>
            {productImage ? (
              <div className={styles.uploadPreview}>
                <img src={productImage} alt="产品白底图" className={styles.uploadImg} />
                <button className={styles.uploadClear} onClick={() => updateImage(null)}>✕</button>
              </div>
            ) : (
              <div
                className={`${styles.uploadZone} ${isDragging ? styles.uploadActive : ''}`}
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
              >
                <input ref={fileRef} type="file" accept="image/*" className={styles.fileHidden}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                <span className={styles.uploadIcon}>{isDragging ? '📤' : '🖼'}</span>
                <span className={styles.uploadText}>{isDragging ? '松开以上传' : '拖拽或点击上传'}</span>
                <span className={styles.uploadHint}>支持 JPG / PNG / WebP</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== 4. 操作按钮（左右均衡） ====== */}
      <div className={styles.actionRow}>
        <button className={canGen ? styles.genBtn : styles.genBtnDisabled}
          onClick={handleGenerate} disabled={!canGen}>
          {generating ? '⏳ 生成中...' : '📝 生成文案'}
        </button>
        <button
          className={canSave && !saving ? styles.saveBtn : styles.saveBtnDisabled}
          onClick={onSave}
          disabled={!canSave || saving}
          title={!canSave ? '请先生成文案' : undefined}
        >
          {saving ? '⏳ 保存中...' : hasSaved ? '💾 更新项目' : '💾 保存到项目'}
        </button>
      </div>
    </div>
  );
}
