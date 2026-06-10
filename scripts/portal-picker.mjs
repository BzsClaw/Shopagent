import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'apps/web/src/components/NewProjectPanel.tsx';
let f = readFileSync(PATH, 'utf8');

// ---- 1. Import createPortal from react-dom ----
f = f.replace(
  "import { useEffect, useId, useMemo, useRef, useState } from 'react';",
  "import { useEffect, useId, useMemo, useRef, useState } from 'react';\nimport { createPortal } from 'react-dom';"
);

// ---- 2. Find DesignSystemPicker function and add state vars ----
// Locate the start of the function
const fnMarker = 'function DesignSystemPicker({';
const fnIdx = f.indexOf(fnMarker);
if (fnIdx < 0) { console.log('ERROR: DesignSystemPicker not found'); process.exit(1); }

// Find searchRef inside DesignSystemPicker (within ~30 lines of fnMarker)
const section = f.substring(fnIdx, fnIdx + 2000);
const searchRefIdx = section.indexOf('  const searchRef = useRef<HTMLInputElement | null>(null);');
if (searchRefIdx < 0) { console.log('ERROR: searchRef not found'); process.exit(1); }

const searchRefLine = '  const searchRef = useRef<HTMLInputElement | null>(null);';
const insertPos = fnIdx + searchRefIdx + searchRefLine.length;

const newVars = `
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [popStyle, setPopStyle] = useState(null);
  const calcPosition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPopStyle({ top: r.bottom + 6, left: r.left, width: r.width });
  };`;

f = f.slice(0, insertPos) + newVars + f.slice(insertPos);

console.log('Step 1-2: imports + state vars OK');

// ---- 3. Add calcPosition call in the open useEffect ----
// The pattern inside DesignSystemPicker's first useEffect:
//   useEffect(() => {
//     if (!open) return;
//     const t = window.setTimeout(() => searchRef.current?.focus(), 30);
// Change to:
//   useEffect(() => {
//     if (!open) { setPopStyle(null); return; }
//     calcPosition();
//     const t = window.setTimeout(() => searchRef.current?.focus(), 30);
f = f.replace(
  /(  useEffect\(\(\) => \{\n    if \(!open\) return;\n    const t = window\.setTimeout)/,
  '  useEffect(() => {\n    if (!open) { setPopStyle(null); return; }\n    calcPosition();\n    const t = window.setTimeout'
);

console.log('Step 3: useEffect OK');

// ---- 4. Add resize/scroll listeners ----
f = f.replace(
  "document.addEventListener('keydown', onKey);",
  "document.addEventListener('keydown', onKey);\n      window.addEventListener('resize', calcPosition);\n      window.addEventListener('scroll', calcPosition, true);"
);

f = f.replace(
  "document.removeEventListener('keydown', onKey);",
  "window.removeEventListener('resize', calcPosition);\n      window.removeEventListener('scroll', calcPosition, true);\n      document.removeEventListener('keydown', onKey);"
);

console.log('Step 4: listeners OK');

// ---- 5. Add ref={triggerRef} to the button ----
f = f.replace(
  "className={`ds-picker-trigger${open ? ' open' : ''}${primary ? '' : ' empty'}`}",
  "className={`ds-picker-trigger${open ? ' open' : ''}${primary ? '' : ' empty'}`}\n\t\t\tref={triggerRef}"
);

console.log('Step 5: triggerRef OK');

// ---- 6. Wrap popover in createPortal ----
f = f.replace(
  '{open ? (\n        <div className="ds-picker-popover" role="listbox">',
  '{open && popStyle ? createPortal(\n        <div className="ds-picker-popover" role="listbox" style={{ position: "fixed", top: popStyle.top, left: popStyle.left, width: popStyle.width }}>'
);

console.log('Step 6: createPortal open OK');

// ---- 7. Close the createPortal ----
f = f.replace(
  /(        <\/div>\n      \) : null\})/,
  '        </div>, document.body\n      ) : null}'
);

console.log('Step 7: createPortal close OK');

// ---- Update CSS ----
// The popover now uses position: fixed via inline style, update the CSS
const cssPath = 'apps/web/src/styles/workspace/connectors.css';
let css = readFileSync(cssPath, 'utf8');

// Revert to clean state first
css = css.replace(
  /\.ds-picker-popover \{[\s\S]*?\n\}/,
  `.ds-picker-popover {
  position: fixed;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: ds-pop-in 140ms cubic-bezier(0.2, 0, 0.2, 1);
}`
);

// Also fix modal overflow
const modalCss = 'apps/web/src/styles/home/new-project-modal.css';
let modal = readFileSync(modalCss, 'utf8');

// .new-project-modal: overflow: hidden → overflow: visible
modal = modal.replace(
  '  overflow: hidden;\n}\n.new-project-modal__head',
  '  overflow: visible;\n}\n.new-project-modal__head'
);

// .new-project-modal__body: overflow: hidden → overflow-y: auto
modal = modal.replace(
  '  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n}\n/* NewProjectPanel',
  '  overflow-y: auto;\n  overflow-x: hidden;\n  display: flex;\n  flex-direction: column;\n}\n/* NewProjectPanel'
);

writeFileSync(cssPath, css);
writeFileSync(modalCss, modal);
writeFileSync(PATH, f);

console.log('All done');
