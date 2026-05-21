import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('/service-worker.js', import.meta.url))
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}
