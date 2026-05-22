import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function generateMenuItemId() {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `LHPOS${suffix}`;
}

async function migrateMenuIds() {
  try {
    console.log('Starting menu items migration...');
    const menuSnapshot = await db.collection('menuItems').get();

    let updated = 0;
    let skipped = 0;

    for (const doc of menuSnapshot.docs) {
      const data = doc.data();

      // Only update if menuItemId doesn't exist
      if (!data.menuItemId) {
        const menuItemId = generateMenuItemId();

        await db.collection('menuItems').doc(doc.id).update({
          menuItemId,
        });

        console.log(`✓ Updated: ${doc.id} (${data.name}) → menuItemId: ${menuItemId}`);
        updated++;
      } else {
        console.log(`⊘ Skipped: ${doc.id} (${data.name}) (already has menuItemId: ${data.menuItemId})`);
        skipped++;
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

migrateMenuIds();
