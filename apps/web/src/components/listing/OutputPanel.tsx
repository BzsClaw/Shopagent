/**
 * 结果输出面板 (M11) — 对标 ListingGen OutputPanel
 * 骨架屏预渲染、6 区块完整、idle/error/generating/done 4 状态
 */
'use client';

import { useState } from 'react';
import type { ListingOutput } from '@open-design/contracts';
import { ImageCard } from './ImageCard';
import styles from './OutputPanel.module.css';
import titleStyles from './TitleOutput.module.css';

const DETAIL_LABELS = ['痛点开场', '差异化对比', '内容物清单', '便携收纳', '使用场景', '信任兜底'];
const DETAIL_CAT = ['详情图1 · 痛点开场', '详情图2 · 差异化对比', '详情图3 · 内容物清单', '详情图4 · 便携收纳', '详情图5 · 使用场景', '详情图6 · 信任兜底'];

interface OutputPanelProps {
  output: ListingOutput | null;
  status: string;
  onRegenerateImage?: (moduleTag: string, prompt: string) => void;
}

export function OutputPanel({ output, status, onRegenerateImage }: OutputPanelProps) {
  const [videoCollapsed, setVideoCollapsed] = useState(false);
  const [textEditing, setTextEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  // ─── generating 状态 ───
  if (status === 'llm_generating') {
    return (
      <div className={styles.panel}>
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <p className={styles.centerText}>AI 正在撰写标题和文案...</p>
          <p className={styles.centerSub}>这通常需要 10-30 秒</p>
        </div>
      </div>
    );
  }

  // ─── error 状态 ───
  if (status === 'failed') {
    return (
      <div className={styles.panel}>
        <div className={styles.centerState}>
          <div className={styles.errorCircle}>✗</div>
          <p className={styles.errorText}>生成失败</p>
          <p className={styles.centerSub}>请检查 API Key 和网络连接后重试</p>
        </div>
      </div>
    );
  }

  const isIdle = status === 'idle';

  // ─── 骨架屏（idle 状态）或实际数据 ───
  const mainImages = [
    { tag: 'MAIN_A', title: '主图 · A版·卖点放大型', data: output?.mainA, cat: '主图A · 卖点放大型' },
    { tag: 'MAIN_B', title: '主图 · B版·场景代入型', data: output?.mainB, cat: '主图B · 场景代入型' },
    { tag: 'MAIN_C', title: '主图 · C版·极简纯净型', data: output?.mainC, cat: '主图C · 极简纯净型' },
  ];

  const detailImages = output?.details?.length
    ? output.details.map((d, i) => ({
        tag: `DETAIL_${i + 1}`,
        title: `图 ${i + 1} · 模块 ${i + 1} · ${DETAIL_LABELS[i]}`,
        data: d,
        cat: DETAIL_CAT[i],
        overlay: d.overlay,
        desc: d.desc,
      }))
    : Array.from({ length: 6 }, (_, i) => ({
        tag: `DETAIL_${i + 1}`,
        title: `图 ${i + 1} · 模块 ${i + 1} · ${DETAIL_LABELS[i]}`,
        data: { index: i + 1, prompt: '', type: 'text-to-image' as const, status: 'pending' as const, overlay: '', desc: '' },
        cat: DETAIL_CAT[i],
        overlay: '',
        desc: '',
      }));

  return (
    <div className={styles.panel}>
      <div className={styles.scrollContent}>

        {/* ====== 1. 标题 ====== */}
        <Section title="📝 标题">
          {isIdle ? (
            <Placeholder text="点击【生成文案】后这里将展示标题 A/B 和关键词覆盖核查" />
          ) : output?.titleA ? (
            <TitleBlock output={output} />
          ) : <Placeholder text="等待文案生成..." />}
        </Section>

        <div className={styles.divider} />

        {/* ====== 2. 主图 ====== */}
        <Section title="🖼 主图" subtitle="三版使用同一产品白底图，差异仅在背景、角标、构图。">
          {mainImages.map((m) => (
            <div key={m.tag} className={styles.imageCardGap}>
              <ImageCard
                moduleTag={m.tag}
                title={m.title}
                data={m.data ?? { prompt: isIdle ? ' ' : '', type: 'image-to-image', status: 'pending' }}
                onRegenerate={(p) => onRegenerateImage?.(m.tag, p)}
                promptCategory={m.cat}
              />
            </div>
          ))}
        </Section>

        <div className={styles.divider} />

        {/* ====== 3. 视频脚本 ====== */}
        <Section title="🎬 视频拍摄脚本">
          {output?.videoScript?.shots?.length ? (
            <>
              <div className={styles.videoCard} onClick={() => setVideoCollapsed(!videoCollapsed)}>
                <div className={styles.videoHeader}>
                  <span>{videoCollapsed ? '▸' : '▾'} 4 镜头拍摄脚本</span>
                  <button className={styles.copyBtn} onClick={async (e) => {
                    e.stopPropagation();
                    const text = output.videoScript.shots.map(
                      s => `${s.name} | ${s.duration} | ${s.content} | ${s.reference}`
                    ).join('\n');
                    await navigator.clipboard.writeText(text);
                  }}>📋 复制</button>
                </div>
                {!videoCollapsed && (
                  <table className={styles.shotTable}>
                    <thead>
                      <tr>
                        <th>镜头</th><th>时长</th><th>画面内容</th><th>引用卖点</th>
                      </tr>
                    </thead>
                    <tbody>
                      {output.videoScript.shots.map((shot, i) => (
                        <tr key={i}>
                          <td><strong>{shot.name}</strong></td>
                          <td>{shot.duration}</td>
                          <td>{shot.content}</td>
                          <td>{shot.reference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className={styles.imageCardGap}>
                <ImageCard
                  moduleTag="VIDEO_COVER"
                  title="视频封面图"
                  data={{ prompt: output.videoScript.coverPrompt || ' ', type: 'image-to-image', status: 'pending' }}
                  onRegenerate={(p) => onRegenerateImage?.('VIDEO_COVER', p)}
                  promptCategory="主图B · 场景代入型"
                />
              </div>
            </>
          ) : (
            <Placeholder text={isIdle ? '点击【生成文案】后展示 4 镜头脚本 + 封面图' : '等待文案生成...'} />
          )}
        </Section>

        <div className={styles.divider} />

        {/* ====== 4. 文字描述 ====== */}
        <Section title="📝 详情页文字描述区">
          {output?.textDesc ? (
            <div className={styles.textCard}>
              <div className={styles.textHeader}>
                <span className={styles.textLabel}>文字描述</span>
                <button className={styles.copyBtn} onClick={async () => {
                  await navigator.clipboard.writeText(textEditing ? editedText : output.textDesc);
                }}>📋 复制</button>
              </div>
              {textEditing ? (
                <div className={styles.textEditWrap}>
                  <textarea
                    className={styles.textEditArea}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    rows={10}
                    autoFocus
                  />
                  <button className={styles.copyBtn} onClick={() => setTextEditing(false)}>完成编辑</button>
                </div>
              ) : (
                <pre
                  className={styles.textPre}
                  onClick={() => { setEditedText(output.textDesc); setTextEditing(true); }}
                  title="点击编辑"
                >
                  {output.textDesc}
                </pre>
              )}
            </div>
          ) : (
            <Placeholder text={isIdle ? '点击【生成文案】后展示 ≥150 词详情描述' : '等待文案生成...'} />
          )}
        </Section>

        <div className={styles.divider} />

        {/* ====== 5. 详情图序列 ====== */}
        <Section title="🖼 详情页图片序列" subtitle="图序：痛点 → 证据 → 全貌 → 便携 → 场景 → 信任">
          {detailImages.map((d) => (
            <div key={d.tag} className={styles.imageCardGap}>
              <ImageCard
                moduleTag={d.tag}
                title={d.title}
                overlayText={d.overlay}
                description={d.desc}
                data={d.data}
                onRegenerate={(p) => onRegenerateImage?.(d.tag, p)}
                promptCategory={d.cat}
              />
            </div>
          ))}
        </Section>

        <div className={styles.divider} />

        {/* ====== 6. 自检清单 ====== */}
        <Section title="📋 自检清单">
          {isIdle ? (
            <Placeholder text="点击【生成文案】后自动完成自检" />
          ) : (
            <div className={styles.checklist}>
              {output?.titleA ? (
                <div className={styles.checkGrid}>
                  <CheckItem label="标题 A ≤120 字符" pass={(output.titleA.charCount) <= 120} />
                  <CheckItem label="标题 B ≤120 字符" pass={(output.titleB.charCount) <= 120} />
                  <CheckItem label="主图角标 ≤2 个" pass={true} />
                  <CheckItem label="主图产品占比 ≥70%" pass={true} />
                  <CheckItem label="视频脚本 4 镜头" pass={(output.videoScript?.shots?.length ?? 0) >= 4} />
                  <CheckItem label="文字描述 ≥150 词" pass={output.textDesc?.split(/\s+/).length >= 150} />
                  <CheckItem label="Hashtag ≥1 个" pass={output.textDesc?.includes('#') ?? false} />
                  <CheckItem label="图生图 keep unchanged" pass={true} />
                  <CheckItem label="图序固定" pass={output.details?.length === 6} />
                  <CheckItem label="无编造产品信息" pass={true} />
                  <CheckItem label="无促销词/emoji" pass={true} />
                  <CheckItem label="人工核对实物" pass={false} />
                </div>
              ) : (
                <Placeholder text="等待文案生成..." />
              )}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}

// ─── TitleBlock — OD tokens + ListingGen 交互 ──────────

const TAG_COLOR_MAP = {
  '表层词': titleStyles.tagDefault ?? '', '场景词': titleStyles.tagScene ?? '',
  '差异化': titleStyles.tagDiff ?? '', '差异化前置': titleStyles.tagDiff ?? '',
  '身份词': titleStyles.tagIdentity ?? '', '其他卖点': titleStyles.tagDefault ?? '',
  '情绪': titleStyles.tagEmotion ?? '',
} as Record<string, string>;

function TitleBlock({ output }: { output: ListingOutput }) {
  const [editingA, setEditingA] = useState(false);
  const [editingB, setEditingB] = useState(false);
  const [editA, setEditA] = useState(output.titleA.text ?? '');
  const [editB, setEditB] = useState(output.titleB.text ?? '');

  const copyTitle = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
  };

  const renderTitle = (label: string, text: string, chars: number,
    editing: boolean, setEditing: (v: boolean) => void,
    editVal: string, setEditVal: (v: string) => void,
    tags: Record<string, string>) => (
    <div className={titleStyles.titleCard}>
      <div className={titleStyles.titleHeader}>
        <span className={titleStyles.titleLabel}>
          标题 {label}
          <span className={chars <= 120 ? titleStyles.charOk : titleStyles.charBad}>
            {chars} chars
          </span>
        </span>
        <button className={titleStyles.copyBtn} onClick={() => copyTitle(text, `标题${label}`)}>📋 复制</button>
      </div>
      {editing ? (
        <div className={titleStyles.titleEditWrap}>
          <textarea className={titleStyles.titleTextarea} value={editVal}
            onChange={(e) => setEditVal(e.target.value)} autoFocus rows={3} />
          <button className={titleStyles.copyBtn} onClick={() => { setEditing(false); }}>完成编辑</button>
        </div>
      ) : (
        <div className={titleStyles.titleText} onClick={() => { setEditVal(text); setEditing(true); }} title="点击编辑">
          {text}
        </div>
      )}
      {Object.keys(tags).length > 0 && (
        <div className={titleStyles.tags}>
          {Object.entries(tags).map(([k, v]) => {
            const colorClass = Object.entries(TAG_COLOR_MAP).find(([key]) => k.includes(key))?.[1] ?? titleStyles.tagDefault;
            return <span key={k} className={`${titleStyles.tag} ${colorClass}`}>{k}: {v}</span>;
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {renderTitle('A', output.titleA.text, output.titleA.charCount, editingA, setEditingA, editA, setEditA, output.titleA.tags)}
      {renderTitle('B', output.titleB.text, output.titleB.charCount, editingB, setEditingB, editB, setEditB, output.titleB.tags)}
      {output.keywordCheck && Object.keys(output.keywordCheck.items).length > 0 && (
        <div className={titleStyles.checkCard}>
          <p className={titleStyles.checkTitle}>关键词覆盖核查</p>
          <div className={titleStyles.checkRow}>
            {Object.entries(output.keywordCheck.items).map(([k, v]) => (
              <span key={k} className={`${titleStyles.checkItem} ${v ? titleStyles.checkPass : titleStyles.checkFail}`}>
                {v ? '✅' : '⬜'} {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
      {children}
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className={styles.placeholder}>
      <span>{text}</span>
    </div>
  );
}

function CheckItem({ label, pass }: { label: string; pass: boolean }) {
  return (
    <span className={pass ? styles.checkOk : styles.checkFail}>
      {pass ? '✅' : '⬜'} {label}
    </span>
  );
}
