/**
 * 资源库浏览器 (PRD §4.2) — 关键词库 + 提示词模板库全屏管理
 * 移植自 ListingGen 关键词库/模板库管理界面
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getKeywordLibraryAsync, addKeyword, removeKeyword, addCategory, toggleKeywordTag,
  exportKeywordLibrary, importKeywordLibrary, DEFAULT_CATEGORIES, LANGUAGES,
  type KeywordItem,
} from '../../lib/listing/keyword-library';
import {
  getPromptLibrary, addPrompt, removePrompt,
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
  const [fullscreen, setFullscreen] = useState(false);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.dialog} ${fullscreen ? styles.dialogFullscreen : ''}`} onClick={e => e.stopPropagation()}>
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
          <button className={styles.closeBtn} onClick={() => setFullscreen(!fullscreen)} title="全屏">{fullscreen ? '🗗' : '🗖'}</button>
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
  const [library, setLibrary] = useState<Record<string, KeywordItem[]>>({});
  const [selCat, setSelCat] = useState<string>(DEFAULT_CATEGORIES[0]!);
  const [newKw, setNewKw] = useState('');
  const [newCat, setNewCat] = useState('');
  const [lang, setLang] = useState('en');

  useEffect(() => {
    getKeywordLibraryAsync(lang).then(data => {
      setLibrary(data as Record<string, KeywordItem[]>);
    }).catch(() => setLibrary({}));
  }, [lang]);

  const allCats = Object.keys(library);
  const categories = allCats.length > 0
    ? [...DEFAULT_CATEGORIES.filter(c => allCats.includes(c)), ...allCats.filter(c => !DEFAULT_CATEGORIES.includes(c))]
    : DEFAULT_CATEGORIES;
  const keywords = library[selCat] || [];

  const handleAdd = async () => {
    const kw = newKw.trim();
    if (!kw) return;
    await addKeyword(selCat, kw, lang);
    setNewKw('');
    refresh();
  };

  const handleAddCategory = async () => {
    const cat = newCat.trim();
    if (!cat || categories.includes(cat)) return;
    await addCategory(cat, lang);
    setNewCat('');
    setSelCat(cat);
    refresh();
  };

  const handleExport = async () => {
    const blob = new Blob([await exportKeywordLibrary(lang)], { type: 'application/json' });
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
      reader.onload = async () => {
        try {
          await importKeywordLibrary(reader.result as string, lang);
          refresh();
        } catch { alert('JSON 格式错误'); }
      };
      reader.readAsText(f);
    };
    input.click();
  };

  const totalKws = Object.values(library).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className={styles.splitLayout}>
      {/* 左侧分类树 */}
      <div className={styles.sidebar}>
        <div className={styles.langRow}>
          <select className={styles.langSelect} value={lang} onChange={e => setLang(e.target.value)}>
            {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <h3 className={styles.sidebarTitle}>分类 <small>({totalKws}词)</small></h3>
        <div className={styles.catList}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`${styles.catItem} ${cat === selCat ? styles.catItemOn : ''}`}
              onClick={() => setSelCat(cat)}
            >
              {cat}
              <span className={styles.catCount}>{(library[cat] as KeywordItem[] || []).length}</span>
            </button>
          ))}
        </div>
        <div className={styles.addRow}>
          <input className={styles.addInput} placeholder="新分类..." value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }} />
          <button className={styles.addBtn} onClick={handleAddCategory}>+</button>
        </div>
        <div className={styles.ioRow}>
          <button className={styles.ioBtn} onClick={handleExport}>📥 导出</button>
          <button className={styles.ioBtn} onClick={handleImport}>📤 导入</button>
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className={styles.content}>
        <h3 className={styles.contentTitle}>{selCat} <small>({keywords.length}词)</small></h3>
        <div className={styles.addRow}>
          <input className={styles.addInput} placeholder="输入新关键词..." value={newKw}
            onChange={e => setNewKw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
          <button className={styles.addBtn} onClick={handleAdd}>+</button>
        </div>
        <div className={styles.itemList}>
          {keywords.length === 0 ? (
            <p className={styles.empty}>此分类暂无关键词，上方输入添加</p>
          ) : (
            keywords.map(item => (
              <div key={item.text} className={styles.itemRow}>
                <span className={styles.itemText}>
                  {item.tag === 'star' ? '⭐ ' : item.tag === 'hot' ? '🔥 ' : item.tag === 'new' ? '🆕 ' : ''}
                  {item.text}
                </span>
                <div className={styles.tagBtns}>
                  {(['star','hot','new'] as const).map(tag => (
                    <button key={tag} className={styles.tagBtn} title={tag}
                      style={{ opacity: item.tag === tag ? 1 : 0.3 }}
                      onClick={async () => {
                        await toggleKeywordTag(selCat, item.text, tag, lang);
                        // Refresh local state
                        setLibrary(prev => {
                          const next = {...prev};
                          const items = [...(next[selCat] || [])];
                          const idx = items.findIndex(i => i.text === item.text);
                          if (idx >= 0) { items[idx] = {...items[idx], tag: items[idx].tag === tag ? null : tag}; }
                          next[selCat] = items;
                          return next;
                        });
                      }}>
                      {{star:'⭐',hot:'🔥',new:'🆕'}[tag]}
                    </button>
                  ))}
                </div>
                <button className={styles.delBtn}
                  onClick={() => { removeKeyword(selCat, item.text, lang); refresh(); }}
                  title="删除">✕</button>
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
  const [allPrompts, setAllPrompts] = useState<PromptTemplate[]>([]);
  const [selCat, setSelCat] = useState<string>(PROMPT_CATEGORIES[0]!);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    getPromptLibrary().then(setAllPrompts).catch(() => setAllPrompts([]));
  }, []);

  const prompts = allPrompts.filter((p) => p.category === selCat);

  const handleAdd = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    await addPrompt({ name: newName.trim(), category: selCat, tags: [], prompt: newPrompt.trim() });
    setNewName('');
    setNewPrompt('');
    setShowAdd(false);
    getPromptLibrary().then(setAllPrompts).catch(() => {});
    refresh();
  };

  const handleExport = async () => {
    const json = await exportPromptLibrary();
    const blob = new Blob([json], { type: 'application/json' });
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
      reader.onload = async () => {
        try {
          await importPromptLibrary(reader.result as string);
          getPromptLibrary().then(setAllPrompts).catch(() => {});
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
                      onClick={async () => { await removePrompt(p.id); refresh(); }}
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
