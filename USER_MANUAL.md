# Loavashi Hub User Manual

## Overview
Loavashi Hub is a cafe and restaurant management system with separate admin and cashier workflows. The app includes POS billing, inventory tracking, purchase order management, recipe tracking, assets, expenses, and reports.

## Access and Login

1. Open the app in your browser.
2. Use the login page to sign in.
3. Demo accounts:
   - Admin: `loavashihub@gmail.com` / `Loavashi123`
   - Cashier: `cashier@loavashi.com` / `cashier123`

## Navigation

- `/login` — Login page.
- `/admin` — Admin dashboard.
- `/pos` — Point of sale page (cashier or admin access).
- `/admin/inventory` — Manage inventory stock.
- `/admin/purchases` — Create purchase orders and receive stock.
- `/admin/recipes` — Manage recipes and consume inventory.
- `/admin/assets` — Track physical assets.
- `/admin/reports` — View financial and inventory reports.

## POS Page

The POS page allows cashiers and admins to:

- create and manage bills
- save bills for later
- complete payments and mark bills as served
- review open and completed invoices
- merge bills
- print receipts with invoice numbers and cafe details
- view table occupancy and order status counts

## Inventory Management

Use the Inventory page to:

- add new stock items
- update existing stock quantities and units
- remove expired or obsolete items
- monitor low-stock warnings

## Purchase Products

The purchase page supports purchase order entry with:

- product name
- vendor
- quantity and unit
- unit cost and total spend
- order status

### Restocking inventory

When a purchase order is marked as `Received`, the system will:

- increase the matching inventory item quantity if the purchased product already exists
- create a new inventory item for the purchased product if it does not already exist

This makes it easy to receive deliveries and keep stock levels current.

## Recipe Management

The recipe page is used to define menu recipes and track ingredient use. When recipe consumption is applied, it deducts the ingredient quantities from shared inventory.

## PWA Install and Offline Support

The application includes:

- a web manifest at `/manifest.json`
- a service worker at `/service-worker.js`
- `public/logo.jpeg` used as the PWA icon

### Install on desktop or mobile

1. Open the app in a supported browser.
2. Look for the install prompt or browser menu option.
3. Install the app to your device.

### Offline usage

Once installed, the app caches the shell and manifest assets. If the device goes offline, the app can continue to load the cached home screen and resources.

## Troubleshooting

- If the app does not install, verify the manifest and service worker files are present.
- If the PWA icon does not appear, make sure `public/logo.jpeg` is available and referenced in `manifest.json`.
- If receipt printing does not work, confirm your browser supports `window.print()`.

## Deployment

This app can be deployed automatically through Vercel when connected to GitHub.

1. Push this repository to GitHub.
2. Connect the repository to Vercel.
3. In the Vercel dashboard, add the required Firebase and Cloudinary environment variables.
4. Use the build command:
   ```bash
   npm run build
   ```

Vercel will deploy a preview or production build automatically whenever code is pushed to the connected branch.

## Support

For testing or deployment questions, use the development commands:

```bash
npm install
npm run dev
npm run build
npm run preview
```
