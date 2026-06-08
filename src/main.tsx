import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Global defensive handlers to surface and ignore unexpected errors
// Protect against third-party content scripts or malformed messages causing uncaught exceptions
window.addEventListener('error', (ev) => {
  console.warn('Global error caught:', ev.message || ev.error || ev);
});

window.addEventListener('unhandledrejection', (ev) => {
  console.warn('Unhandled promise rejection:', ev.reason);
});

// Filter incoming postMessage events that are not objects to avoid other scripts causing runtime errors
window.addEventListener('message', (ev) => {
  try {
    const data = ev?.data;
    if (!data || typeof data !== 'object') {
      // ignore non-object messages (extensions sometimes send strings)
      return;
    }
    // If your app expects specific message shapes, add checks here, e.g.:
    // if (!('type' in data)) return;
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
      console.log('✅ Service Worker registered successfully:', registration);
      
      // Check for updates periodically
      setInterval(() => {
        registration.update();
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
