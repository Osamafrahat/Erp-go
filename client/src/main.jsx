import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSentry, Sentry } from './lib/sentry'

initSentry()

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
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
