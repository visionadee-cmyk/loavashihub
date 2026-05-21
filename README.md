# Loavashi Hub

Loavashi Hub is a local-first cafe and restaurant management system built with React, Vite, Tailwind CSS, Framer Motion, Firebase, and PWA support.

## Features

- Admin and cashier login
- Modern POS billing system
- Menu, table, staff, inventory, expense, and reports management
- Role-based protected routes and role-aware navigation
- Purchase order workflow that restocks inventory automatically when received
- Recipe management with inventory tracking and consumable deduction
- Installable PWA using `public/logo.jpeg` as the app icon
- Offline asset caching and service worker support
- Receipt printing for bills

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```
3. Add your Firebase project values to `.env`.
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open the local address shown by Vite, typically:
   ```bash
   http://localhost:5173
   ```

## Demo accounts

- Admin: `loavashihub@gmail.com` / `Loavashi123`
- Cashier: `cashier@loavashi.com` / `cashier123`

## Firebase integration

If Firebase is configured, the app uses Firebase Authentication, Firestore for inventory, menu items, purchase orders, and recipe persistence, and Cloudinary for menu item images.

### Cloudinary image uploads

- Set `VITE_CLOUDINARY_CLOUD_NAME=dpfynnzbw`
- Set `VITE_CLOUDINARY_UPLOAD_PRESET` to your unsigned upload preset
- Optionally set `VITE_CLOUDINARY_FOLDER` to organize uploaded item images

If Firebase is not configured, the application falls back to demo mode for local testing only.

## PWA support

The app includes:

- `/manifest.json`
- `/service-worker.js`
- installable PWA support
- offline page and asset caching
- `public/logo.jpeg` as the PWA icon asset

## Build and deploy

- Build for production:
  ```bash
  npm run build
  ```
- Preview the production build:
  ```bash
  npm run preview
  ```
- Deploy the frontend to Vercel or any static host.
- Configure Firebase and Cloudinary environment variables if using Firebase services and image uploads.

## GitHub and Vercel

The repository includes a basic GitHub Actions workflow at `.github/workflows/ci.yml` to validate the build on push and pull requests.

For automatic Vercel deployment:

1. Connect the GitHub repository to Vercel.
2. Add the same environment variables in the Vercel dashboard.
3. Use the default build command `npm run build`.
4. The included `vercel.json` file supports single-page app routing.

## Push to GitHub

1. Create a new repository on GitHub (for example `loavashihubcafe`).
2. In the project root, initialize git (if not already), add files and push:

```bash
git init
git add .
git commit -m "Initial commit - wire Firestore and Cloudinary"
git remote add origin https://github.com/loavashihub-spec/loavashihubcafe.git
git push -u origin main
```

3. Connect the repository to Vercel for automatic deployments on push, and add the required environment variables in the Vercel dashboard.
