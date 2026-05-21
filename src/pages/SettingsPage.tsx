import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument } from '../lib/firestore';
import type { AppSettings } from '../types';

const defaultSettings: AppSettings = {
  id: 'default',
  restaurantName: 'Loavashi Hub Cafe',
  currency: 'MVR',
  taxRate: 5,
  receiptFooter: 'Thank you for visiting Loavashi Hub. Please visit again!',
  supportEmail: 'support@loavashihub.com',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      return;
    }

    loadCollection<AppSettings>('settings', [])
      .then((items) => {
        if (items.length) {
          setSettings(items[0]);
        }
      })
      .catch((error) => console.error('Failed to load settings from Firestore:', error));
  }, []);

  const saveSettings = async () => {
    if (!hasFirebaseConfig) {
      return;
    }

    try {
      await saveDocument('settings', settings.id, settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Application settings</h3>
            <p className="text-sm text-slate-400">Configure restaurant name, currency, tax and receipt footer text.</p>
          </div>
          <button
            type="button"
            onClick={saveSettings}
            className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          >
            <Save className="h-4 w-4" /> Save settings
          </button>
        </div>

        <div className="grid gap-5">
          <label className="block text-sm text-slate-300">
            Restaurant name
            <input
              value={settings.restaurantName}
              onChange={(event) => setSettings((current) => ({ ...current, restaurantName: event.target.value }))}
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Currency
            <input
              value={settings.currency}
              onChange={(event) => setSettings((current) => ({ ...current, currency: event.target.value }))}
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Tax rate (%)
            <input
              type="number"
              min={0}
              value={settings.taxRate}
              onChange={(event) => setSettings((current) => ({ ...current, taxRate: Number(event.target.value) }))}
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Receipt footer
            <textarea
              value={settings.receiptFooter}
              onChange={(event) => setSettings((current) => ({ ...current, receiptFooter: event.target.value }))}
              className="mt-2 h-28 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Support email
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(event) => setSettings((current) => ({ ...current, supportEmail: event.target.value }))}
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
            />
          </label>
        </div>
      </div>
    </AppShell>
  );
}
