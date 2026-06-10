import { readFileSync, writeFileSync } from 'fs';

let f = readFileSync('apps/web/src/components/WorkspaceTabsBar.tsx', 'utf8');

// uniqueIdForTab: add listing/methodology before fallback
f = f.replace(
  /(  if \(tab\.kind === 'marketplace'\) \{\n    return `marketplace:\$\{tab\.pluginId \?\? 'index'\}:\$\{nowId\(\)\}`;\n  \}\n)  return `entry:\$\{tab\.view\}:\$\{nowId\(\)\}`;/,
  "$1  if (tab.kind === 'listing') return `listing:${nowId()}`;\n  if (tab.kind === 'methodology') return `methodology:${nowId()}`;\n  return `entry:${tab.view}:${nowId()}`;"
);

// reviveTab: add listing/methodology
f = f.replace(
  /(  if \(record\.kind === 'marketplace'\) \{\n    return \{\n      id,\n      kind: 'marketplace',\n      pluginId: typeof record\.pluginId === 'string' \? record\.pluginId : null,\n      createdAt,\n      lastActiveAt,\n    \};\n  \})/,
  "$1\n  if (record.kind === 'listing') {\n    return { id, kind: 'listing', createdAt, lastActiveAt };\n  }\n  if (record.kind === 'methodology') {\n    return { id, kind: 'methodology', createdAt, lastActiveAt };\n  }"
);

// displayTabFor: add listing/methodology before the entryTitle record
f = f.replace(
  /(  const entryTitle: Record<EntryHomeView, string> = \{)/,
  "  if (tab.kind === 'listing') return { id: tab.id, title: 'Listing 工作台', meta: 'E-Commerce', icon: 'kanban' as IconName, tab };\n  if (tab.kind === 'methodology') return { id: tab.id, title: '方法论', meta: 'Methodology', icon: 'blocks' as IconName, tab };\n\n$1"
);

writeFileSync('apps/web/src/components/WorkspaceTabsBar.tsx', f);
console.log('Done');
