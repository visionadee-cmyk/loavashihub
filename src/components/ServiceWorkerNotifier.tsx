import { useEffect, useState } from 'react';

export default function ServiceWorkerNotifier() {
  const [available, setAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      setRegistration(e.detail?.registration ?? null);
      setAvailable(true);
    };

    window.addEventListener('sw-update-available', handler as EventListener);

    return () => {
      window.removeEventListener('sw-update-available', handler as EventListener);
    };
  }, []);

  const applyUpdate = async () => {
    if (!registration) return;
    const waiting = registration.waiting;
    if (!waiting) return;

    waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!available) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-2xl rounded-3xl border border-amber-700 bg-amber-900/80 p-4 text-white shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Update available</p>
          <p className="text-xs text-amber-100">A new version is ready. Refresh to apply the update.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setAvailable(false); }}
            className="rounded-2xl border border-amber-700 bg-amber-800/30 px-3 py-2 text-sm"
          >
            Dismiss
          </button>
          <button
            onClick={applyUpdate}
            className="rounded-2xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
