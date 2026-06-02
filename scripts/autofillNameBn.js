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

async function autofill() {
  try {
    console.log('Scanning menuItems for missing nameBn...');
    const snapshot = await db.collection('menuItems').get();
    let updated = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const currentBn = data.nameBn;
      const name = data.name || '';
      if (!currentBn || !String(currentBn).trim()) {
        await db.collection('menuItems').doc(doc.id).update({ nameBn: name });
        console.log(`Updated ${doc.id}: set nameBn = "${name}"`);
        updated++;
      }
    }
    console.log(`Done. Updated ${updated} documents.`);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

autofill();
