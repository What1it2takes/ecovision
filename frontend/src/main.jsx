import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

// Create a custom event to communicate with React components
const pwaUpdateEvent = new CustomEvent('pwa-update-available');
const pwaOfflineEvent = new CustomEvent('pwa-offline-ready');

// Register service worker for PWA functionality
const updateSW = registerSW({
  onNeedRefresh() {
    // Dispatch event to show update UI
    window.dispatchEvent(pwaUpdateEvent);
    // Store update function globally for the component to access
    window.__PWA_UPDATE__ = () => updateSW(true);
  },
  onOfflineReady() {
    console.log('🎉 App ready to work offline!');
    window.dispatchEvent(pwaOfflineEvent);
  },
  onRegistered(registration) {
    console.log('✅ Service Worker registered successfully');
    // Check for updates periodically (every hour)
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('❌ Service Worker registration error:', error);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);







