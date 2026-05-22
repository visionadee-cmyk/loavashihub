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

function generateInventoryProductId() {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `LHC${suffix}`;
}

function generateInventoryProductNumber() {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `${suffix}`;
}

async function migrateInventoryIds() {
  try {
    console.log('Starting inventory migration...');
    const inventorySnapshot = await db.collection('inventory').get();

    let updated = 0;
    let skipped = 0;

    for (const doc of inventorySnapshot.docs) {
      const data = doc.data();

      // Only update if productId doesn't exist
      if (!data.productId) {
        const productId = generateInventoryProductId();
        const productNumber = generateInventoryProductNumber();

        await db.collection('inventory').doc(doc.id).update({
          productId,
          productNumber,
        });

        console.log(`✓ Updated: ${doc.id} → productId: ${productId}, productNumber: ${productNumber}`);
        updated++;
      } else {
        console.log(`⊘ Skipped: ${doc.id} (already has productId: ${data.productId})`);
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

migrateInventoryIds();
