import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './ProfileMenu.module.css'

// Shared header control — icon button that opens a small dropdown with
// Profile + Sign out. Drops into the top-right of every authed screen in
// place of the old LogoutButton. Same 36×36 footprint so the existing
// header grids (1fr auto 1fr on Inventory/SlotDetail/AddItem/ItemDetail)
// don't need any layout changes.
//
// Onboarding still uses LogoutButton directly — the Profile page assumes a
// household exists, so surfacing it before onboarding completes would just
// confuse the user. Once onboarding is done, every screen with a header
// uses ProfileMenu instead.

export default function ProfileMenu() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  // Close on outside click + Escape key. We listen on the whole document so
  // a tap anywhere else in the app dismisses the menu — parents often swipe
  // through these screens quickly and a clingy menu is annoying.
  useEffect(() => {
    if (!open) return
    function handlePointer(e) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function handleProfile() {
    setOpen(false)
    navigate('/profile')
  }

  async function handleSignOut() {
    setOpen(false)
    // Flip auth state first, then navigate. The AuthProvider would eventually
    // redirect us, but doing it imperatively avoids flashing a protected
    // page while PublicRoute catches up.
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={styles.btn}
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Profile menu"
      >
        {/* Silhouette avatar. Stroke-only so it inherits currentColor and
            picks up the same teal-dark-on-hover treatment as the other
            round header buttons. */}
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
          <circle cx="8" cy="6" r="2.75" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M2.75 13.25a5.25 5.25 0 0 1 10.5 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={handleProfile}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
              <circle cx="8" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M3 13a5 5 0 0 1 10 0"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            Profile
          </button>
          <div className={styles.divider} aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={handleSignOut}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
              <path
                d="M9.5 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7.5 8h6M11.5 5.5 14 8l-2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
