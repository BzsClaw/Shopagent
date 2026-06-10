/**
 * 关键词选择器 — 移植自 ListingGen KeywordPicker
 * 弹出 Dialog，搜索并选择关键词追加到输入框
 */
'use client';

import { useState } from 'react';
import { getKeywordLibrary } from '../../lib/listing/keyword-library';
import styles from './KeywordPicker.module.css';

interface KeywordPickerProps {
  value: string;
  onConfirm: (newValue: string) => void;
  defaultCategory?: string;
}

export function KeywordPicker({ value, onConfirm, defaultCategory }: KeywordPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const library = getKeywordLibrary();

  const filtered = search.trim()
    ? Object.entries(library).flatMap(([cat, kws]) =>
        kws.filter((kw) => kw.toLowerCase().includes(search.toLowerCase())).map((kw) => ({ category: cat, keyword: kw })))
    : Object.entries(library).flatMap(([cat, kws]) => kws.map((kw) => ({ category: cat, keyword: kw })));

  if (defaultCategory && !search.trim()) {
    filtered.sort((a, b) => {
      if (a.category === defaultCategory && b.category !== defaultCategory) return -1;
      if (b.category === defaultCategory && a.category !== defaultCategory) return 1;
      return 0;
    });
  }

  const toggle = (kw: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(kw)) next.delete(kw); else next.add(kw); return next; });
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
      <button className={styles.pickerBtn} onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }} title="从关键词库选择">
        📚 从库选择
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.title}>选择关键词</h3>
            <p className={styles.desc}>搜索并勾选需要的关键词，确认后追加到输入框</p>

            <input className={styles.search} placeholder="搜索关键词..." value={search}
              onChange={(e) => setSearch(e.target.value)} autoFocus />

            <div className={styles.list}>
              {filtered.length === 0 ? (
                <p className={styles.empty}>关键词库为空。请先在「资源库」页面添加关键词。</p>
              ) : (
                (() => {
                  const grouped = new Map<string, typeof filtered>();
                  for (const item of filtered) {
                    const list = grouped.get(item.category) || [];
                    list.push(item); grouped.set(item.category, list);
                  }
                  return [...grouped.entries()].map(([cat, items]) => (
                    <div key={cat} className={styles.group}>
                      <p className={styles.catName}>{cat}</p>
                      <div className={styles.chips}>
                        {items.map(({ keyword }) => (
                          <button key={keyword}
                            className={`${styles.chip} ${selected.has(keyword) ? styles.chipOn : ''}`}
                            onClick={() => toggle(keyword)}>
                            {keyword}
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
