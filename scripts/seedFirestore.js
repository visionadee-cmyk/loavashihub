import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import https from 'node:https';
import { URLSearchParams } from 'node:url';

const dataFiles = [
  'beverages.json',
  'chickenrecipes.json',
  'fonihedhikaa.json',
  'hedhikaa.json',
  'maldiviacurries.json',
];

const categoryMap = {
  'beverages.json': 'Beverages',
  'chickenrecipes.json': 'Chicken',
  'fonihedhikaa.json': 'Foni Heddikaa',
  'hedhikaa.json': 'Hedhikaa',
  'maldiviacurries.json': 'Maldivian Curries',
};

const placeholderImage = 'https://via.placeholder.com/400x300?text=Menu+Item';

function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function loadJson(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
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

async function fetchJson(options, body) {
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
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

async function seedFile(projectId, accessToken, filename) {
  const category = categoryMap[filename] || filename.replace(/\.json$/i, '');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(__dirname, '../src/data', filename);

  if (!existsSync(filePath)) {
    console.warn(`Skipping ${filename}: file not found.`);
    return;
  }

  const items = await loadJson(filePath);
  if (!Array.isArray(items)) {
    console.warn(`Skipping ${filename}: JSON file is not an array.`);
    return;
  }

  console.log(`Seeding ${items.length} items from ${filename} into Firestore...`);

  for (const item of items) {
    const name = item.title || item.name;
    if (!name) {
      console.warn(`Skipping item without title/name in ${filename}`);
      continue;
    }

    const slug = slugify(name);
    const menuItemId = `menu-${slug}`;
    const recipeId = `recipe-${slug}`;

    const menuItem = {
      id: menuItemId,
      name,
      category,
      price: 0,
      costPrice: 0,
      description: `Imported from ${category}`,
      image: placeholderImage,
    };
    const recipe = {
      id: recipeId,
      name,
      ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
      salePrice: 0,
      status: 'Active',
    };

    await writeFirestoreDocument(projectId, accessToken, 'menuItems', menuItemId, menuItem);
    await writeFirestoreDocument(projectId, accessToken, 'recipes', recipeId, recipe);
    console.log(`  • Saved ${name}`);
  }
}

async function main() {
  const serviceAccount = await getServiceAccount();
  const accessToken = await getAccessToken(serviceAccount);
  const projectId = serviceAccount.project_id;

  if (!projectId) {
    throw new Error('Project ID is missing from service account credentials.');
  }

  for (const filename of dataFiles) {
    await seedFile(projectId, accessToken, filename);
  }

  console.log('Firestore seeding complete.');
}

main().catch((error) => {
  console.error('Firestore seeding failed:', error);
  process.exit(1);
});
