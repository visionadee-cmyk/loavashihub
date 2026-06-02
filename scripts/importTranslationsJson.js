import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
const jsonPath = path.join(process.cwd(), 'menu-items-translations.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('serviceAccountKey.json not found in project root.');
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error('menu-items-translations.json not found in project root.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) {
      console.error('JSON must be an array of translation objects.');
      process.exit(1);
    }

    let updated = 0;
    let skipped = 0;
    for (const item of items) {
      if (!item.id) {
        console.warn('Skipping item with missing id:', item);
        skipped++;
        continue;
      }
      if (!('nameBn' in item)) {
        console.warn(`Skipping ${item.id}: missing nameBn`);
        skipped++;
        continue;
      }
      const nameBn = item.nameBn?.toString().trim();
      if (!nameBn) {
        console.warn(`Skipping ${item.id}: empty nameBn`);
        skipped++;
        continue;
      }

      await db.collection('menuItems').doc(item.id).update({ nameBn });
      console.log(`Updated ${item.id}`);
      updated++;
    }

    console.log(`Import complete. Updated ${updated}, skipped ${skipped}.`);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

main();
