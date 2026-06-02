import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('serviceAccountKey.json not found in project root.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function translateText(text) {
  try {
    const res = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'en', target: 'bn', format: 'text' }),
    });
    if (!res.ok) throw new Error(`Translate API ${res.status}`);
    const data = await res.json();
    return data.translatedText;
  } catch (err) {
    console.error('Translate failed:', err && err.message ? err.message : err);
    return null;
  }
}

function looksLikeBangla(text) {
  if (!text) return false;
  // check for presence of Bengali Unicode block (U+0980–U+09FF)
  return /[\u0980-\u09FF]/.test(text);
}

async function main() {
  try {
    console.log('Fetching menu items...');
    const snapshot = await db.collection('menuItems').get();
    console.log(`Found ${snapshot.size} items.`);
    let updated = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const d = doc.data();
      const name = (d.name || '').trim();
      const currentBn = (d.nameBn || '').trim();

      if (!name) {
        skipped++;
        continue;
      }

      // Skip if it already looks Bengali
      if (looksLikeBangla(currentBn)) {
        skipped++;
        continue;
      }

      // If nameBn equals English fallback, translate
      try {
        const translated = await translateText(name);
        if (translated) {
          await db.collection('menuItems').doc(doc.id).update({ nameBn: translated });
          console.log(`Updated ${doc.id}: "${name}" → "${translated}"`);
          updated++;
        } else {
          console.log(`No translation for ${doc.id} (${name})`);
        }
      } catch (err) {
        console.error(`Failed to update ${doc.id}:`, err && err.message ? err.message : err);
      }

      // gentle pause to avoid rate limits
      await sleep(300);
    }

    console.log(`Done. Updated: ${updated}, Skipped: ${skipped}`);
  } catch (err) {
    console.error(err);
  } finally {
    await admin.app().delete();
  }
}

main();
