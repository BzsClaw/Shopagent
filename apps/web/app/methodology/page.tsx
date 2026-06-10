/**
 * 方法论页面 — 6 章彩色 HTML 排版
 * 移植自 ListingGen src/app/methodology/page.tsx
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { navigate } from '../../src/router';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'var(--sans)',
});

const CHAPTERS = [
  { id: '01', file: '/methodology/01-序言.html', title: '序言', subtitle: '这台机器为什么能跨平台复用' },
  { id: '02', file: '/methodology/02-需求侧.html', title: '需求侧', subtitle: '搜出真需求' },
  { id: '03', file: '/methodology/03-供给侧.html', title: '供给侧', subtitle: '用 SKU 矩阵承接需求' },
  { id: '04', file: '/methodology/04-匹配侧.html', title: '匹配侧', subtitle: '喂饱平台算法' },
  { id: '05', file: '/methodology/05-三端咬合.html', title: '三端咬合', subtitle: '完整循环与漏斗诊断罗盘' },
  { id: '06', file: '/methodology/06-官方规范手册.html', title: '官方规范', subtitle: 'Shopee Listing 官方规范手册 · 2026 准则版' },
];

export default function MethodologyPage() {
  useEffect(() => { document.title = '方法论 — Open Yourself'; }, []);

  const [activeId, setActiveId] = useState('01');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chap = CHAPTERS.find((c) => c.id === activeId);
    if (!chap) return;
    if (chap.id === '06') return;
    setLoading(true);
    fetch(chap.file)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent('<p style="color:var(--red)">加载失败</p>'))
      .finally(() => setLoading(false));
  }, [activeId]);

  // HTML 渲染后自动渲染 mermaid 流程图
  useEffect(() => {
    if (!content || loading) return;
    const timer = setTimeout(() => {
      mermaid.run({ querySelector: 'pre.mermaid' }).catch(() => {});
    }, 50);
    return () => clearTimeout(timer);
  }, [content, loading]);

  const currentIdx = CHAPTERS.findIndex((c) => c.id === activeId);
  const current = CHAPTERS[currentIdx];
  const prev = currentIdx > 0 ? CHAPTERS[currentIdx - 1] : null;
  const next = currentIdx < CHAPTERS.length - 1 ? CHAPTERS[currentIdx + 1] : null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 44px)', fontFamily: 'var(--sans)' }}>
      {/* 左侧目录 */}
      <aside style={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
        background: 'var(--bg-subtle)', overflowY: 'auto', padding: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button onClick={() => navigate({ kind: 'listing' })}
            style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '2px 8px', cursor: 'pointer' }}>
            ← 工作台
          </button>
        </div>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 }}>
          📖 方法论目录
        </h3>
        {CHAPTERS.map((chap) => (
          <button key={chap.id} onClick={() => setActiveId(chap.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
              borderRadius: 'var(--radius-sm)', border: 0, cursor: 'pointer', marginBottom: 2,
              fontSize: 12, fontFamily: 'var(--sans)',
              color: activeId === chap.id ? 'var(--accent)' : 'var(--text-muted)',
              background: activeId === chap.id ? 'var(--accent-tint)' : 'transparent',
              fontWeight: activeId === chap.id ? 500 : 400,
            }}>
            <span style={{ fontSize: 10, color: activeId === chap.id ? 'var(--accent)' : 'var(--text-faint)', marginRight: 6 }}>
              {chap.id}
            </span>
            {chap.title}
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2, marginLeft: 18 }}>
              {chap.subtitle}
            </div>
          </button>
        ))}
      </aside>

      {/* 右侧正文 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{
          flexShrink: 0, borderBottom: '1px solid var(--border)',
          padding: '12px 24px', background: 'var(--bg-subtle)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            第{currentIdx + 1}章 · {current?.subtitle}
          </span>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-strong)', margin: '4px 0 0' }}>
            {current?.title}：{current?.subtitle}
          </h1>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {current?.id === '06' ? (
            <iframe src={current.file} style={{ width: '100%', height: '100%', border: 0 }} title={current.title} />
          ) : loading ? (
            <div style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
              <div style={{ height: 20, background: 'var(--bg-muted)', borderRadius: 4, width: '60%', marginBottom: 12 }} />
              <div style={{ height: 14, background: 'var(--bg-muted)', borderRadius: 4, width: '100%', marginBottom: 8 }} />
              <div style={{ height: 14, background: 'var(--bg-muted)', borderRadius: 4, width: '80%' }} />
            </div>
          ) : (
            <div ref={contentRef} dangerouslySetInnerHTML={{ __html: content }} />
          )}
        </div>

        {/* 底部分页 */}
        <div style={{
          flexShrink: 0, borderTop: '1px solid var(--border)',
          padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-subtle)',
        }}>
          <button onClick={() => prev && setActiveId(prev.id)} disabled={!prev}
            style={{ fontSize: 12, color: prev ? 'var(--text-muted)' : 'var(--text-faint)',
              background: 'none', border: 0, cursor: prev ? 'pointer' : 'default' }}>
            ← {prev ? `${prev.id} ${prev.title}` : '没有上一章'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{currentIdx + 1} / {CHAPTERS.length}</span>
          <button onClick={() => next && setActiveId(next.id)} disabled={!next}
            style={{ fontSize: 12, color: next ? 'var(--text-muted)' : 'var(--text-faint)',
              background: 'none', border: 0, cursor: next ? 'pointer' : 'default' }}>
            {next ? `${next.id} ${next.title}` : '没有下一章'} →
          </button>
        </div>
      </main>
    </div>
  );
}
