/**
 * Listing CLI 子命令 (M7)
 * 注册到 OD cli.ts 的 SUBCOMMAND_MAP。
 * Reference: PRD §6.2 M7, OD apps/daemon/src/cli.ts
 */

const LISTING_STRING_FLAGS = new Set([
  'skill', 'product-name', 'subcategory', 'keywords', 'market', 'image', 'language',
  'daemon-url', 'dir',
]);
const LISTING_BOOLEAN_FLAGS = new Set(['json', 'help', 'h', 'wait']);

function parseArgv(argv: string[]): { positional: string[]; flags: Map<string, string | boolean> } {
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (LISTING_BOOLEAN_FLAGS.has(key)) {
        flags.set(key, true);
      } else if (LISTING_STRING_FLAGS.has(key)) {
        flags.set(key, argv[++i] ?? '');
      }
    } else if (arg === '-h') {
      flags.set('help', true);
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

export async function runListingCli(argv: string[]): Promise<void> {
  const { positional, flags } = parseArgv(argv);
  const subcommand = positional[0] ?? 'help';
  const isJson = flags.get('json') === true;

  switch (subcommand) {
    case 'skills':
      await cmdSkills(isJson);
      break;
    case 'generate':
      await cmdGenerate(flags, isJson);
      break;
    case 'status':
      await cmdStatus(positional[1], flags, isJson);
      break;
    case 'export':
      await cmdExport(positional[1], flags, isJson);
      break;
    case 'keywords':
      await cmdKeywords(positional.slice(1), flags, isJson);
      break;
    default:
      printListingHelp();
  }
}

// ─── skills ────────────────────────────────────────────

async function cmdSkills(json: boolean): Promise<void> {
  const daemonUrl = process.env.OD_DAEMON_URL ?? 'http://127.0.0.1:7456';
  try {
    const res = await fetch(`${daemonUrl}/api/listing/skills`);
    const skills = await res.json() as Array<{ id: string; name: string; platform: string }>;
    if (json) {
      process.stdout.write(JSON.stringify(skills) + '\n');
    } else {
      for (const s of skills) {
        process.stdout.write(`  ${s.id}  (${s.platform})  ${s.name}\n`);
      }
    }
  } catch (err) {
    if (json) process.stdout.write(JSON.stringify({ error: 'Failed to fetch skills' }) + '\n');
    else process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}

// ─── generate ──────────────────────────────────────────

async function cmdGenerate(flags: Map<string, string | boolean>, json: boolean): Promise<void> {
  const skillId = flags.get('skill') as string | undefined;
  const productName = flags.get('product-name') as string | undefined;
  const subcategory = flags.get('subcategory') as string | undefined;
  const keywords = flags.get('keywords') as string | undefined;
  const market = flags.get('market') as string | undefined;
  const imagePath = flags.get('image') as string | undefined;
  const language = flags.get('language') as string | undefined;

  if (flags.get('help') || flags.get('h')) {
    process.stdout.write(`Usage: od listing generate [options]

Options:
  --skill <id>            SKILL id (e.g., shopee-listing-v3)
  --product-name <name>   Product name (required)
  --subcategory <cat>     Subcategory (optional)
  --keywords <k1,k2,...>  Keywords (required)
  --market <code>         Target market: MY, SG, TH, PH, ID, VN, TW (default: MY)
  --image <path>          Product white-background image path
  --language <code>       Output language: en, zh-CN (default: en)
  --json                  Machine-readable JSON output
`);
    return;
  }

  if (!productName || !keywords || !skillId) {
    process.stderr.write('Error: --product-name, --keywords, and --skill are required\n');
    process.exitCode = 1;
    return;
  }

  // Read image file if provided
  let productImageBase64: string | undefined;
  if (imagePath) {
    try {
      const fs = await import('node:fs');
      productImageBase64 = fs.readFileSync(imagePath, 'base64');
    } catch {
      process.stderr.write(`Error: Cannot read image file: ${imagePath}\n`);
      process.exitCode = 1;
      return;
    }
  }

  const daemonUrl = process.env.OD_DAEMON_URL ?? 'http://127.0.0.1:7456';
  try {
    const res = await fetch(`${daemonUrl}/api/listing/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillId,
        product: {
          productName,
          subcategory: subcategory ?? '不指定（通用）',
          surfaceKeywords: keywords ?? '',
          sceneKeywords: keywords ?? '',
          emotionKeywords: '',
          coreDifferentiation: '',
          otherSellingPoints: '',
          productSpecs: '',
          targetMarket: market ?? 'MY',
          language: language ?? 'en',
          productImageBase64,
        },
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (json) {
      process.stdout.write(JSON.stringify(data) + '\n');
    } else {
      process.stdout.write(`Run ID: ${data.runId}\nStatus: ${data.status}\n`);
    }
  } catch (err) {
    if (json) process.stdout.write(JSON.stringify({ error: 'Failed to generate' }) + '\n');
    else process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}

// ─── status ────────────────────────────────────────────

async function cmdStatus(runId: string | undefined, flags: Map<string, string | boolean>, json: boolean): Promise<void> {
  if (!runId) {
    process.stderr.write('Usage: od listing status <run-id> [--json]\n');
    process.exitCode = 1;
    return;
  }

  const daemonUrl = process.env.OD_DAEMON_URL ?? 'http://127.0.0.1:7456';
  const shouldWait = flags.get('wait') === true;

  try {
    const poll = async (): Promise<string> => {
      const res = await fetch(`${daemonUrl}/api/listing/runs/${runId}`);
      const data = await res.json() as Record<string, unknown>;
      if (json) {
        process.stdout.write(JSON.stringify(data) + '\n');
      } else {
        process.stdout.write(`Status: ${data.status}\n`);
        if (data.error) process.stdout.write(`Error: ${data.error}\n`);
      }
      return data.status as string;
    };

    const status = await poll();
    if (shouldWait && !['completed', 'failed'].includes(status)) {
      process.stdout.write('Waiting for completion...\n');
      while (true) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await poll();
        if (['completed', 'failed'].includes(s)) break;
      }
    }
  } catch (err) {
    process.exitCode = 1;
  }
}

// ─── export ────────────────────────────────────────────

async function cmdExport(runId: string | undefined, flags: Map<string, string | boolean>, json: boolean): Promise<void> {
  if (!runId) {
    process.stderr.write('Usage: od listing export <run-id> [--dir <path>] [--json]\n');
    process.exitCode = 1;
    return;
  }

  const daemonUrl = process.env.OD_DAEMON_URL ?? 'http://127.0.0.1:7456';
  try {
    const res = await fetch(`${daemonUrl}/api/listing/runs/${runId}`);
    const data = await res.json() as Record<string, unknown>;
    if (json) {
      process.stdout.write(JSON.stringify(data) + '\n');
      return;
    }

    const outputDir = (flags.get('dir') as string | undefined) ?? `./listing-export-${runId!.slice(0, 8)}`;
    const fs = await import('node:fs');
    const path = await import('node:path');

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 写入完整 JSON
    fs.writeFileSync(path.join(outputDir, 'output.json'), JSON.stringify(data, null, 2), 'utf-8');

    const output = data.output as Record<string, unknown> | undefined;
    if (output) {
      // 标题
      const titleA = output.titleA as Record<string, unknown> | undefined;
      const titleB = output.titleB as Record<string, unknown> | undefined;
      if (titleA || titleB) {
        const titles = [
          `Title A (${titleA?.charCount ?? '?'} chars): ${titleA?.text ?? ''}`,
          `Title B (${titleB?.charCount ?? '?'} chars): ${titleB?.text ?? ''}`,
        ].join('\n\n');
        fs.writeFileSync(path.join(outputDir, 'titles.txt'), titles, 'utf-8');
      }

      // 文字描述
      const textDesc = output.textDesc as string | undefined;
      if (textDesc) {
        fs.writeFileSync(path.join(outputDir, 'description.txt'), textDesc, 'utf-8');
      }

      // 视频脚本
      const videoScript = output.videoScript as Record<string, unknown> | undefined;
      if (videoScript) {
        const shots = videoScript.shots as Array<Record<string, string>> | undefined;
        if (shots?.length) {
          const script = shots.map(
            (s) => `${s.name} | ${s.duration} | ${s.content} | ${s.reference}`
          ).join('\n');
          fs.writeFileSync(path.join(outputDir, 'video-script.txt'), script, 'utf-8');
        }
        const coverB64 = videoScript.coverImageBase64 as string | undefined;
        if (coverB64) writeBase64Image(fs, path, outputDir, 'video-cover.png', coverB64);
      }

      // 主图
      for (const tag of ['MAIN_A', 'MAIN_B', 'MAIN_C']) {
        const img = output[tag.toLowerCase()] as Record<string, unknown> | undefined;
        const b64 = img?.imageBase64 as string | undefined;
        const prompt = img?.prompt as string | undefined;
        if (b64) writeBase64Image(fs, path, outputDir, `${tag}.png`, b64);
        if (prompt) fs.writeFileSync(path.join(outputDir, `${tag}-prompt.txt`), prompt, 'utf-8');
      }

      // 详情图
      const details = output.details as Array<Record<string, unknown>> | undefined;
      if (details) {
        for (let i = 0; i < details.length; i++) {
          const d = details[i]!;
          const b64 = d.imageBase64 as string | undefined;
          const prompt = d.prompt as string | undefined;
          const overlay = d.overlay as string | undefined;
          if (b64) writeBase64Image(fs, path, outputDir, `detail-${i + 1}.png`, b64);
          if (prompt) fs.writeFileSync(path.join(outputDir, `detail-${i + 1}-prompt.txt`), prompt, 'utf-8');
          if (overlay) fs.writeFileSync(path.join(outputDir, `detail-${i + 1}-overlay.txt`), overlay, 'utf-8');
        }
      }
    }

    process.stdout.write(`Export complete: ${outputDir}\n`);
    process.stdout.write(`Files: ${fs.readdirSync(outputDir).join(', ')}\n`);
  } catch (err) {
    process.stderr.write(`Export error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}

function writeBase64Image(
  fs: { writeFileSync: (path: string, data: Buffer) => void },
  pathModule: { join: (...parts: string[]) => string },
  dir: string, filename: string, base64: string,
): void {
  try {
    const stripped = base64.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(pathModule.join(dir, filename), Buffer.from(stripped, 'base64'));
  } catch { /* skip corrupt images */ }
}

// ─── keywords ──────────────────────────────────────────

async function cmdKeywords(args: string[], flags: Map<string, string | boolean>, json: boolean): Promise<void> {
  const daemonUrl = process.env.OD_DAEMON_URL ?? 'http://127.0.0.1:7456';

  if (args[0] === 'import') {
    const filePath = args[1];
    if (!filePath) {
      process.stderr.write('Usage: od listing keywords import <file.json>\n');
      process.exitCode = 1;
      return;
    }
    try {
      const fs = await import('node:fs');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const res = await fetch(`${daemonUrl}/api/listing/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (json) process.stdout.write(JSON.stringify({ ok: res.ok }) + '\n');
      else process.stdout.write(`Keywords imported: ${res.ok ? 'OK' : 'FAILED'}\n`);
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
  } else {
    // list
    try {
      const res = await fetch(`${daemonUrl}/api/listing/keywords`);
      const data = await res.json() as Record<string, unknown>;
      if (json) process.stdout.write(JSON.stringify(data) + '\n');
      else process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    } catch (err) {
      process.exitCode = 1;
    }
  }
}

// ─── help ──────────────────────────────────────────────

function printListingHelp(): void {
  process.stdout.write(`Usage:
  od listing skills [--json]
      List available listing SKILLs.

  od listing generate --skill <id> --product-name "<name>" [options] [--json]
      Generate a listing. Required: --product-name, --keywords, --skill.
      Options: --subcategory <s> --keywords <k1,k2> --market <code> --image <path> --language <code>

  od listing status <run-id> [--json] [--wait]
      Get run status. --wait polls until completion.

  od listing export <run-id> [--dir <path>] [--json]
      Export listing output to directory.

  od listing keywords list [--json]
  od listing keywords import <file.json>
      Manage keyword library.
`);
}
