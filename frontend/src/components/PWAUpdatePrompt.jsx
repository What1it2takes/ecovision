import { useState, useEffect } from 'react';

export default function PWAUpdatePrompt({ onUpdate }) {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    // This component is controlled by the service worker update callback
    // The onUpdate prop will be called from main.jsx when an update is available
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down md:left-auto md:right-4 md:w-96">
      <div className="rounded-2xl border border-eco-aqua/30 bg-slate-900/95 backdrop-blur-lg p-4 shadow-2xl shadow-eco-aqua/10">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 p-3">
            <svg className="h-6 w-6 text-eco-aqua" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">
              Update Available
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              A new version of EcoVision is ready. Refresh to update.
            </p>
            
            {/* Button */}
            <button
              onClick={onUpdate}
              className="mt-3 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              Refresh Now
            </button>
          </div>
          
          {/* Dismiss */}
          <button
            onClick={() => setShowUpdate(false)}
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


