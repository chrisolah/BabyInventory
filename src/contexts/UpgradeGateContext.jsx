import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import UpgradeAccountModal from '../components/UpgradeAccountModal'

// UpgradeGateContext exposes `requireRealAccount(action)` to gate writes
// behind a permanent account. While the user is in trial mode (Supabase
// is_anonymous=true), the gate intercepts the action, opens the upgrade
// modal, and replays the action once the user has converted. Once the
// user is permanent, the gate is a no-op and runs the action inline.
//
// Promise semantics:
//   • Not anonymous → returns action() directly. Caller awaits as normal.
//   • Anonymous → returns a promise that resolves with action()'s result
//     after a successful upgrade, or rejects with { cancelled: true } if
//     the user dismisses the modal.
//
// Usage:
//   const { requireRealAccount } = useUpgradeGate()
//   try {
//     await requireRealAccount(async () => {
//       await supabase.from('clothing_items').insert(...)
//       navigate('/inventory')
//     })
//   } catch (e) {
//     if (e?.cancelled) return  // user dismissed; leave UI as-is
//     setError(e.message)
//   }
const UpgradeGateContext = createContext(null)

const CANCELLED_ERROR = { cancelled: true }

export function UpgradeGateProvider({ children }) {
  const { isAnonymous } = useAuth()
  // Holds the currently-pending action plus its promise resolvers. The
  // ref-shadow keeps the latest version available to the modal callbacks
  // without a state-synchronization round-trip on every render.
  const [pending, setPending] = useState(null)
  const pendingRef = useRef(null)
  pendingRef.current = pending

  // skipGate: true → run action directly even for anonymous users (used to
  // allow free saves until the trial item threshold is reached).
  const requireRealAccount = useCallback(
    async (action, { skipGate = false } = {}) => {
      if (!isAnonymous || skipGate) {
        return action()
      }
      return new Promise((resolve, reject) => {
        setPending({ action, resolve, reject })
      })
    },
    [isAnonymous],
  )

  // Open the upgrade modal directly without queuing a deferred action.
  // Used by the persistent TrialBanner so anonymous users can convert
  // proactively without first attempting a save. No-op when the user is
  // already permanent.
  const triggerUpgrade = useCallback(() => {
    if (!isAnonymous) return
    setPending({
      action: async () => {},
      resolve: () => {},
      reject: () => {},
    })
  }, [isAnonymous])

  async function handleUpgradeSuccess() {
    const current = pendingRef.current
    if (!current) return
    setPending(null)
    try {
      const result = await current.action()
      current.resolve(result)
    } catch (e) {
      current.reject(e)
    }
  }

  function handleDismiss() {
    const current = pendingRef.current
    if (!current) return
    setPending(null)
    current.reject(CANCELLED_ERROR)
  }

  return (
    <UpgradeGateContext.Provider value={{ requireRealAccount, triggerUpgrade }}>
      {children}
      {pending && (
        <UpgradeAccountModal
          onSuccess={handleUpgradeSuccess}
          onDismiss={handleDismiss}
        />
      )}
    </UpgradeGateContext.Provider>
  )
}

export function useUpgradeGate() {
  const ctx = useContext(UpgradeGateContext)
  if (!ctx) {
    throw new Error('useUpgradeGate must be used inside UpgradeGateProvider')
  }
  return ctx
}
