/**
 * Listing SQLite persistence (M8)
 * Reuses the OD database instance via initListingDb(db).
 * Reference: PRD §6.2 M8, OD apps/daemon/src/db.ts
 */
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type {
  ListingRun,
  ListingImage,
  ListingProductInput,
  ListingOutput,
} from '@open-design/contracts';

// ─── Init ──────────────────────────────────────────────

let _db: Database.Database | null = null;

export function initListingDb(db: Database.Database): void {
  _db = db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      skill_id TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'shopee',
      product_data TEXT NOT NULL DEFAULT '{}',
      result_data TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      error TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS listing_images (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      module_tag TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt TEXT NOT NULL,
      image_base64 TEXT,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      task_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (run_id) REFERENCES listing_runs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_listing_images_run
      ON listing_images(run_id);
  `);
}

function db(): Database.Database {
  if (!_db) throw new Error('listing-db not initialized — call initListingDb(db) first');
  return _db;
}

// ─── Runs CRUD ────────────────────────────────────────

export function createListingRun(params: {
  skillId: string;
  platform: string;
  productData: ListingProductInput;
  projectId?: string;
}): string {
  const id = randomUUID();
  const now = Date.now();
  db().prepare(`
    INSERT INTO listing_runs (id, project_id, skill_id, platform, product_data, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)
  `).run(id, params.projectId ?? null, params.skillId, params.platform,
    JSON.stringify(params.productData), now, now);
  return id;
}

export function getListingRun(id: string): ListingRun | null {
  const row = db().prepare('SELECT * FROM listing_runs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    projectId: row.project_id as string | null,
    skillId: row.skill_id as string,
    platform: row.platform as string,
    productData: JSON.parse(row.product_data as string),
    resultData: row.result_data ? JSON.parse(row.result_data as string) : null,
    status: row.status as string,
    error: row.error as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function updateListingRun(id: string, patch: {
  status?: string;
  resultData?: ListingOutput | null;
  error?: string | null;
}): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.status !== undefined) { sets.push('status = ?'); vals.push(patch.status); }
  if (patch.resultData !== undefined) { sets.push('result_data = ?'); vals.push(JSON.stringify(patch.resultData)); }
  if (patch.error !== undefined) { sets.push('error = ?'); vals.push(patch.error); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  vals.push(Date.now());
  vals.push(id);
  db().prepare(`UPDATE listing_runs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function listListingRuns(projectId?: string, limit = 20): ListingRun[] {
  const sql = projectId
    ? 'SELECT * FROM listing_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM listing_runs ORDER BY created_at DESC LIMIT ?';
  const params = projectId ? [projectId, limit] : [limit];
  const rows = db().prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string | null,
    skillId: row.skill_id as string,
    platform: row.platform as string,
    productData: JSON.parse(row.product_data as string),
    resultData: row.result_data ? JSON.parse(row.result_data as string) : null,
    status: row.status as string,
    error: row.error as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }));
}

// ─── Images CRUD ──────────────────────────────────────

export function createListingImage(params: {
  runId: string;
  moduleTag: string;
  model: string;
  prompt: string;
}): string {
  const id = randomUUID();
  const now = Date.now();
  db().prepare(`
    INSERT INTO listing_images (id, run_id, module_tag, model, prompt, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, params.runId, params.moduleTag, params.model, params.prompt, now, now);
  return id;
}

export function getListingImage(id: string): ListingImage | null {
  const row = db().prepare('SELECT * FROM listing_images WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    runId: row.run_id as string,
    moduleTag: row.module_tag as string,
    model: row.model as string,
    prompt: row.prompt as string,
    imageBase64: row.image_base64 as string | null,
    imageUrl: row.image_url as string | null,
    status: row.status as ListingImage['status'],
    taskId: row.task_id as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function updateListingImage(id: string, patch: {
  status?: string;
  imageBase64?: string | null;
  imageUrl?: string | null;
  taskId?: string | null;
}): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.status !== undefined) { sets.push('status = ?'); vals.push(patch.status); }
  if (patch.imageBase64 !== undefined) { sets.push('image_base64 = ?'); vals.push(patch.imageBase64); }
  if (patch.imageUrl !== undefined) { sets.push('image_url = ?'); vals.push(patch.imageUrl); }
  if (patch.taskId !== undefined) { sets.push('task_id = ?'); vals.push(patch.taskId); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  vals.push(Date.now());
  vals.push(id);
  db().prepare(`UPDATE listing_images SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function listListingImages(runId: string): ListingImage[] {
  const rows = db().prepare(
    'SELECT * FROM listing_images WHERE run_id = ? ORDER BY created_at ASC'
  ).all(runId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    runId: row.run_id as string,
    moduleTag: row.module_tag as string,
    model: row.model as string,
    prompt: row.prompt as string,
    imageBase64: row.image_base64 as string | null,
    imageUrl: row.image_url as string | null,
    status: row.status as ListingImage['status'],
    taskId: row.task_id as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }));
}
