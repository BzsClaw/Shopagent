import { readFileSync, writeFileSync } from 'node:fs';

// 1. Fix CSS: z-index + position fixed for portal
const cssPath = 'apps/web/src/styles/workspace/connectors.css';
let css = readFileSync(cssPath, 'utf8');
css = css.replace(
  /(\.ds-picker-popover \{\s*\n\s*position: )absolute/,
  '$1fixed'
);
css = css.replace(
  /(\.ds-picker-popover \{[^}]*z-index: )\d+/,
  '$199999'
);
writeFileSync(cssPath, css);
console.log('CSS: OK');

// 2. Fix modal overflow
const modalCss = 'apps/web/src/styles/home/new-project-modal.css';
let modal = readFileSync(modalCss, 'utf8');
// .new-project-modal { ... overflow: hidden; ... } → overflow: visible
modal = modal.replace(
  /(\.new-project-modal \{[\s\S]*?)overflow: hidden;/,
  '$1overflow: visible;'
);
// .new-project-modal__body { ... overflow: hidden; ... } → overflow-y: auto
modal = modal.replace(
  /(\.new-project-modal__body \{[\s\S]*?)overflow: hidden;/,
  '$1overflow-y: auto;\n  overflow-x: hidden;'
);
writeFileSync(modalCss, modal);
console.log('Modal CSS: OK');

// 3. DesignSystemPicker: portal + position calculation
const tsxPath = 'apps/web/src/components/NewProjectPanel.tsx';
let f = readFileSync(tsxPath, 'utf8');

// Add createPortal import
f = f.replace(
  "import { useEffect, useId, useMemo, useRef, useState } from 'react';",
  "import { useEffect, useId, useMemo, useRef, useState } from 'react';\nimport { createPortal } from 'react-dom';"
);

// Modify DesignSystemPicker function
// Find the exact function block and transform it
const funcStart = f.indexOf('function DesignSystemPicker({');
const funcEnd = f.indexOf('\nfunction DsPickerItem({', funcStart);
const original = f.substring(funcStart, funcEnd);

// Step 3a: Add state vars after searchRef
let modified = original.replace(
  '  const searchRef = useRef<HTMLInputElement | null>(null);',
  `  const searchRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [popStyle, setPopStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const calcPosition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPopStyle({ top: r.bottom + 6, left: r.left, width: r.width });
  };`
);

// Step 3b: Add calcPosition in open useEffect
modified = modified.replace(
  '    if (!open) return;\n    const t = window.setTimeout(() => searchRef.current?.focus(), 30);',
  '    if (!open) { setPopStyle(null); return; }\n    calcPosition();\n    const t = window.setTimeout(() => searchRef.current?.focus(), 30);'
);

// Step 3c: Add resize/scroll listeners
modified = modified.replace(
  "document.addEventListener('keydown', onKey);",
  "document.addEventListener('keydown', onKey);\n      window.addEventListener('resize', calcPosition);\n      window.addEventListener('scroll', calcPosition, true);"
);
modified = modified.replace(
  "document.removeEventListener('keydown', onKey);",
  "window.removeEventListener('resize', calcPosition);\n      window.removeEventListener('scroll', calcPosition, true);\n      document.removeEventListener('keydown', onKey);"
);

// Step 3d: Add ref to button
modified = modified.replace(
  "className={`ds-picker-trigger${open ? ' open' : ''}${primary ? '' : ' empty'}`}",
  "className={`ds-picker-trigger${open ? ' open' : ''}${primary ? '' : ' empty'}`}\n            ref={triggerRef}"
);

// Step 3e: Wrap popover in createPortal
modified = modified.replace(
  '{open ? (\n        <div className="ds-picker-popover" role="listbox">',
  '{open && popStyle ? createPortal(\n        <div className="ds-picker-popover" role="listbox" style={{ position: "fixed", top: popStyle.top, left: popStyle.left, width: popStyle.width }}>'
);

// Step 3f: Close createPortal
modified = modified.replace(
  '        </div>\n      ) : null}',
  '        </div>, document.body\n      ) : null}'
);

// Apply the modified function
f = f.substring(0, funcStart) + modified + f.substring(funcEnd);

writeFileSync(tsxPath, f);
console.log('DesignSystemPicker: portal conversion OK');
