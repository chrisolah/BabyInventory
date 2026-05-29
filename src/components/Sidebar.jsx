import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Sidebar.module.css'

const NAV_TABS = [
  {
    id: 'home',
    label: 'Home',
    path: '/home',
    match: (p) => p === '/home',
    icon: (
      <svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden="true">
        <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M7.5 18V13h5v5"
          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'inventory',
    label: 'Inventory',
    path: '/inventory',
    match: (p) => p.startsWith('/inventory') || p.startsWith('/item/') || p.startsWith('/add-item'),
    icon: (
      <svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden="true">
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
    match: (p) => p.startsWith('/plan'),
    icon: (
      <svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden="true">
        <path d="M4 5h12M4 10h8M4 15h10"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="15.5" cy="14.5" r="3" stroke="currentColor" strokeWidth="1.3" />
        <path d="M14 14.5l1 1 1.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'pass-along',
    label: 'Pass Along',
    path: '/pass-along',
    match: (p) => p.startsWith('/pass-along'),
    icon: (
      <svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden="true">
        <path d="M3 7l7-4 7 4v8l-7 4-7-4V7z"
          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M3 7l7 4 7-4M10 11v6"
          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <button
        type="button"
        className={styles.logo}
        onClick={() => navigate('/home')}
        aria-label="Sprigloop home"
      >
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
          <path
            d="M10 16 Q10 10 6 8 Q4 7 3 8 Q4 5 8 6 Q10 6.5 10 10"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
          <path
            d="M10 16 Q10 10 14 8 Q16 7 17 8 Q16 5 12 6 Q10 6.5 10 10"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
          <line x1="10" y1="10" x2="10" y2="17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      <div className={styles.navItems}>
        {NAV_TABS.map(tab => {
          const active = tab.match(pathname)
          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.navTab} ${active ? styles.navTabActive : ''}`}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
