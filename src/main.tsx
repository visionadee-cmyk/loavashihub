import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Global defensive handlers to surface and ignore unexpected errors
// Protect against third-party content scripts or malformed messages causing uncaught exceptions
window.addEventListener('error', (ev) => {
  console.error('Global error caught:', ev.message || ev.error || ev);
});

window.addEventListener('unhandledrejection', (ev) => {
  // Log detailed information to help locate the original failing promise
  try {
    // Prevent default browser/Vite logging so we only log once here
    try {
      ev.preventDefault();
    } catch (e) {
      // ignore if preventDefault is not available
    }

    const reason = ev && (ev as any).reason;
    if (!reason) {
      console.error('Unhandled promise rejection: <no reason provided>', ev);
    } else if (reason instanceof Error) {
      console.error('Unhandled promise rejection (Error):', reason.message);
      if (reason.stack) console.error('Stack:', reason.stack);
    } else {
      // Try to stringify structured reasons safely
      try {
        console.error('Unhandled promise rejection (value):', JSON.stringify(reason));
      } catch (_err) {
        console.error('Unhandled promise rejection (unserializable):', reason);
      }
    }
  } catch (err) {
    console.error('Error while logging unhandledrejection:', err);
  }
});

// Filter incoming postMessage events that are not objects to avoid other scripts causing runtime errors
window.addEventListener('message', (ev) => {
  try {
    const data = ev?.data;
    // ignore non-object messages (extensions sometimes send strings)
    if (!data || typeof data !== 'object') return;

    // Basic sanitization: only forward messages that have an expected shape.
    // If your app uses a `type` or `query` property, we only re-dispatch safe messages.
    const safe: Record<string, any> = {};
    if (typeof data.type === 'string') safe.type = data.type;
    if (data.query && typeof data.query === 'object') safe.query = data.query;
    if (data.payload && typeof data.payload === 'object') safe.payload = data.payload;

    // If nothing looks usable, ignore the message to avoid downstream errors.
    if (Object.keys(safe).length === 0) return;

    // Re-dispatch a sanitized event for app listeners to consume safely.
    window.dispatchEvent(new CustomEvent('app:safe-message', { detail: safe }));
  } catch (err) {
    console.warn('Error while processing incoming message:', err);
  }
});

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        new URL('/service-worker.js', import.meta.url),
        { scope: '/' }
      );
      // Log more details to help debug SW lifecycle and state on clients
      console.log('✅ Service Worker registered successfully:', registration);
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        console.log('Current SW registration (getRegistration):', reg);
      } catch (e) {
        console.warn('Failed to get SW registration via getRegistration:', e);
      }
      
      
      // Check for updates periodically (catch errors to avoid unhandled rejections)
      setInterval(() => {
        registration.update().catch((err) => console.warn('Service Worker update failed:', err));
      }, 60000); // Check every minute
      
        // Notify app when a new update is available
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent('sw-update-available', { detail: { registration } }));
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('sw-update-available', { detail: { registration } }));
            }
          });
        });
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  });

  // Handle service worker updates
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 Service Worker controller changed - app updated');
    // Reload to activate the new service worker and updated content
    window.location.reload();
  });
}
