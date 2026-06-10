import { readFileSync, writeFileSync } from 'node:fs';

let f = readFileSync('apps/web/src/components/TasksView.tsx', 'utf8');

// 1. Add useT import
if (!f.includes("import { useT } from '../i18n'")) {
  f = f.replace(
    "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
    "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';\nimport { useT } from '../i18n';"
  );
}

// 2. Add const t = useT(); after useAnalytics()
f = f.replace(
  '  const analytics = useAnalytics();',
  '  const t = useT();\n  const analytics = useAnalytics();'
);

// 3. Replace header strings
f = f.replace(
  'Scheduled agent sessions',
  "{t('tasksView.eyebrow')}"
);
f = f.replace(
  /(<h1 id="automations-title" className="automations-hero__title">)\s*\n\s*Automations\s*\n\s*(<\/h1>)/,
  "<h1 id=\"automations-title\" className=\"automations-hero__title\">{t('tasksView.title')}</h1>"
);
f = f.replace(
  /(<p className="automations-hero__lede">)\s*\n\s*Plan recurring conversations for project work, Orbit digests, and live artifacts\.\s*\n\s*(<\/p>)/,
  "<p className=\"automations-hero__lede\">{t('tasksView.lede')}</p>"
);

// 4. Replace Metrics
f = f.replace(
  /label="Active"/g,
  "label={t('tasksView.active')}"
);
f = f.replace(
  /label="Paused"/g,
  "label={t('tasksView.paused')}"
);
f = f.replace(
  /label="Templates"/g,
  "label={t('tasksView.templates')}"
);

// 5. Replace New automation button text
f = f.replace(
  '<span>New automation</span>',
  "<span>{t('tasksView.newAutomation')}</span>"
);

// 6. Wrap TEMPLATE_FILTERS span in JSX correctly
// The old code was <span className="automations-hero__eyebrow">Scheduled agent sessions</span>
// After step 3 it became <span className="automations-hero__eyebrow">{t('tasksView.eyebrow')}</span>
// Make sure it's properly wrapped in JSX

writeFileSync('apps/web/src/components/TasksView.tsx', f);
console.log('TaskView i18n fixes applied');
