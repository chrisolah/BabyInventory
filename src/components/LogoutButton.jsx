import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './LogoutButton.module.css'

// Shared logout control — icon-only circular button designed to drop into
// the top-right of any logged-in page's header. Matches the 36×36 pill-
// button footprint used by the back/add buttons elsewhere so the three
// headers stay visually aligned.
//
// Flow: sign out of Supabase, then navigate to the landing page. The
// AuthProvider's onAuthStateChange listener would eventually clear the
// user too, but we do it imperatively here so the redirect doesn't flash
// a protected page before PublicRoute kicks in.
export default function LogoutButton() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleClick() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={styles.btn}
      aria-label="Log out"
      title="Log out"
    >
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
        {/* Door frame — opens to the right */}
        <path
          d="M9.5 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Arrow exiting the frame */}
        <path
          d="M7.5 8h6M11.5 5.5 14 8l-2.5 2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
