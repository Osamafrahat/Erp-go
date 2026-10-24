import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSentry, Sentry } from './lib/sentry'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { registerSW } from 'virtual:pwa-register'

initSentry()

// PWA registration with a rejection handler. vite-plugin-pwa's default
// injected script calls register() bare, so any rejection escaped as an
// unhandled rejection and became Sentry issues (ERP-GO-CLIENT-2 "Error:
// Rejected" via extension-wrapped calls, -4 "The Service Worker system has
// shutdown" via transient browser states). Neither is an app bug and
// neither is fixable here — the offline shell is an enhancement, so it
// fails quietly. Importing this virtual module also stops the plugin's
// bare injection; autoUpdate semantics are unchanged.
registerSW({
  onRegisterError(error) {
    console.warn('[PWA] Service worker registration failed (non-fatal):', error)
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      showDialog={false}
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
<p className="text-sm text-muted mb-4">The page failed to render.</p>
            <button
              onClick={() => window.location.reload()}
className="px-4 py-2 bg-surface-secondary text-white rounded-lg text-sm"
            >
              Reload
            </button>
          </div>
        </div>
      }
    >
      <App />
      <Analytics />
      <SpeedInsights />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
