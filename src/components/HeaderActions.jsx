// HeaderActions — unified ⋮ actions menu for every authed screen header.
//
// Replaces ProfileMenu everywhere and consolidates all top-right header
// actions into one consistent entry point:
//
//   + Add item         → /add-item
//   🔗 Share wishlist  → opens ShareWishlistModal
//   👋 Invite someone  → opens InviteMemberModal
//   👤 Profile         → /profile
//   ── divider ──
//   Sign out
//
// Same 36×36 footprint as ProfileMenu so existing header grids need no
// layout changes. Outside-click and Escape key dismiss, same as ProfileMenu.

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ShareWishlistModal from './ShareWishlistModal'
import InviteMemberModal from './InviteMemberModal'
import styles from './HeaderActions.module.css'

export default function HeaderActions() {
  const [open, setOpen]         = useState(false)
  const [showShare, setShowShare]   = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const rootRef = useRef(null)
  const navigate = useNavigate()
  const { signOut } = useAuth()

  useEffect(() => {
    if (!open) return
    function handlePointer(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
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

  function close() { setOpen(false) }

  async function handleSignOut() {
    close()
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <>
      <div className={styles.root} ref={rootRef}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setOpen(v => !v)}
          aria-label="Actions"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <DotsIcon />
        </button>

        {open && (
          <div className={styles.menu} role="menu">
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => { navigate('/add-item'); close() }}
            >
              <PlusIcon />
              Add item
            </button>

            {/* Share wishlist — styled as the featured action */}
            <button
              type="button"
              role="menuitem"
              className={`${styles.item} ${styles.itemShare}`}
              onClick={() => { setShowShare(true); close() }}
            >
              <ShareIcon />
              Share wishlist
            </button>

            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => { setShowInvite(true); close() }}
            >
              <InviteIcon />
              Invite someone
            </button>

            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => { navigate('/profile'); close() }}
            >
              <PersonIcon />
              Profile
            </button>

            <div className={styles.divider} role="separator" aria-hidden="true" />

            <button
              type="button"
              role="menuitem"
              className={`${styles.item} ${styles.itemSignOut}`}
              onClick={handleSignOut}
            >
              <SignOutIcon />
              Sign out
            </button>
          </div>
        )}
      </div>

      {showShare  && <ShareWishlistModal  onClose={() => setShowShare(false)}  />}
      {showInvite && <InviteMemberModal from="header_actions" onClose={() => setShowInvite(false)} />}
    </>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DotsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="3"  r="1.25" />
      <circle cx="8" cy="8"  r="1.25" />
      <circle cx="8" cy="13" r="1.25" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="12" cy="4"  r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4"  cy="8"  r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.7 7.1l4.6-2.2M5.7 8.9l4.6 2.2"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function InviteIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 12a4.5 4.5 0 018.5-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 8v4M9 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="8" cy="6" r="2.75" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.75 13.25a5.25 5.25 0 0110.5 0"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M9.5 3H5a2 2 0 00-2 2v6a2 2 0 002 2h4.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 8h6M11.5 5.5L14 8l-2.5 2.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
