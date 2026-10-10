import { useAppStore } from '../../stores/appStore'
import { POS_SHORTCUTS } from '../../lib/posShortcuts'
import { X, Keyboard } from 'lucide-react'

// F1 overlay listing every POS shortcut. Renders the same POS_SHORTCUTS
// array the keydown resolver uses, so the help can never drift from the
// actual bindings.
export default function ShortcutsHelp({ onClose }) {
  const t = useAppStore((s) => s.t)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pos.shortcutHelp') || 'Keyboard shortcuts'}
        className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Keyboard className="w-5 h-5 text-accent" />
            {t('pos.shortcutHelp') || 'Keyboard shortcuts'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close') || 'Close'}
            className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="space-y-2">
          {POS_SHORTCUTS.map((shortcut) => (
            <li key={shortcut.id} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-foreground">{t(shortcut.labelKey) || shortcut.labelKey}</span>
              {/* Keys are physical (left-to-right) even on the Arabic UI */}
              <span dir="ltr" className="flex items-center gap-1 shrink-0">
                {shortcut.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="px-2 py-1 rounded-md border border-border bg-surface-secondary text-xs font-bold font-mono text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-muted">
          {t('pos.shortcutHelpNote') ||
            'Shortcuts work while the barcode field is focused — scanners never trigger them.'}
        </p>
      </div>
    </div>
  )
}
