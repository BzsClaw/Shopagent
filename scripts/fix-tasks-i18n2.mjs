import { readFileSync, writeFileSync } from 'node:fs';

let f = readFileSync('apps/web/src/components/TasksView.tsx', 'utf8');

const replacements = [
  // Empty state
  ['<strong>No automations yet</strong>', '<strong>{t(\'tasksView.emptyTitle\')}</strong>'],
  ['<span>Create one from a template or start with a blank schedule.</span>', '<span>{t(\'tasksView.emptyDesc\')}</span>'],

  // Last run
  ['<span>Last run {formatAutomationTimestamp(r.lastRun.startedAt)}</span>', '<span>{t(\'tasksView.lastRun\', { time: formatAutomationTimestamp(r.lastRun.startedAt) })}</span>'],

  // Buttons
  ['<span>Run</span>', '<span>{t(\'tasksView.run\')}</span>'],
  ['<span>Edit</span>', '<span>{t(\'tasksView.edit\')}</span>'],
  ['<span>Apply</span>', '<span>{t(\'tasksView.apply\')}</span>'],

  // No templates
  ['<strong>No templates in this category yet.</strong>', '<strong>{t(\'tasksView.noTemplatesTitle\')}</strong>'],
  ['<p>Try a different filter, or start from a blank automation.</p>', '<p>{t(\'tasksView.noTemplatesDesc\')}</p>'],

  // Run history
  ['<span>Run history</span>', '<span>{t(\'tasksView.runHistory\')}</span>'],
  ['<span>Latest 10</span>', '<span>{t(\'tasksView.latest\', { n: \'10\' })}</span>'],
];

for (const [old, nw] of replacements) {
  if (f.includes(old)) {
    f = f.replace(old, nw);
    console.log('Replaced:', old.substring(0, 50));
  } else {
    console.log('NOT FOUND:', old.substring(0, 50));
  }
}

writeFileSync('apps/web/src/components/TasksView.tsx', f);
console.log('\nDone');
