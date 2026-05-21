# Changelog

All notable changes to the Loavashi Hub application.

## 2026-05-21

- Added automatic inventory restock when purchase orders are marked as `Received`.
- Connected the purchase workflow with shared inventory state via `InventoryContext`.
- Updated PWA manifest and service worker to use `public/logo.jpeg` as an application icon.
- Updated app `index.html` and service worker cache list for proper PWA icon and offline support.
- Added documentation and deployment guidance for README, changelog, and user manual.
- Added `firebase.json` and `firestore.rules` to support Firebase deploy and Firestore security rules.
- Added GitHub-to-Vercel auto-deploy workflow documentation.
