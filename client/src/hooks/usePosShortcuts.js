import { useEffect, useRef } from 'react'
import { resolvePosShortcut } from '../lib/posShortcuts'

// Single window keydown listener for the whole POS page. The action table
// and live state are read through refs synced on every render, so the
// listener never acts on stale closures (same idiom PaymentModal already
// uses for its Enter shortcut).
//
// actions:  { escape, help, focusBarcode, ... } — one fn per resolver id
// getState: () => ({ modalOpen }) — live gating context
export default function usePosShortcuts(actions, getState) {
  const actionsRef = useRef(actions)
  const getStateRef = useRef(getState)

  useEffect(() => {
    actionsRef.current = actions
    getStateRef.current = getState
  })

  useEffect(() => {
    const onKeyDown = (e) => {
      const action = resolvePosShortcut(e, getStateRef.current ? getStateRef.current() : {})
      if (!action) return
      const fn = actionsRef.current[action]
      if (typeof fn !== 'function') return
      e.preventDefault()
      fn()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
