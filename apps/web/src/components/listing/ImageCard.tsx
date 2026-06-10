/**
 * 图片卡片 (M12) — 对标 ListingGen ImageCard
 * 可折叠展开、复制/下载、4 种状态、模板选择
 */
'use client';

import { useState, useEffect } from 'react';
import type { ImageModule, DetailModule } from '@open-design/contracts';
import { getPromptsByCategory, type PromptTemplate } from '../../lib/listing/prompt-library';
import styles from './ImageCard.module.css';

interface ImageCardProps {
  moduleTag: string;
  title: string;
  subtitle?: string;
  overlayText?: string;
  description?: string;
  data: ImageModule | DetailModule;
  onRegenerate?: (prompt: string) => void;
  defaultCollapsed?: boolean;
  promptCategory?: string;
}

export function ImageCard({
  moduleTag, title, subtitle, overlayText, description,
  data, onRegenerate, defaultCollapsed = false, promptCategory,
}: ImageCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [editablePrompt, setEditablePrompt] = useState(data.prompt ?? '');
  const [copied, setCopied] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  // 当 data.prompt 变化时同步（新数据到达），不覆盖用户手动编辑
  useEffect(() => {
    setEditablePrompt(data.prompt ?? '');
  }, [data.prompt]);

  const type = 'type' in data ? data.type : 'image-to-image';
  const imgSrc = data.imageBase64
    ? `data:image/png;base64,${data.imageBase64}`
    : null;
  const isGenerating = data.status === 'generating';
  const isPending = data.status === 'pending';
  const isFailed = data.status === 'failed';
  const hasImage = data.status === 'completed' && !!imgSrc;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editablePrompt || data.prompt || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!imgSrc) return;
    const a = document.createElement('a');
    a.href = imgSrc;
    a.download = `${moduleTag}.png`;
    a.click();
  };

  const handleGenerate = () => {
    onRegenerate?.(editablePrompt || data.prompt || '');
  };

  const overlayStr = overlayText ?? ('overlay' in data ? (data as DetailModule).overlay : undefined);

  return (
    <div className={styles.card}>
      {/* 可点击标题栏 */}
      <div
        className={styles.cardHeader}
        onClick={() => setCollapsed(!collapsed)}
        role="button"
        tabIndex={0}
      >
        <div className={styles.headerLeft}>
          <span className={styles.chevron}>{collapsed ? '▸' : '▾'}</span>
          <span className={styles.headerTitle}>{title}</span>
          {subtitle && !collapsed && <span className={styles.subtitle}>{subtitle}</span>}
          {description && !collapsed && <span className={styles.desc}>{description}</span>}
        </div>
        <div className={styles.headerRight}>
          {overlayStr && !collapsed && (
            <span className={styles.overlayBadge}>🏷 {overlayStr}</span>
          )}
          {collapsed && isGenerating && <span className={styles.spinner} />}
          {collapsed && isPending && !hasImage && <span className={styles.pendingLabel}>○ 待生成</span>}
          {collapsed && hasImage && <span className={styles.doneLabel}>✓ 已生成</span>}
          {collapsed && isFailed && <span className={styles.failedLabel}>✗ 失败</span>}
        </div>
      </div>

      {/* 展开内容 */}
      {!collapsed && (
        <div className={styles.cardBody}>
          <div className={styles.grid}>
            {/* 左侧：prompt 编辑区 */}
            <div className={styles.promptSide}>
              <div className={styles.promptHeader}>
                <span className={styles.promptLabel}>生图提示词</span>
                <div className={styles.promptActions}>
                  {promptCategory && (
                    <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); setTemplateOpen(true); }}>
                      📁 模板
                    </button>
                  )}
                  <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
                    {copied ? '✓ 已复制' : '📋 复制'}
                  </button>
                </div>
              </div>
              <textarea
                className={styles.promptInput}
                value={editablePrompt}
                onChange={(e) => setEditablePrompt(e.target.value)}
                rows={6}
                placeholder="等待文案生成..."
              />
              {onRegenerate && (
                <button
                  className={styles.generateBtn}
                  onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
                  disabled={isGenerating}
                >
                  {isGenerating ? '⏳ 生成中...' :
                   hasImage ? '🔄 重新生成' : '🪄 生成图片'}
                </button>
              )}
            </div>

            {/* 右侧：图片预览区 */}
            <div className={styles.previewSide}>
              {isGenerating ? (
                <div className={styles.previewState}>
                  <div className={styles.skeleton} />
                  <span className={styles.spinner} />
                  <span className={styles.stateText}>生成中...</span>
                </div>
              ) : hasImage ? (
                <div className={styles.imageWrap}>
                  <img src={imgSrc!} alt={moduleTag} className={styles.image} />
                  <button className={styles.downloadBtn} onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
                    ⬇ 下载
                  </button>
                </div>
              ) : isFailed ? (
                <div className={styles.previewState}>
                  <span className={styles.failedIcon}>✗</span>
                  <span className={styles.stateText}>生成失败</span>
                </div>
              ) : (
                <div className={styles.previewState}>
                  <span className={styles.emptyIcon}>🖼</span>
                  <span className={styles.stateText}>生成后预览</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 模板选择弹窗 */}
      {templateOpen && (
        <div className={styles.tmplOverlay} onClick={() => setTemplateOpen(false)}>
          <div className={styles.tmplDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.tmplTitle}>选择提示词模板</h3>
            <p className={styles.tmplDesc}>{promptCategory} · 共 {getPromptsByCategory(promptCategory || '').length} 个模板</p>
            <div className={styles.tmplList}>
              {getPromptsByCategory(promptCategory || '').length === 0 ? (
                <p className={styles.tmplEmpty}>此分类暂无模板，请先去「资源库」添加。</p>
              ) : (
                getPromptsByCategory(promptCategory || '').map((t: PromptTemplate) => (
                  <div key={t.id} className={styles.tmplItem}
                    onClick={() => { setEditablePrompt(t.prompt); setTemplateOpen(false); }}>
                    <div className={styles.tmplItemHeader}>
                      <span className={styles.tmplItemName}>{t.name}</span>
                      <button className={styles.actionBtn} onClick={(e) => {
                        e.stopPropagation(); navigator.clipboard.writeText(t.prompt);
                      }}>📋</button>
                    </div>
                    <p className={styles.tmplItemText}>{t.prompt.slice(0, 100)}...</p>
                  </div>
                ))
              )}
            </div>
            <button className={styles.tmplClose} onClick={() => setTemplateOpen(false)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
