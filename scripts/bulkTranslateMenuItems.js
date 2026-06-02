import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';

// Simple helper script to export menu items to CSV for offline translation
// and import the CSV back to update `nameBn` fields.
// Usage:
//   node ./scripts/bulkTranslateMenuItems.js export   -> writes menu-items-export.csv
//   node ./scripts/bulkTranslateMenuItems.js import   -> reads menu-items-export.csv and updates Firestore

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

function csvEscape(value) {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

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

async function ensureServiceAccount() {
  if (!existsSync(serviceAccountPath)) {
    console.error('serviceAccountKey.json not found in project root.');
    console.error('Place your Firebase service account JSON at serviceAccountKey.json or set GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }
  const raw = await fs.readFile(serviceAccountPath, 'utf8');
  return JSON.parse(raw);
}

async function initAdmin() {
  const serviceAccount = await ensureServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

async function exportCsv() {
  const db = await initAdmin();
  const snapshot = await db.collection('menuItems').get();
  const rows = [];
  rows.push(['id', 'menuItemId', 'name', 'nameBn', 'category', 'price', 'costPrice', 'description'].join(','));
  snapshot.docs.forEach((doc) => {
    const d = doc.data();
    const cols = [
      csvEscape(doc.id),
      csvEscape(d.menuItemId),
      csvEscape(d.name),
      csvEscape(d.nameBn || ''),
      csvEscape(d.category || ''),
      csvEscape(d.price ?? ''),
      csvEscape(d.costPrice ?? ''),
      csvEscape(d.description || ''),
    ];
    rows.push(cols.join(','));
  });
  const out = rows.join('\n');
  const outPath = path.join(__dirname, '../menu-items-export.csv');
  await fs.writeFile(outPath, out, 'utf8');
  console.log(`Wrote ${snapshot.size} items to ${outPath}`);
  await admin.app().delete();
}

async function importCsv() {
  const db = await initAdmin();
  const inPath = path.join(__dirname, '../menu-items-export.csv');
  if (!existsSync(inPath)) {
    console.error('menu-items-export.csv not found. Run export first.');
    process.exit(1);
  }
  const raw = await fs.readFile(inPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    console.error('CSV appears empty or only header present.');
    process.exit(1);
  }
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idIndex = header.indexOf('id');
  const nameBnIndex = header.indexOf('nameBn');
  if (idIndex === -1 || nameBnIndex === -1) {
    console.error('CSV header must include id and nameBn columns.');
    process.exit(1);
  }

  let updated = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const docId = cols[idIndex];
    const nameBn = cols[nameBnIndex] || '';
    if (!docId) continue;
    if (!nameBn || !nameBn.trim()) continue;
    try {
      await db.collection('menuItems').doc(docId).update({ nameBn: nameBn.trim() });
      updated++;
      console.log(`Updated ${docId}`);
    } catch (err) {
      console.error(`Failed to update ${docId}:`, err.message || err);
    }
  }

  console.log(`Import complete. Updated ${updated} documents.`);
  await admin.app().delete();
}

async function main() {
  const arg = process.argv[2] || 'export';
  if (arg === 'export') {
    await exportCsv();
  } else if (arg === 'import') {
    await importCsv();
  } else {
    console.log('Unknown command. Use "export" or "import".');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});