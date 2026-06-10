/**
 * ReflyWorkbench — embeds Refly via iframe.
 * Dev: points to localhost:5173 (Refly dev server).
 * Prod: points to /workflow-app/ (static files).
 */
'use client';

const REFLY_URL = 'http://localhost:5173/workspace';

export function ReflyWorkbench() {
  return (
    <iframe
      src={REFLY_URL}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title="Refly Workflow"
    />
  );
}
