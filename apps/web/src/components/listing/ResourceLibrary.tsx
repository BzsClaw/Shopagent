/**
 * 资源库浏览器 (PRD §4.2) — 关键词库 + 提示词模板库全屏管理
 * 移植自 ListingGen 关键词库/模板库管理界面
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getKeywordLibrary, addKeyword, removeKeyword, addCategory,
  exportKeywordLibrary, importKeywordLibrary, DEFAULT_CATEGORIES,
} from '../../lib/listing/keyword-library';
import {
  getPromptLibrary, getPromptsByCategory, addPrompt, removePrompt,
  exportPromptLibrary, importPromptLibrary, PROMPT_CATEGORIES,
  type PromptTemplate,
} from '../../lib/listing/prompt-library';
import styles from './ResourceLibrary.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

type TabId = 'keywords' | 'prompts';

export function ResourceLibrary({ open, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('keywords');
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(n => n + 1);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>📚 资源库</h2>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'keywords' ? styles.tabOn : ''}`}
              onClick={() => setTab('keywords')}
            >关键词库</button>
            <button
              className={`${styles.tab} ${tab === 'prompts' ? styles.tabOn : ''}`}
              onClick={() => setTab('prompts')}
            >提示词模板库</button>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {tab === 'keywords' ? (
            <KeywordsTab key={`kw-${tick}`} refresh={refresh} />
          ) : (
            <PromptsTab key={`pt-${tick}`} refresh={refresh} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 关键词 Tab ────────────────────────────────────────

function KeywordsTab({ refresh }: { refresh: () => void }) {
  const library = getKeywordLibrary();
  const [selCat, setSelCat] = useState<string>(DEFAULT_CATEGORIES[0]!);
  const [newKw, setNewKw] = useState('');
  const [newCat, setNewCat] = useState('');

  const categories = Object.keys(library).length > 0 ? Object.keys(library) : DEFAULT_CATEGORIES;
  const keywords = library[selCat] || [];

  const handleAdd = () => {
    const kw = newKw.trim();
    if (!kw) return;
    addKeyword(selCat, kw);
    setNewKw('');
    refresh();
  };

  const handleAddCategory = () => {
    const cat = newCat.trim();
    if (!cat || categories.includes(cat)) return;
    addCategory(cat);
    setNewCat('');
    setSelCat(cat);
    refresh();
  };

  const handleExport = () => {
    const blob = new Blob([exportKeywordLibrary()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'shopagent-keywords.json';
    a.click();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importKeywordLibrary(reader.result as string);
          refresh();
        } catch { alert('JSON 格式错误'); }
      };
      reader.readAsText(f);
    };
    input.click();
  };

  return (
    <div className={styles.splitLayout}>
      {/* 左侧分类树 */}
      <div className={styles.sidebar}>
        <h3 className={styles.sidebarTitle}>分类</h3>
        <div className={styles.catList}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`${styles.catItem} ${cat === selCat ? styles.catItemOn : ''}`}
              onClick={() => setSelCat(cat)}
            >
              {cat}
              <span className={styles.catCount}>{getKeywordLibrary()[cat]?.length || 0}</span>
            </button>
          ))}
        </div>
        <div className={styles.addRow}>
          <input
            className={styles.addInput}
            placeholder="新分类..."
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
          />
          <button className={styles.addBtn} onClick={handleAddCategory}>+</button>
        </div>
        <div className={styles.ioRow}>
          <button className={styles.ioBtn} onClick={handleExport}>📥 导出</button>
          <button className={styles.ioBtn} onClick={handleImport}>📤 导入</button>
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className={styles.content}>
        <h3 className={styles.contentTitle}>{selCat}</h3>
        <div className={styles.addRow}>
          <input
            className={styles.addInput}
            placeholder="输入新关键词..."
            value={newKw}
            onChange={e => setNewKw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button className={styles.addBtn} onClick={handleAdd}>+</button>
        </div>
        <div className={styles.itemList}>
          {keywords.length === 0 ? (
            <p className={styles.empty}>此分类暂无关键词，上方输入添加</p>
          ) : (
            keywords.map(kw => (
              <div key={kw} className={styles.itemRow}>
                <span className={styles.itemText}>{kw}</span>
                <button
                  className={styles.delBtn}
                  onClick={() => { removeKeyword(selCat, kw); refresh(); }}
                  title="删除"
                >✕</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 提示词模板 Tab ─────────────────────────────────────

function PromptsTab({ refresh }: { refresh: () => void }) {
  const allPrompts = getPromptLibrary();
  const [selCat, setSelCat] = useState<string>(PROMPT_CATEGORIES[0]!);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const prompts = getPromptsByCategory(selCat);

  const handleAdd = () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    addPrompt({ name: newName.trim(), category: selCat, tags: [], prompt: newPrompt.trim() });
    setNewName('');
    setNewPrompt('');
    setShowAdd(false);
    refresh();
  };

  const handleExport = () => {
    const blob = new Blob([exportPromptLibrary()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'shopagent-prompts.json';
    a.click();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importPromptLibrary(reader.result as string);
          refresh();
        } catch { alert('JSON 格式错误'); }
      };
      reader.readAsText(f);
    };
    input.click();
  };

  return (
    <div className={styles.splitLayout}>
      <div className={styles.sidebar}>
        <h3 className={styles.sidebarTitle}>分类</h3>
        <div className={styles.catList}>
          {PROMPT_CATEGORIES.map(cat => {
            const count = getPromptsByCategory(cat).length;
            return (
              <button
                key={cat}
                className={`${styles.catItem} ${cat === selCat ? styles.catItemOn : ''}`}
                onClick={() => setSelCat(cat)}
              >
                {cat.replace(/^(主图|详情图\d)\s*[·⋅]\s*/, '')}
                <span className={styles.catCount}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.ioRow}>
          <button className={styles.ioBtn} onClick={handleExport}>📥 导出</button>
          <button className={styles.ioBtn} onClick={handleImport}>📤 导入</button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.contentHeader}>
          <h3 className={styles.contentTitle}>{selCat}</h3>
          <button className={styles.addBtn} onClick={() => { setShowAdd(true); setNewName(''); setNewPrompt(''); }}>
            + 新增模板
          </button>
        </div>

        {showAdd && (
          <div className={styles.addCard}>
            <input
              className={styles.addInput}
              placeholder="模板名称，如：卖点放大-针线套装"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <textarea
              className={styles.addTextarea}
              placeholder="提示词模板内容..."
              value={newPrompt}
              onChange={e => setNewPrompt(e.target.value)}
              rows={4}
            />
            <div className={styles.addActions}>
              <button className={styles.ioBtn} onClick={() => setShowAdd(false)}>取消</button>
              <button className={styles.addBtn} onClick={handleAdd}>确认添加</button>
            </div>
          </div>
        )}

        <div className={styles.itemList}>
          {prompts.length === 0 ? (
            <p className={styles.empty}>此分类暂无模板，点"+ 新增模板"添加</p>
          ) : (
            prompts.map(p => (
              <div key={p.id} className={styles.promptCard}>
                <div className={styles.promptCardHeader}>
                  <span className={styles.promptName}>{p.name}</span>
                  <div className={styles.promptActions}>
                    <button
                      className={styles.ioBtn}
                      onClick={() => {
                        navigator.clipboard.writeText(p.prompt);
                      }}
                    >📋 复制</button>
                    <button
                      className={styles.delBtn}
                      onClick={() => { removePrompt(p.id); refresh(); }}
                    >✕ 删除</button>
                  </div>
                </div>
                <pre className={styles.promptText}>{p.prompt}</pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
