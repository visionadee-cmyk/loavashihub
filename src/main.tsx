import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

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
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  });

  // Handle service worker updates
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 Service Worker controller changed - app updated');
  });
}
