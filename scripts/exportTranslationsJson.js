import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const csvPath = path.join(process.cwd(), 'menu-items-export.csv');
const outPath = path.join(process.cwd(), 'menu-items-translations.json');

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        result.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  result.push(cur);
  return result;
}

async function main() {
  if (!existsSync(csvPath)) {
    console.error('CSV not found at', csvPath);
    process.exit(1);
  }

  const raw = await fs.readFile(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) {
    console.error('CSV appears empty');
    process.exit(1);
  }
  const header = parseCsvLine(lines[0]).map(h => h.trim());
  const idIdx = header.indexOf('id');
  const nameIdx = header.indexOf('name');
  const nameBnIdx = header.indexOf('nameBn');
  if (idIdx === -1 || nameIdx === -1 || nameBnIdx === -1) {
    console.error('CSV header missing required columns (id,name,nameBn)');
    process.exit(1);
  }

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const id = cols[idIdx] || '';
    const name = cols[nameIdx] || '';
    const nameBn = cols[nameBnIdx] || '';
    out.push({ id, name, nameBn });
  }

  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${out.length} items to ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
