/**
 * 将 methodology 01-05.md 转换为带颜色区分的 HTML
 * 参考 06-官方规范手册.html 的风格
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'apps', 'web', 'public', 'methodology');
const CSS = `<style>
  .methodology-article {
    max-width: 760px; margin: 0 auto; padding: 40px 32px 60px;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
    font-size: 15px; line-height: 1.85; color: #2c2c2c;
  }
  .methodology-article h1 {
    font-size: 28px; font-weight: 700; color: #1a1a1a;
    border-bottom: 3px solid #c96442; padding-bottom: 12px; margin: 0 0 8px;
  }
  .methodology-article h2 {
    font-size: 20px; font-weight: 700; color: #c96442;
    margin: 36px 0 12px; padding-left: 12px;
    border-left: 4px solid #c96442;
  }
  .methodology-article h3 {
    font-size: 16px; font-weight: 600; color: #b45a3b;
    margin: 24px 0 8px; padding: 8px 14px;
    background: #fef7f3; border-radius: 6px;
    border-left: 3px solid #e8a882;
  }
  .methodology-article h4 {
    font-size: 14px; font-weight: 600; color: #5a4a3f;
    margin: 18px 0 6px;
  }
  .methodology-article p { margin: 0 0 14px; }
  .methodology-article strong { color: #b45a3b; font-weight: 600; }
  .methodology-article blockquote {
    margin: 16px 0; padding: 12px 16px;
    background: #fff9f5; border-left: 4px solid #e8a882;
    border-radius: 0 8px 8px 0; color: #6b5a4f; font-size: 14px;
  }
  .methodology-article ul, .methodology-article ol {
    margin: 8px 0 16px; padding-left: 24px;
  }
  .methodology-article li { margin: 4px 0; }
  .methodology-article code {
    background: #fdf3eb; color: #c96442; font-size: 13px;
    padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace;
  }
  .methodology-article pre {
    background: #fdf6f0; border: 1px solid #f0d8c8;
    border-radius: 8px; padding: 14px 18px; overflow-x: auto;
    font-size: 13px; line-height: 1.6;
  }
  .methodology-article pre code { background: none; color: #4a3a2f; padding: 0; }
  .methodology-article table {
    width: 100%; border-collapse: collapse; margin: 16px 0;
    font-size: 13px;
  }
  .methodology-article th {
    background: #c96442; color: #fff; font-weight: 600;
    padding: 10px 14px; text-align: left;
  }
  .methodology-article td {
    padding: 8px 14px; border-bottom: 1px solid #f0d8c8;
  }
  .methodology-article tr:nth-child(even) td { background: #fefaf7; }
  .methodology-article hr {
    border: 0; border-top: 1px solid #e8d5c8; margin: 28px 0;
  }
  /* Mermaid 流程图 */
  .methodology-article pre.mermaid {
    background: #faf8f6; border: 1px solid #e8d5c8;
    border-radius: 10px; padding: 20px; margin: 18px 0;
    overflow-x: auto; text-align: center;
  }
  /* 关键提示卡片 */
  .methodology-article .key-card {
    background: linear-gradient(135deg, #fff9f5, #fef3ea);
    border: 1px solid #f0c8a8; border-radius: 10px;
    padding: 14px 18px; margin: 16px 0;
  }
  .methodology-article .key-card strong { color: #c96442; }
  /* 差异对比表 */
  .methodology-article .compare-table th:first-child { background: #8a6a5a; }
  .methodology-article .compare-table th:nth-child(2) { background: #c96442; }
  .methodology-article .compare-table th:nth-child(3) { background: #58B2DC; }
</style>\n`;

// 简单的 MD → HTML 转换器
function convertMdToHtml(md) {
  let html = md;

  // 代码块 (保护它们不被后续规则破坏)
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `%%CODEBLOCK_${idx}%%`;
  });

  // mermaid 代码块 → <pre class="mermaid"> 标签，浏览器端 mermaid.run() 渲染
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => {
    const block = codeBlocks[parseInt(idx)];
    if (block && (block.includes('flowchart') || block.includes('graph') || block.includes('sequenceDiagram') || block.includes('classDiagram') || block.includes('stateDiagram'))) {
      const code = block.replace(/<pre><code>/, '').replace(/<\/code><\/pre>/, '');
      codeBlocks[parseInt(idx)] = `<pre class="mermaid">${code}</pre>`;
      return `%%MERMAID_${idx}%%`;
    }
    return `%%CODEBLOCK_${idx}%%`;
  });

  // 标题
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 水平线
  html = html.replace(/^---+$/gm, '<hr>');

  // 引用
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // 多行引用合并
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // 粗体 **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 表格
  html = html.replace(/^\|(.+)\|$/gm, (line) => {
    const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c))) return '%%TABLE_SEP%%';
    const tag = '%%TABLE_ROW%%' + cells.map(c => `<td>${c}</td>`).join('') + '%%ENDROW%%';
    return tag;
  });

  // 包装表格
  html = html.replace(/((?:%%TABLE_ROW%%.*?%%ENDROW%%\n?)+)/g, (block) => {
    const rows = block.split('\n').filter(r => r.includes('%%TABLE_ROW%%'));
    if (rows.length <= 1) return block;
    const thead = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
    const tbody = rows.slice(1).map(r => `<tr>${r.replace(/%%TABLE_ROW%%/g, '').replace(/%%ENDROW%%/g, '')}</tr>`).join('\n');
    return `<table class="compare-table"><thead><tr>${thead.replace(/%%TABLE_ROW%%/g, '').replace(/%%ENDROW%%/g, '')}</tr></thead><tbody>${tbody}</tbody></table>`;
  });
  html = html.replace(/%%TABLE_SEP%%/g, '');

  // 列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // 编号列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // 段落 — 合并连续的非标签行
  html = html.replace(/^(?!<[a-z/]|%%|$)(.+)$/gm, '<p>$1</p>');

  // 恢复代码块和 mermaid
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => codeBlocks[parseInt(idx)] || '');
  html = html.replace(/%%MERMAID_(\d+)%%/g, (_, idx) => codeBlocks[parseInt(idx)] || '');

  // 清理空段落
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 主流程
const files = readdirSync(DIR).filter(f => f.match(/^0[1-5]-.*\.md$/)).sort();

for (const file of files) {
  const md = readFileSync(join(DIR, file), 'utf-8');
  const bodyHtml = convertMdToHtml(md);
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${CSS}
</head>
<body style="margin:0;background:#fdfcfa;">
<article class="methodology-article">
${bodyHtml}
</article>
</body>
</html>`;

  const outFile = file.replace('.md', '.html');
  writeFileSync(join(DIR, outFile), html, 'utf-8');
  console.log(`Converted: ${file} → ${outFile}`);
}
console.log('Done.');
