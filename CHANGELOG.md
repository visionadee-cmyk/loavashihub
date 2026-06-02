# Changelog

All notable changes to the Loavashi Hub application.

## 2026-06-02

- Added POS Reports page export and print support for Excel, PDF, and in-browser printing.
- Fixed Reports Dashboard custom report builder so date range and selected metrics correctly filter report display.

## 2026-06-01

- Added salary expense support to map `Salary` expense entries to staff names in `StaffManagement`.
- Auto-filled `Purchased from Cash Drawer` from same-day direct purchases in `DailyDirectRevenuePage`, with manual override.
- Added manual/auto daily salary field in `DailyDirectRevenuePage` and persisted it to direct revenue records.
- Included drawer purchase and salary expense totals in daily report expense calculations and WhatsApp report summaries.

## 2026-05-21

- Added automatic inventory restock when purchase orders are marked as `Received`.
- Connected the purchase workflow with shared inventory state via `InventoryContext`.
- Added automatic invoice numbers for POS bills and improved receipt printing with app/cafe details.
- Added bill save and pay/complete actions in POS, including completed bill tracking.
- Updated PWA manifest and service worker to use `public/logo.jpeg` as an application icon.
- Updated app `index.html` and service worker cache list for proper PWA icon and offline support.
- Added documentation and deployment guidance for README, changelog, and user manual.
- Added `firebase.json` and `firestore.rules` to support Firebase deploy and Firestore security rules.
- Added GitHub-to-Vercel auto-deploy workflow documentation.
