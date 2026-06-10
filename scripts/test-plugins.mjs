// Direct test of plugin registration to find the root cause
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, '.od', 'app.sqlite');

console.log('DB path:', dbPath);
const db = new Database(dbPath);

// Check if table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

// Check installed_plugins count
const count = db.prepare('SELECT COUNT(*) as c FROM installed_plugins').get();
console.log('installed_plugins count:', count.c);

// Dynamically import the registration
const bundledRoot = path.join(projectRoot, 'plugins', '_official');
console.log('Bundled root:', bundledRoot);

const fs = await import('fs');
console.log('Bundled root exists:', fs.existsSync(bundledRoot));

if (fs.existsSync(bundledRoot)) {
  const top = fs.readdirSync(bundledRoot);
  console.log('Top-level dirs:', top);

  // Check one plugin
  const sampleDir = path.join(bundledRoot, 'atoms', 'build-test');
  console.log('\nSample plugin dir:', sampleDir);
  console.log('Exists:', fs.existsSync(sampleDir));
  if (fs.existsSync(sampleDir)) {
    console.log('Contents:', fs.readdirSync(sampleDir));
    const manifest = path.join(sampleDir, 'open-design.json');
    console.log('Manifest exists:', fs.existsSync(manifest));
    if (fs.existsSync(manifest)) {
      const content = fs.readFileSync(manifest, 'utf8');
      console.log('Manifest length:', content.length);
      try { JSON.parse(content); console.log('JSON valid'); }
      catch(e) { console.log('JSON INVALID:', e.message); }
    }
  }
}

db.close();
