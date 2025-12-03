import { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show banner after a short delay
      setTimeout(() => setShowBanner(true), 2000);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    // Show the install prompt
    installPrompt.prompt();
    
    // Wait for user response
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setShowBanner(false);
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-banner-dismissed', 'true');
  };

  // Don't show if already installed, dismissed, or no prompt available
  if (isInstalled || !showBanner || !installPrompt) {
    return null;
  }

  // Check if dismissed this session
  if (sessionStorage.getItem('pwa-banner-dismissed')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up md:left-auto md:right-4 md:w-96">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-lg p-4 shadow-2xl shadow-eco-aqua/10">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 p-3">
            <svg className="h-8 w-8 text-eco-aqua" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
            </svg>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">
              Install EcoVision
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Add to your home screen for quick access and offline support
            </p>
            
            {/* Buttons */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300"
              >
                Later
              </button>
            </div>
          </div>
          
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

