import { useState, useEffect } from 'react';
import CameraCapture from './components/CameraCapture.jsx';
import ImageUpload from './components/ImageUpload.jsx';
import Results from './components/Results.jsx';
import PWAInstallPrompt from './components/PWAInstallPrompt.jsx';
import { getDetectionStatus } from './services/api.js';

export default function App() {
  const [view, setView] = useState('scan');
  const [scanMode, setScanMode] = useState('camera');
  const [detectionMode, setDetectionMode] = useState('standard');
  const [highAccuracyAvailable, setHighAccuracyAvailable] = useState(false);
  const [result, setResult] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [showOfflineToast, setShowOfflineToast] = useState(false);

  // Check if high accuracy mode is available
  useEffect(() => {
    getDetectionStatus()
      .then((status) => {
        setHighAccuracyAvailable(status.highAccuracyAvailable);
      })
      .catch(() => {
        setHighAccuracyAvailable(false);
      });
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle PWA update events
  useEffect(() => {
    const handleUpdateAvailable = () => {
      setShowUpdatePrompt(true);
    };
    
    const handleOfflineReady = () => {
      setShowOfflineToast(true);
      setTimeout(() => setShowOfflineToast(false), 4000);
    };
    
    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    window.addEventListener('pwa-offline-ready', handleOfflineReady);
    
    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
      window.removeEventListener('pwa-offline-ready', handleOfflineReady);
    };
  }, []);

  const handlePWAUpdate = () => {
    if (window.__PWA_UPDATE__) {
      window.__PWA_UPDATE__();
    }
    setShowUpdatePrompt(false);
  };

  const handleDetectionComplete = (payload) => {
    setResult(payload);
    setView('results');
  };

  const showScan = () => setView('scan');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <nav className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur border-b border-slate-900/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-eco-aqua">
              EcoVision
            </p>
            <p className="text-lg font-semibold tracking-tight">
              Waste Detection Studio
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`nav-pill ${view === 'scan' ? 'nav-pill--active' : ''}`}
              onClick={showScan}
            >
              Scan
            </button>
            <button
              type="button"
              className={`nav-pill ${view === 'results' ? 'nav-pill--active' : ''}`}
              onClick={() => result && setView('results')}
              disabled={!result}
            >
              Results
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        {view === 'scan' && (
          <>
            {/* Input Mode Toggle (Camera/Upload) */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-full border border-slate-800 bg-slate-900/50 p-1">
                <button
                  type="button"
                  onClick={() => setScanMode('camera')}
                  className={`
                    flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all
                    ${scanMode === 'camera'
                      ? 'bg-eco-aqua/20 text-eco-aqua shadow-lg shadow-eco-aqua/10'
                      : 'text-slate-400 hover:text-slate-200'
                    }
                  `}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Camera
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('upload')}
                  className={`
                    flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all
                    ${scanMode === 'upload'
                      ? 'bg-eco-aqua/20 text-eco-aqua shadow-lg shadow-eco-aqua/10'
                      : 'text-slate-400 hover:text-slate-200'
                    }
                  `}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload
                </button>
              </div>
            </div>

            {/* Detection Mode Toggle (Standard/High Accuracy) */}
            <div className="flex justify-center">
              <div className="inline-flex flex-col items-center gap-2">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Detection Mode</p>
                <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900/50 p-1">
                  <button
                    type="button"
                    onClick={() => setDetectionMode('standard')}
                    className={`
                      flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
                      ${detectionMode === 'standard'
                        ? 'bg-gradient-to-r from-emerald-600/30 to-teal-600/30 text-emerald-400 shadow-lg shadow-emerald-500/10 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                      }
                    `}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Standard</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-60">Fast</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetectionMode('high-accuracy')}
                    disabled={!highAccuracyAvailable}
                    title={highAccuracyAvailable ? 'GPT-4 Vision powered analysis' : 'OpenAI API key not configured'}
                    className={`
                      flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
                      ${!highAccuracyAvailable 
                        ? 'opacity-40 cursor-not-allowed text-slate-500'
                        : detectionMode === 'high-accuracy'
                          ? 'bg-gradient-to-r from-violet-600/30 to-purple-600/30 text-violet-400 shadow-lg shadow-violet-500/10 border border-violet-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }
                    `}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>High Accuracy</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-60">AI</span>
                  </button>
                </div>
                {detectionMode === 'high-accuracy' && highAccuracyAvailable && (
                  <p className="text-xs text-violet-400/80 flex items-center gap-1.5">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Uses GPT-4 Vision for detailed reduce, reuse & recycle tips
                  </p>
                )}
                {!highAccuracyAvailable && (
                  <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    High Accuracy requires OpenAI API key in backend
                  </p>
                )}
              </div>
            </div>

            {/* Scan Content */}
            {scanMode === 'camera' && (
              <CameraCapture onDetection={handleDetectionComplete} detectionMode={detectionMode} />
            )}
            {scanMode === 'upload' && (
              <ImageUpload onDetection={handleDetectionComplete} detectionMode={detectionMode} />
            )}
          </>
        )}
        {view === 'results' && (
          <Results data={result} onBack={showScan} />
        )}
      </section>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* PWA Update Prompt */}
      {showUpdatePrompt && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down md:left-auto md:right-4 md:w-96">
          <div className="rounded-2xl border border-eco-aqua/30 bg-slate-900/95 backdrop-blur-lg p-4 shadow-2xl shadow-eco-aqua/10">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 p-3">
                <svg className="h-6 w-6 text-eco-aqua" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">Update Available</h3>
                <p className="mt-1 text-xs text-slate-400">A new version is ready. Refresh to update.</p>
                <button
                  onClick={handlePWAUpdate}
                  className="mt-3 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Refresh Now
                </button>
              </div>
              <button
                onClick={() => setShowUpdatePrompt(false)}
                className="flex-shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Indicator */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur-sm py-2 px-4 text-center">
          <p className="text-xs font-medium text-amber-950 flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
            </svg>
            You're offline. Some features may be unavailable.
          </p>
        </div>
      )}

      {/* Offline Ready Toast */}
      {showOfflineToast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up md:left-auto md:right-4 md:w-80">
          <div className="rounded-xl border border-emerald-500/30 bg-slate-900/95 backdrop-blur-lg px-4 py-3 shadow-xl">
            <p className="text-sm text-emerald-400 flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              App ready for offline use!
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

