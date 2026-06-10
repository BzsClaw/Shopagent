/**
 * 关键词选择器 — daemon SQLite 持久化，按语言分类
 */
'use client';

import { useState, useEffect } from 'react';
import { getKeywordLibraryAsync, LANGUAGES, getDefaultCategories, type KeywordItem } from '../../lib/listing/keyword-library';
import styles from './KeywordPicker.module.css';

interface KeywordPickerProps {
  value: string;
  onConfirm: (newValue: string) => void;
  language?: string;
}

export function KeywordPicker({ value, onConfirm, language = 'en' }: KeywordPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [library, setLibrary] = useState<Record<string, KeywordItem[]>>({});
  const [lang, setLang] = useState(language);

  useEffect(() => {
    if (open) { getKeywordLibraryAsync(lang).then(setLibrary).catch(() => setLibrary({})); }
  }, [open, lang]);

  const items = search.trim()
    ? Object.entries(library).flatMap(([cat, kws]) =>
        kws.filter(k => k.text.toLowerCase().includes(search.toLowerCase())).map(k => ({ category: cat, ...k })))
    : Object.entries(library).flatMap(([cat, kws]) => kws.map(k => ({ category: cat, ...k })));

  const toggle = (kw: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(kw) ? n.delete(kw) : n.add(kw); return n; });
  };

  const handleConfirm = () => {
    if (selected.size === 0) { setOpen(false); return; }
    const str = [...selected].join(', ');
    const newVal = value.trim() ? `${value.trim()}, ${str}` : str;
    onConfirm(newVal);
    setSelected(new Set());
    setOpen(false);
  };

  return (
    <>
      <button className={styles.pickerBtn} onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }} title="关键词库">
        📚 关键词库
      </button>
      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.title}>关键词库</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select className={styles.select} value={lang} onChange={e => setLang(e.target.value)}>
                {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className={styles.search} placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ flex: 1 }} />
            </div>
            <div className={styles.list}>
              {items.length === 0 ? (
                <p className={styles.empty}>关键词库为空。请先在「资源库」添加。</p>
              ) : (
                (() => {
                  const grouped = new Map<string, typeof items>();
                  for (const item of items) { const l = grouped.get(item.category) || []; l.push(item); grouped.set(item.category, l); }
                  const ordered = getDefaultCategories();
                  const sorted = [...grouped.entries()].sort(([a], [b]) => {
                    const ia = ordered.indexOf(a), ib = ordered.indexOf(b);
                    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                  });
                  return sorted.map(([cat, catItems]) => (
                    <div key={cat} className={styles.group}>
                      <p className={styles.catName}>{cat}</p>
                      <div className={styles.chips}>
                        {catItems.map(({ text, tag }) => (
                          <button key={text}
                            className={`${styles.chip} ${selected.has(text) ? styles.chipOn : ''}`}
                            onClick={() => toggle(text)}>
                            {tag ? { star: '⭐', hot: '🔥', new: '🆕' }[tag] + ' ' : ''}{text}
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
            <div className={styles.footer}>
              <span className={styles.count}>已选 {selected.size} 个</span>
              <div className={styles.footerBtns}>
                <button className={styles.cancelBtn} onClick={() => { setSelected(new Set()); setOpen(false); }}>取消</button>
                <button className={styles.confirmBtn} onClick={handleConfirm} disabled={selected.size === 0}>确认选择</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
