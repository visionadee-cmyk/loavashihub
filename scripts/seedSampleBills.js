import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import https from 'node:https';
import { URLSearchParams } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sample menu items for generating bills
const sampleMenuItems = [
  { name: 'Mas Riha', price: 45, category: 'Maldivian Curries' },
  { name: 'Garudhiya', price: 35, category: 'Maldivian Curries' },
  { name: 'Fried Rice', price: 55, category: 'Rice Dishes' },
  { name: 'Chicken Curry', price: 65, category: 'Chicken' },
  { name: 'Fish Masala', price: 55, category: 'Hedhikaa' },
  { name: 'Samosa', price: 15, category: 'Hedhikaa' },
  { name: 'Patties', price: 12, category: 'Hedhikaa' },
  { name: 'Bajiya', price: 10, category: 'Foni Heddikaa' },
  { name: 'Gulha', price: 8, category: 'Foni Heddikaa' },
  { name: 'Tea', price: 10, category: 'Beverages' },
  { name: 'Coffee', price: 25, category: 'Beverages' },
  { name: 'Fresh Juice', price: 30, category: 'Beverages' },
  { name: 'Lassi', price: 20, category: 'Beverages' },
  { name: 'Grilled Chicken', price: 85, category: 'Chicken' },
  { name: 'Chicken Biryani', price: 75, category: 'Chicken' },
];

const paymentMethods = ['Cash', 'Card', 'Bank transfer'];
const orderTypes = ['Dine-in', 'Takeaway', 'Delivery'];
const statuses = ['Served'];
const tables = ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Counter'];

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signJwt(privateKey, payload) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  const signature = signer.sign(privateKey, 'base64');
  return `${encodedHeader}.${encodedPayload}.${signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: value.toString() }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

function fetchJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (!data) {
          resolve(null);
          return;
        }
        try {
          const json = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Request failed ${res.statusCode}: ${JSON.stringify(json)}`));
          } else {
            resolve(json);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function getServiceAccount() {
  const defaultKeyPath = path.join(__dirname, '../serviceAccountKey.json');
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultKeyPath;

  if (!existsSync(serviceAccountPath)) {
    console.error('Service account key not found.');
    console.error('Place a serviceAccountKey.json file in the project root, or set GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }

  const content = await fs.readFile(serviceAccountPath, 'utf-8');
  return JSON.parse(content);
}

async function getAccessToken(serviceAccount) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat,
  };

  const assertion = signJwt(serviceAccount.private_key, payload);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }).toString();

  const response = await fetchJson(
    {
      method: 'POST',
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body,
  );

  if (!response || !response.access_token) {
    throw new Error('Failed to obtain access token from Google OAuth2');
  }

  return response.access_token;
}

async function writeFirestoreDocument(projectId, accessToken, collection, docId, data) {
  const fields = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]),
  );

  const payload = JSON.stringify({ fields });
  await fetchJson(
    {
      method: 'PATCH',
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    payload,
  );
}

function getRandomItems() {
  const numItems = Math.floor(Math.random() * 4) + 1; // 1-4 items
  const items = [];
  const usedIndices = new Set();

  for (let i = 0; i < numItems; i++) {
    let index;
    do {
      index = Math.floor(Math.random() * sampleMenuItems.length);
    } while (usedIndices.has(index));
    usedIndices.add(index);

    const menuItem = sampleMenuItems[index];
    const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
    items.push({
      id: `item-${Date.now()}-${i}`,
      name: menuItem.name,
      price: menuItem.price,
      quantity: quantity,
      notes: '',
    });
  }

  return items;
}

function generateRandomDate(daysAgo, hourRange) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  
  if (hourRange) {
    const hour = Math.floor(Math.random() * (hourRange[1] - hourRange[0])) + hourRange[0];
    date.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  } else {
    // Weighted towards meal times
    const mealHours = [11, 12, 13, 18, 19, 20, 21];
    const hour = mealHours[Math.floor(Math.random() * mealHours.length)];
    date.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  }
  
  return date;
}

async function seedSampleBills(projectId, accessToken, count = 50) {
  console.log(`Seeding ${count} sample bills into Firestore...`);
  
  // Weight payment methods: Cash more common, then Card, then Bank transfer
  const paymentWeights = [0.5, 0.35, 0.15]; // Cash, Card, Bank transfer
  
  for (let i = 0; i < count; i++) {
    const items = getRandomItems();
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    // Random payment method with weights
    const rand = Math.random();
    let paymentMethod;
    if (rand < paymentWeights[0]) {
      paymentMethod = 'Cash';
    } else if (rand < paymentWeights[0] + paymentWeights[1]) {
      paymentMethod = 'Card';
    } else {
      paymentMethod = 'Bank transfer';
    }
    
    const createdAt = generateRandomDate(7); // Past 7 days
    const billNumber = `BILL-${String(i + 1).padStart(4, '0')}`;
    
    const bill = {
      id: `bill-${Date.now()}-${i}`,
      billNumber,
      title: `Order ${billNumber}`,
      table: tables[Math.floor(Math.random() * tables.length)],
      items,
      orderType: orderTypes[Math.floor(Math.random() * orderTypes.length)],
      discount: 0,
      tax: 0,
      status: statuses[0],
      notes: '',
      paymentMethod,
      paymentStatus: 'Paid',
      createdAt: createdAt.toISOString(),
    };
    
    const docId = `bill-${createdAt.getTime()}-${i}`;
    await writeFirestoreDocument(projectId, accessToken, 'bills', docId, bill);
    console.log(`  • Created bill ${billNumber} - ${formatCurrency(subtotal)} (${paymentMethod})`);
  }
  
  console.log(`Successfully seeded ${count} sample bills.`);
}

function formatCurrency(amount) {
  return `MVR ${amount.toFixed(2)}`;
}

async function main() {
  const serviceAccount = await getServiceAccount();
  const accessToken = await getAccessToken(serviceAccount);
  const projectId = serviceAccount.project_id;

  if (!projectId) {
    throw new Error('Project ID is missing from service account credentials.');
  }

  const args = process.argv.slice(2);
  const count = args.length > 0 ? parseInt(args[0]) : 50;

  await seedSampleBills(projectId, accessToken, count);
  console.log('Sample bills seeding complete.');
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});