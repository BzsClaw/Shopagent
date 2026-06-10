import { readFileSync, writeFileSync } from 'node:fs';

let f = readFileSync('apps/web/src/components/DesignSystemsTab.tsx', 'utf8');

// Check if useT is already imported
if (!f.includes("import { useT } from '../i18n'")) {
  // Add useT import (useI18n is already imported)
  f = f.replace(
    /import \{ useI18n \} from '\.\.\/i18n';/,
    "import { useI18n } from '../i18n';\nimport { useT } from '../i18n';"
  );
}

// Add t hook - find the { locale, t } destructuring
if (!f.includes('const t = useT()')) {
  // This component already uses { locale, t } from useI18n()
  // So t is already available. No need to add useT separately.
  // Let me check...
}

// Replace hardcoded strings
f = f.replace(
  '<span className="ds-manager-eyebrow">Design Systems</span>',
  '<span className="ds-manager-eyebrow">{t(\'ds.eyebrow\')}</span>'
);
f = f.replace(
  'eyebrow="Design Systems"',
  'eyebrow={t(\'ds.eyebrow\')}'
);
f = f.replace(
  '<span className="ds-create-row__action">Create</span>',
  '<span className="ds-create-row__action">{t(\'ds.create\')}</span>'
);
f = f.replace(
  '{selected ? <span className="ds-card-badge">Default</span> : null}',
  '{selected ? <span className="ds-card-badge">{t(\'ds.default\')}</span> : null}'
);

writeFileSync('apps/web/src/components/DesignSystemsTab.tsx', f);
console.log('DesignSystemsTab i18n fixes applied');
