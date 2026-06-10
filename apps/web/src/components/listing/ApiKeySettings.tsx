/**
 * API 配置 — 完全复刻 ListingGen settings/page.tsx
 */
'use client';

import { useState, useEffect } from 'react';
import OpenAI from 'openai';
import styles from './ApiKeySettings.module.css';

const LS_CONFIG = 'shopagent:config';

interface AppConfig {
  llmApiKey: string; llmBaseUrl: string; llmModel: string;
  imageApiKey: string; imageBaseUrl: string; imageModel: string;
}
const DEFAULTS: AppConfig = {
  llmApiKey: '', llmBaseUrl: 'https://api.deepseek.com/v1', llmModel: 'deepseek-chat',
  imageApiKey: '', imageBaseUrl: 'https://api.apimart.ai/v1', imageModel: 'gemini-3.1-flash-image-preview',
};

function loadConfig(): AppConfig { try { const r = localStorage.getItem(LS_CONFIG); return r ? { ...DEFAULTS, ...JSON.parse(r) } : DEFAULTS; } catch { return DEFAULTS; } }
function saveConfig(c: AppConfig) { localStorage.setItem(LS_CONFIG, JSON.stringify(c)); }

export function ApiKeySettings() {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULTS);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [showImgKey, setShowImgKey] = useState(false);

  useEffect(() => {
    const c = loadConfig();
    setCfg(c);
    // 首次加载时同步到独立 localStorage key，确保 page.tsx 能读到
    localStorage.setItem('shopagent:deepseekKey', c.llmApiKey);
    localStorage.setItem('shopagent:deepseekUrl', c.llmBaseUrl);
    localStorage.setItem('shopagent:apimartKey', c.imageApiKey);
    localStorage.setItem('shopagent:apimartUrl', c.imageBaseUrl);
    localStorage.setItem('shopagent:imageModel', c.imageModel);
  }, []);

  const update = (k: keyof AppConfig, v: string) => {
    const next = { ...cfg, [k]: v }; setCfg(next); saveConfig(next);
    // also update individual localStorage for generate request
    if (k === 'llmApiKey') localStorage.setItem('shopagent:deepseekKey', v);
    if (k === 'llmBaseUrl') localStorage.setItem('shopagent:deepseekUrl', v);
    if (k === 'imageApiKey') localStorage.setItem('shopagent:apimartKey', v);
    if (k === 'imageBaseUrl') localStorage.setItem('shopagent:apimartUrl', v);
    if (k === 'imageModel') localStorage.setItem('shopagent:imageModel', v);
  };

  // 复刻 ListingGen apimart.ts testConnection — OpenAI SDK + 错误透传
  const test = async (type: string) => {
    setTesting(type);
    try {
      const key = type === 'llm' ? cfg.llmApiKey : cfg.imageApiKey;
      const url = type === 'llm' ? cfg.llmBaseUrl : cfg.imageBaseUrl;
      const client = new OpenAI({
        apiKey: key,
        baseURL: url,
        dangerouslyAllowBrowser: true,
      });
      const models = await client.models.list();
      setTestResult((p) => ({ ...p, [type]: { ok: models.data.length > 0 } }));
    } catch (e) {
      setTestResult((p) => ({ ...p, [type]: { ok: false, error: e instanceof Error ? e.message : String(e) } }));
    }
    setTesting(null);
  };

  const handleExport = () => { const b = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'shopagent-config.json'; a.click(); };
  const handleImport = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const c = { ...DEFAULTS, ...JSON.parse(r.result as string) }; setCfg(c); saveConfig(c); } catch { alert('格式错误'); } }; r.readAsText(f); }; i.click(); };
  const handleClear = () => { if (confirm('确定清除所有配置？')) { setCfg(DEFAULTS); saveConfig(DEFAULTS); } };

  return (
    <div className={styles.settings}>
      <h2 className={styles.heading}>⚙ API 配置</h2>

      {/* LLM */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>LLM 配置</h3>
        <p className={styles.cardDesc}>DeepSeek 官方 API，用于撰写标题、文案和生图 prompt</p>
        <label className={styles.label}>DeepSeek API Key</label>
        <div className={styles.keyRow}>
          <input type={showLlmKey ? 'text' : 'password'} className={styles.input} value={cfg.llmApiKey}
            onChange={(e) => update('llmApiKey', e.target.value)} placeholder="sk-..." />
          <button className={styles.eyeBtn} onClick={() => setShowLlmKey(!showLlmKey)}>{showLlmKey ? '🙈' : '👁'}</button>
        </div>
        <label className={styles.label}>Base URL</label>
        <input type="text" className={`${styles.input} ${styles.mono}`} value={cfg.llmBaseUrl}
          onChange={(e) => update('llmBaseUrl', e.target.value)} />
        <div className={styles.testRow}>
          <button className={styles.testBtn} onClick={() => test('llm')} disabled={testing === 'llm' || !cfg.llmApiKey}>
            {testing === 'llm' ? '...' : '测试连接'}
          </button>
          {testResult.llm && <span className={testResult.llm.ok ? styles.ok : styles.fail}>{testResult.llm.ok ? '✓ 连接成功' : `✗ ${testResult.llm.error || '连接失败'}`}</span>}
        </div>
      </div>

      {/* Image */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>生图配置</h3>
        <p className={styles.cardDesc}>APIMart 中转站调用生图模型（三选一）</p>
        <label className={styles.label}>APIMart API Key</label>
        <div className={styles.keyRow}>
          <input type={showImgKey ? 'text' : 'password'} className={styles.input} value={cfg.imageApiKey}
            onChange={(e) => update('imageApiKey', e.target.value)} placeholder="sk-..." />
          <button className={styles.eyeBtn} onClick={() => setShowImgKey(!showImgKey)}>{showImgKey ? '🙈' : '👁'}</button>
        </div>
        <label className={styles.label}>Base URL</label>
        <input type="text" className={`${styles.input} ${styles.mono}`} value={cfg.imageBaseUrl}
          onChange={(e) => update('imageBaseUrl', e.target.value)} placeholder="https://api.apimart.ai/v1" />
        <div className={styles.testRow}>
          <button className={styles.testBtn} onClick={() => test('img')} disabled={testing === 'img' || !cfg.imageApiKey}>
            {testing === 'img' ? '...' : '测试连接'}
          </button>
          {testResult.img && <span className={testResult.img.ok ? styles.ok : styles.fail}>{testResult.img.ok ? '✓ 连接成功' : `✗ ${testResult.img.error || '连接失败'}`}</span>}
        </div>
        <label className={styles.label}>生图模型</label>
        <select className={styles.select} value={cfg.imageModel} onChange={(e) => update('imageModel', e.target.value)}>
          <option value="gpt-image-2">GPT-Image-2 — OpenAI（~30s）</option>
          <option value="gemini-3.1-flash-image-preview">Gemini Flash Image — Google Nano Banana 2（~15s）</option>
          <option value="doubao-seedance-4-5">即梦 Seedance 4.5 — 字节豆包（~15s）</option>
        </select>
      </div>

      {/* Storage */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>本地存储</h3>
        <p className={styles.cardDesc}>⚠️ API Key 仅存储在浏览器 localStorage，不会上传</p>
        <div className={styles.storageRow}>
          <button className={styles.storageBtn} onClick={handleExport}>📥 导出配置</button>
          <button className={styles.storageBtn} onClick={handleImport}>📤 导入配置</button>
          <button className={`${styles.storageBtn} ${styles.danger}`} onClick={handleClear}>🗑 清除所有 Key</button>
        </div>
      </div>
    </div>
  );
}
