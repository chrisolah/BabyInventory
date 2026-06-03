import { useNavigate, useLocation } from 'react-router-dom'
import styles from './BottomNav.module.css'

// BottomNav — persistent tab bar across all 5 main authed screens.
// Tabs: Home, Inventory, Plan, Guides, Pass Along.
// Active state derived from current pathname so deep-link navigation
// (e.g. /inventory/slot/… or /pass-along/:id) correctly highlights
// the parent tab.
export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const tabs = [
    {
      id: 'home',
      label: 'Home',
      path: '/home',
      active: pathname === '/home',
      icon: (
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
          <path
            d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 18V13h5v5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      id: 'inventory',
      label: 'Inventory',
      path: '/inventory',
      active:
        pathname.startsWith('/inventory') ||
        pathname.startsWith('/item/') ||
        pathname.startsWith('/add-item'),
      icon: (
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ),
    },
    {
      id: 'plan',
      label: 'Plan',
      path: '/plan',
      active: pathname.startsWith('/plan'),
      icon: (
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
          <path
            d="M4 5h12M4 10h8M4 15h10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="15.5" cy="14.5" r="3" stroke="currentColor" strokeWidth="1.3" />
          <path d="M14 14.5l1 1 1.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'guides',
      label: 'Guides',
      path: '/guides',
      active: pathname.startsWith('/guides'),
      icon: (
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
          <path
            d="M4 4h12v13H4z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M7 8h6M7 11h4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      id: 'pass-along',
      label: 'Pass Along',
      path: '/pass-along',
      active: pathname.startsWith('/pass-along'),
      icon: (
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
          <path
            d="M3 7l7-4 7 4v8l-7 4-7-4V7z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M3 7l7 4 7-4M10 11v6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ]

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`${styles.tab} ${tab.active ? styles.tabActive : ''}`}
          onClick={() => navigate(tab.path)}
          aria-label={tab.label}
          aria-current={tab.active ? 'page' : undefined}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
