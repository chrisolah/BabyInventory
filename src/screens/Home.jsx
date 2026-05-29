import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import {
  computeCoverage,
  inferAgeRange,
  AGE_RANGES,
} from '../lib/wardrobe'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import BabySwitcher from '../components/BabySwitcher'
import InviteMemberModal from '../components/InviteMemberModal'
import BottomNav from '../components/BottomNav'
import styles from './Home.module.css'

// Category hub configuration — defines the 8 category cards shown on the
// home screen. Clothing is the only "live" category with real DB data;
// the others show placeholder state until their inventory tables are built.
const CATEGORIES = [
  {
    id: 'clothing',
    label: 'Clothing',
    icon: ClothingIcon,
    color: 'teal',
    passAlong: true,
    totalItems: 64, // target from taxonomy
  },
  {
    id: 'sleep',
    label: 'Sleep',
    icon: SleepIcon,
    color: 'blue',
    totalItems: 12,
  },
  {
    id: 'feeding',
    label: 'Feeding',
    icon: FeedingIcon,
    color: 'amber',
    totalItems: 22,
  },
  {
    id: 'diapering',
    label: 'Diapering',
    icon: DiaperIcon,
    color: 'gray',
    totalItems: 10,
  },
  {
    id: 'travel',
    label: 'Travel',
    icon: TravelIcon,
    color: 'purple',
    totalItems: 9,
  },
  {
    id: 'play',
    label: 'Play',
    icon: PlayIcon,
    color: 'coral',
    totalItems: 14,
  },
  {
    id: 'health',
    label: 'Health',
    icon: HealthIcon,
    color: 'red',
    totalItems: 11,
  },
  {
    id: 'bath',
    label: 'Bath',
    icon: BathIcon,
    color: 'green',
    totalItems: 8,
  },
]

// Home is the main hub screen. Shows a category grid with per-category
// readiness — clothing uses live wardrobe data, other categories show
// placeholder state until their tracking tables are built.
//
// Unlike the old Home, this screen does NOT redirect to /inventory when
// items exist. The Category Hub IS the home screen regardless of inventory
// state. Onboarding redirect is preserved (step < 5 → /onboarding).
export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    household,
    babies,
    currentBaby,
    items,
    itemsLoading,
  } = useHousehold()
  const [showInvite, setShowInvite] = useState(false)
  const [status, setStatus] = useState('checking')

  const firstName = user?.user_metadata?.name?.split(' ')[0] ?? ''

  // Onboarding gate — redirect to /onboarding if setup is incomplete.
  // Invite-joiners (role='member') skip the step check entirely.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function check() {
      const { data: memberRow, error: memberErr } = await supabase
        .schema(currentSchema)
        .from('household_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'member')
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (!memberErr && memberRow) {
        setStatus('ready')
        return
      }

      const { data, error } = await supabase
        .schema(currentSchema)
        .from('user_activity_summary')
        .select('onboarding_step')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.warn('Onboarding gate failed —', error.message)
        setStatus('ready')
        return
      }

      const step = data?.onboarding_step ?? 0
      if (step < 5) {
        navigate('/onboarding', { replace: true })
        return
      }

      setStatus('ready')
    }

    check()
    return () => { cancelled = true }
  }, [user, navigate])

  // Clothing coverage — computed across all age ranges for the current baby.
  // Shows total owned vs total recommended across the whole wardrobe.
  const ageAnchor = currentBaby ?? babies[0] ?? null
  const ageInfo = useMemo(() => inferAgeRange(ageAnchor), [ageAnchor])
  const activeRange = ageInfo.currentRange || AGE_RANGES[0]

  const clothingItems = useMemo(
    () => items.filter(i => i.inventory_status === 'owned'),
    [items],
  )

  // Aggregate coverage across all age ranges for the overall count
  const clothingCoverage = useMemo(() => {
    if (!clothingItems.length && !itemsLoading) return { owned: 0, recommended: 64 }
    let owned = 0
    let recommended = 0
    for (const range of AGE_RANGES) {
      const rows = computeCoverage(clothingItems, range, 1)
      for (const row of rows) {
        owned += Math.min(row.ownedCount, row.recommended)
        recommended += row.recommended
      }
    }
    return { owned, recommended: Math.max(recommended, 1) }
  }, [clothingItems, itemsLoading])

  // Current-range coverage for the clothing card subtitle
  const currentRangeCoverage = useMemo(() => {
    if (!activeRange) return null
    const rows = computeCoverage(clothingItems, activeRange, 1)
    let owned = 0; let recommended = 0
    for (const row of rows) {
      owned += Math.min(row.ownedCount, row.recommended)
      recommended += row.recommended
    }
    return { owned, recommended, range: activeRange }
  }, [clothingItems, activeRange])

  function openInvite() {
    track.householdInviteOpened('home_header')
    setShowInvite(true)
  }

  if (status === 'checking') return <div className={styles.page} />

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <div className={styles.brand}>Sprigloop</div>
          <IvySprig />
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.inviteBtn}
            onClick={openInvite}
            aria-label="Invite household member"
          >
            <svg className={styles.inviteIcon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Invite
          </button>
          <ProfileMenu />
        </div>
      </header>

      <BabySwitcher from="home" />

      <main className={styles.body}>
        {/* Greeting */}
        <div className={styles.greetingRow}>
          <h1 className={styles.greeting}>
            {firstName ? `Hi, ${firstName}` : 'Welcome'}
          </h1>
          <p className={styles.sub}>
            {ageAnchor?.name
              ? `${ageAnchor.name}'s readiness at a glance.`
              : 'Your household readiness at a glance.'}
          </p>
        </div>

        {/* Category grid */}
        <div className={styles.grid}>
          {CATEGORIES.map(cat => {
            if (cat.id === 'clothing') {
              const pct = Math.round((clothingCoverage.owned / clothingCoverage.recommended) * 100)
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`${styles.card} ${styles.cardTeal}`}
                  onClick={() => navigate('/inventory')}
                  aria-label="Clothing"
                >
                  <div className={styles.cardTop}>
                    <div className={`${styles.iconWrap} ${styles.iconTeal}`}>
                      <cat.icon />
                    </div>
                    <span className={styles.cardLabel}>Clothing</span>
                  </div>
                  <div className={styles.passAlongBadge}>Pass Along</div>
                  <p className={styles.cardMeta}>
                    {itemsLoading
                      ? 'Loading…'
                      : currentRangeCoverage
                        ? `${currentRangeCoverage.range}: ${currentRangeCoverage.owned} of ${currentRangeCoverage.recommended}`
                        : `${clothingCoverage.owned} of ${clothingCoverage.recommended} items`
                    }
                  </p>
                  <div className={styles.progressTrack}>
                    <div
                      className={`${styles.progressFill} ${styles.progressTeal}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </button>
              )
            }

            // Placeholder cards for categories not yet tracked
            return (
              <button
                key={cat.id}
                type="button"
                className={`${styles.card} ${styles[`card_${cat.color}`] || styles.cardGray}`}
                onClick={() => navigate('/plan')}
                aria-label={cat.label}
              >
                <div className={styles.cardTop}>
                  <div className={`${styles.iconWrap} ${styles[`icon_${cat.color}`] || styles.iconGray}`}>
                    <cat.icon />
                  </div>
                  <span className={styles.cardLabel}>{cat.label}</span>
                </div>
                <p className={styles.cardMeta} style={{ color: 'var(--gray-400)' }}>
                  0 of {cat.totalItems} items
                </p>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: '0%' }} />
                </div>
              </button>
            )
          })}
        </div>
      </main>

      <BottomNav />

      {showInvite && (
        <InviteMemberModal from="home_header" onClose={() => setShowInvite(false)} />
      )}
    </div>
  )
}

// ── Category icons (inline SVG) ───────────────────────────────────────────
function ClothingIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M7 2L4 5l2.5 1.5V17h7V6.5L16 5l-3-3-2 2-2-2z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
function SleepIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 10.5A7.5 7.5 0 0013.5 3a7.5 7.5 0 100 15A7.5 7.5 0 003 10.5z"
        stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
function FeedingIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M8 2v3a4 4 0 004 4v9a1 1 0 01-2 0v-5H8v5a1 1 0 01-2 0V2h2z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
function DiaperIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 9h16" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}
function TravelIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M2 14h16M5 14V9l5-4 5 4v5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="6" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="14" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}
function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 7.5l5 2.5-5 2.5V7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
function HealthIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M10 17S3 12.5 3 7.5A4 4 0 0110 5a4 4 0 017 2.5C17 12.5 10 17 10 17z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
function BathIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 11h14v1.5a5 5 0 01-10 0" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 11V5.5A1.5 1.5 0 017.5 5a1.5 1.5 0 011.5 1.5V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
