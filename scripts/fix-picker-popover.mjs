import { readFileSync, writeFileSync } from 'node:fs';

let f = readFileSync('apps/web/src/components/NewProjectPanel.tsx', 'utf8');

// 1. Add triggerRef to the first ds-picker-trigger button (in DesignSystemPicker)
f = f.replace(
  /(className=\{`ds-picker-trigger\$\{open \? ' open' : ''\}\$\{primary \? '' : ' empty'\}`\})/,
  "$1\n\t\t\tref={triggerRef}"
);

// 2. Add fixed position style to the popover div
f = f.replace(
  '<div className="ds-picker-popover" role="listbox">',
  '<div className="ds-picker-popover" role="listbox" style={popStyle ? { top: popStyle.top, left: popStyle.left, width: popStyle.width } : undefined}>'
);

// 3. Add resize/scroll listeners
f = f.replace(
  /document\.addEventListener\('keydown', onKey\);/,
  "document.addEventListener('keydown', onKey);\n\t\twindow.addEventListener('resize', calcPosition);\n\t\twindow.addEventListener('scroll', calcPosition, true);"
);

// 4. Add cleanup
f = f.replace(
  /document\.removeEventListener\('keydown', onKey\);/,
  "window.removeEventListener('resize', calcPosition);\n\t\twindow.removeEventListener('scroll', calcPosition, true);\n\t\tdocument.removeEventListener('keydown', onKey);"
);

writeFileSync('apps/web/src/components/NewProjectPanel.tsx', f);

// Verify
const checks = ['ref={triggerRef}', 'popStyle ?', 'calcPosition'];
for (const c of checks) {
  console.log(c + ':', f.includes(c) ? 'OK' : 'MISSING');
}
