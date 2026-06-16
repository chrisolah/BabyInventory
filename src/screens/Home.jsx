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
import { getCategorySummary } from '../lib/categories'
import IvySprig from '../components/IvySprig'
import BabySwitcher from '../components/BabySwitcher'
import HeaderActions from '../components/HeaderActions'
import DonutChart from '../components/DonutChart'
import BottomNav from '../components/BottomNav'
import ShareRegistryModal from '../components/ShareWishlistModal'
import styles from './Home.module.css'

// Category hub configuration — all 8 categories are now live with real
// coverage data from wardrobe.js (clothing) and categories.js (everything else).
const CATEGORIES = [
  { id: 'clothing',  label: 'Clothing',  icon: ClothingIcon, color: 'teal',   passAlong: true },
  { id: 'sleep',     label: 'Sleep',     icon: SleepIcon,    color: 'blue'   },
  { id: 'feeding',   label: 'Feeding',   icon: FeedingIcon,  color: 'amber'  },
  { id: 'diapering', label: 'Diapering', icon: DiaperIcon,   color: 'gray'   },
  { id: 'travel',    label: 'Travel',    icon: TravelIcon,   color: 'purple' },
  { id: 'play',      label: 'Play',      icon: PlayIcon,     color: 'coral'  },
  { id: 'health',    label: 'Health',    icon: HealthIcon,   color: 'red'    },
  { id: 'bath',      label: 'Bath',      icon: BathIcon,     color: 'green'  },
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
  const [status, setStatus] = useState('checking')
  const [showShareModal, setShowShareModal] = useState(false)
  const [showAllRecent, setShowAllRecent] = useState(false)
  // One-time registry prompt: show once per household after setup
  const [showRegistryPrompt, setShowRegistryPrompt] = useState(() => {
    try { return !localStorage.getItem('sl_registry_prompt_dismissed') } catch { return false }
  })

  function dismissRegistryPrompt() {
    try { localStorage.setItem('sl_registry_prompt_dismissed', '1') } catch {}
    setShowRegistryPrompt(false)
  }

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

  // Clothing-only owned items — used for clothing coverage math.
  const clothingItems = useMemo(
    () => items.filter(i => i.top_category === 'clothing' && i.inventory_status === 'owned'),
    [items],
  )

  // All owned items across every category — drives the "items tracked" stat.
  const totalOwnedCount = useMemo(
    () => items.filter(i => i.inventory_status === 'owned').length,
    [items],
  )

  const outgrownCount = useMemo(
    () => items.filter(i =>
      i.inventory_status === 'outgrown' ||
      i.inventory_status === 'kept' ||
      i.inventory_status === 'pass_along'
    ).length,
    [items],
  )

  const registryCount = useMemo(
    () => items.filter(i => i.inventory_status === 'gap').length,
    [items],
  )

  // Recently added — items already arrive sorted by created_at DESC from
  // HouseholdContext. We include all tracked statuses (owned, outgrown,
  // tucked_away, kept, pass_along) so the user sees what they just scanned
  // regardless of what they tagged it as. Registry gaps excluded — those
  // weren't "added" by the user.
  const recentItemsAll = useMemo(
    () => items.filter(i => i.inventory_status !== 'gap').slice(0, 24),
    [items],
  )
  const recentItems = showAllRecent ? recentItemsAll : recentItemsAll.slice(0, 8)

  // Coverage for each of the 7 non-clothing categories.
  const catCoverages = useMemo(() => {
    const cats = ['sleep', 'feeding', 'diapering', 'travel', 'play', 'health', 'bath']
    const result = {}
    for (const cat of cats) {
      result[cat] = getCategorySummary(
        items.filter(i => i.top_category === cat),
        cat,
      )
    }
    return result
  }, [items])

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

  // Overall coverage — aggregate clothing (current range) + all non-clothing.
  // Must be declared AFTER currentRangeCoverage to avoid temporal dead zone.
  const overallCoverage = useMemo(() => {
    const cBase = currentRangeCoverage ?? { owned: 0, recommended: 0 }
    let owned = cBase.owned
    let recommended = cBase.recommended
    const cats = ['sleep', 'feeding', 'diapering', 'travel', 'play', 'health', 'bath']
    for (const cat of cats) {
      const cov = getCategorySummary(items.filter(i => i.top_category === cat), cat)
      owned += cov.owned
      recommended += cov.recommended
    }
    return { owned, recommended: Math.max(recommended, 1) }
  }, [currentRangeCoverage, items])

  if (status === 'checking') return <div className={styles.page} />

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Sprigloop</div>
        <div className={styles.sprigCenter}>
          <IvySprig />
        </div>
        <div className={styles.headerActions}>
          <HeaderActions />
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

        {/* Overall tracker card */}
        {!itemsLoading && (
          <OverallTrackerCard
            pct={Math.min(100, Math.round((overallCoverage.owned / overallCoverage.recommended) * 100))}
            owned={overallCoverage.owned}
            recommended={overallCoverage.recommended}
            range={ageInfo.currentRange}
            ageInfo={ageInfo}
            babyName={ageAnchor?.name ?? null}
            navigate={navigate}
          />
        )}

        {/* Category grid */}
        <div className={styles.grid}>
          {CATEGORIES.map(cat => {
            if (cat.id === 'clothing') {
              const covForPct = currentRangeCoverage ?? clothingCoverage
              const pct = Math.round((covForPct.owned / Math.max(covForPct.recommended, 1)) * 100)
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`${styles.card} ${styles.cardTeal}`}
                  onClick={() => navigate('/inventory?category=clothing')}
                  aria-label="Clothing"
                >
                  <div className={styles.cardTop}>
                    <div className={`${styles.iconWrap} ${styles.iconTeal}`}>
                      <cat.icon />
                    </div>
                    <span className={styles.cardLabel}>Clothing</span>
                  </div>
                  <div className={styles.passAlongBadge}>Pass Along</div>
                  <div className={styles.cardBottom}>
                    <p className={styles.cardMeta}>
                      {itemsLoading
                        ? 'Loading…'
                        : currentRangeCoverage
                          ? `${currentRangeCoverage.range}: ${currentRangeCoverage.owned} of ${currentRangeCoverage.recommended}`
                          : `${clothingCoverage.owned} of ${clothingCoverage.recommended} items`
                      }
                    </p>
                    {!itemsLoading && (
                      <DonutChart
                        size={52}
                        strokeWidth={5}
                        pct={Math.min(100, pct)}
                        color="var(--teal)"
                        trackColor="rgba(0,0,0,0.1)"
                        textColor="var(--teal-dark)"
                      />
                    )}
                  </div>
                </button>
              )
            }

            // Non-clothing cards with real coverage data
            const cov = catCoverages[cat.id] || { owned: 0, recommended: 1 }
            const catPct = Math.round((cov.owned / cov.recommended) * 100)
            return (
              <button
                key={cat.id}
                type="button"
                className={`${styles.card} ${styles[`card_${cat.color}`] || styles.cardGray}`}
                onClick={() => navigate(`/inventory?category=${cat.id}`)}
                aria-label={cat.label}
              >
                <div className={styles.cardTop}>
                  <div className={`${styles.iconWrap} ${styles[`icon_${cat.color}`] || styles.iconGray}`}>
                    <cat.icon />
                  </div>
                  <span className={styles.cardLabel}>{cat.label}</span>
                </div>
                <div className={styles.cardBottom}>
                  <p className={styles.cardMeta}>
                    {itemsLoading ? 'Loading…' : `${cov.owned} of ${cov.recommended} items`}
                  </p>
                  {!itemsLoading && (
                    <DonutChart
                      size={52}
                      strokeWidth={5}
                      pct={Math.min(100, catPct)}
                      color="var(--teal)"
                      trackColor="rgba(0,0,0,0.1)"
                      textColor="var(--teal-dark)"
                    />
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {/* Stat cards */}
        {/* One-time registry share prompt — shown once, dismissed permanently */}
        {showRegistryPrompt && !itemsLoading && totalOwnedCount > 0 && (
          <div className={styles.wishlistPrompt}>
            <div className={styles.wishlistPromptIcon}>🔗</div>
            <div className={styles.wishlistPromptBody}>
              <div className={styles.wishlistPromptTitle}>Share your registry with family and friends</div>
              <div className={styles.wishlistPromptSub}>They&rsquo;ll see exactly what you still need — no guessing, no duplicates.</div>
            </div>
            <div className={styles.wishlistPromptActions}>
              <button
                type="button"
                className={styles.wishlistPromptBtn}
                onClick={() => { dismissRegistryPrompt(); setShowShareModal(true); track.ctaClicked('home_registry_prompt_share') }}
              >
                Share
              </button>
              <button type="button" className={styles.wishlistPromptDismiss} onClick={dismissRegistryPrompt} aria-label="Dismiss">×</button>
            </div>
          </div>
        )}

        {/* Registry two-card row */}
        <div className={styles.wishlistCardRow}>
          <button
            type="button"
            className={styles.wishlistActionCard}
            onClick={() => { navigate('/registry/edit'); track.ctaClicked('home_edit_registry') }}
          >
            <div className={styles.wishlistActionTitle}>Edit registry</div>
            <div className={styles.wishlistActionSub}>Smart registry built from what you own</div>
          </button>
          <button
            type="button"
            className={`${styles.wishlistActionCard} ${styles.wishlistActionCardShare}`}
            onClick={() => { setShowShareModal(true); track.ctaClicked('home_share_registry_card') }}
          >
            <div className={styles.wishlistActionTitle}>Share registry</div>
            <div className={styles.wishlistActionSub}>Knows what you have. Shows what you need.</div>
          </button>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{itemsLoading ? '—' : totalOwnedCount}</div>
            <div className={styles.statLabel}>items tracked</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{itemsLoading ? '—' : registryCount}</div>
            <div className={styles.statLabel}>on registry</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{itemsLoading ? '—' : outgrownCount}</div>
            <div className={styles.statLabel}>outgrown</div>
          </div>
        </div>

        {/* Recently Added strip */}
        {!itemsLoading && recentItemsAll.length > 0 && (
          <div className={styles.recentSection}>
            <div className={styles.recentHeader}>
              <span className={styles.recentTitle}>Recently Added</span>
              <button
                type="button"
                className={styles.recentViewAll}
                onClick={() => navigate('/inventory?sort=recent')}
              >
                View all
              </button>
            </div>
            <div className={styles.recentGrid}>
              {recentItems.map(item => (
                <RecentItem key={item.id} item={item} navigate={navigate} />
              ))}
            </div>
            {recentItemsAll.length > 8 && (
              <button
                type="button"
                className={styles.recentMoreBtn}
                onClick={() => setShowAllRecent(v => !v)}
              >
                {showAllRecent
                  ? 'Show less'
                  : `Show ${recentItemsAll.length - 8} more`}
              </button>
            )}
          </div>
        )}
      </main>

      <BottomNav />
      {showShareModal && <ShareRegistryModal onClose={() => setShowShareModal(false)} />}

    </div>
  )
}

// ── Overall tracker card ──────────────────────────────────────────────────
function OverallTrackerCard({ pct, owned, recommended, range, ageInfo, babyName, navigate }) {
  // Build the countdown line based on ageInfo state.
  let countdown = null
  if (ageInfo?.expecting && ageInfo.daysUntilDue != null) {
    const days = Math.ceil(ageInfo.daysUntilDue)
    if (days > 0) {
      const who = babyName ? `${babyName} arrives` : 'Baby arrives'
      countdown = { text: `${who} in ${days} day${days === 1 ? '' : 's'}`, type: 'due' }
    }
  } else if (ageInfo?.nextRange && ageInfo.daysToNextRange != null) {
    const days = Math.ceil(ageInfo.daysToNextRange)
    if (days > 0) {
      const who = babyName ? `${babyName} moves to` : 'Next size'
      countdown = { text: `${who} ${ageInfo.nextRange} in ${days} day${days === 1 ? '' : 's'}`, type: 'size' }
    }
  }

  const isExpecting = ageInfo?.expecting && ageInfo.daysUntilDue != null && Math.ceil(ageInfo.daysUntilDue) > 0
  const hasSizeUp = !isExpecting && ageInfo?.nextRange && ageInfo.daysToNextRange != null

  const Tag = (isExpecting || hasSizeUp) ? 'button' : 'div'
  const tagProps = isExpecting
    ? { type: 'button', className: `${styles.trackerCard} ${styles.trackerCardClickable}`, onClick: () => navigate('/arrival-checklist') }
    : hasSizeUp
    ? { type: 'button', className: `${styles.trackerCard} ${styles.trackerCardClickable}`, onClick: () => navigate(`/plan?size=${encodeURIComponent(ageInfo.nextRange)}`) }
    : { className: styles.trackerCard }

  return (
    <Tag {...tagProps}>
      <div className={styles.trackerTop}>
        <div className={styles.trackerLeft}>
          <div className={styles.trackerPct}>{pct}%</div>
          <div className={styles.trackerTitle}>Overall readiness</div>
          <div className={styles.trackerSub}>
            {owned} of {recommended} items{range ? ` · ${range}` : ''}
          </div>
        </div>
        <div className={styles.trackerRight}>
          <DonutChart
            size={88}
            strokeWidth={9}
            pct={pct}
            color="rgba(255,255,255,0.9)"
            trackColor="rgba(255,255,255,0.18)"
            textColor="#fff"
          />
        </div>
      </div>
      {countdown && (
        <div className={styles.trackerCountdown}>
          <CountdownIcon type={countdown.type} />
          <span>{countdown.text}</span>
          {(countdown.type === 'due' || countdown.type === 'size') && <span className={styles.trackerCountdownArrow}>→</span>}
        </div>
      )}
    </Tag>
  )
}

function CountdownIcon({ type }) {
  if (type === 'due') {
    // Calendar icon
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="1.5" y="3" width="13" height="11.5" rx="2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" />
        <path d="M5 1.5V4M11 1.5V4" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M1.5 6.5H14.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" />
        <circle cx="5.5" cy="10" r="0.9" fill="rgba(255,255,255,0.7)" />
        <circle cx="8" cy="10" r="0.9" fill="rgba(255,255,255,0.7)" />
        <circle cx="10.5" cy="10" r="0.9" fill="rgba(255,255,255,0.7)" />
      </svg>
    )
  }
  // Ruler/size icon
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="1" y="5.5" width="14" height="5" rx="1.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" />
      <path d="M4 5.5V7.5M7 5.5V8.5M10 5.5V7.5M13 5.5V8.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── Recently Added grid card ──────────────────────────────────────────────
const CATEGORY_DISPLAY = {
  clothing: 'Clothing', sleep: 'Sleep', feeding: 'Feeding',
  diapering: 'Diapering', travel: 'Travel', play: 'Play',
  health: 'Health', bath: 'Bath',
}

function buildRecentDisplay(item) {
  const rawType = item.item_type || null
  const slotLabel = rawType ? rawType.replace(/_/g, ' ') : null

  let primary, primarySource
  if (item.name) { primary = item.name; primarySource = 'name' }
  else if (item.brand) { primary = item.brand; primarySource = 'brand' }
  else if (slotLabel) { primary = slotLabel; primarySource = 'slot' }
  else { primary = CATEGORY_DISPLAY[item.top_category] || 'Item'; primarySource = 'fallback' }

  const metaParts = []
  if (primarySource !== 'brand' && item.brand) metaParts.push(item.brand)
  if (primarySource !== 'slot' && slotLabel) metaParts.push(slotLabel)

  return { primary, meta: metaParts.join(' · ') }
}

function RecentItem({ item, navigate }) {
  const photoUrl = item.garment_signed_url || item.item_photo_signed_url
  const sizeLabel = item.size_label || null
  const { primary, meta } = buildRecentDisplay(item)

  return (
    <button
      type="button"
      className={styles.recentCard}
      onClick={() => navigate(`/item/${item.id}`)}
      aria-label={`Open ${primary}`}
    >
      <div className={styles.recentCardPhotoWrap} aria-hidden="true">
        {photoUrl ? (
          <>
            <img src={photoUrl} alt="" className={styles.recentCardPhoto} loading="lazy" />
            {sizeLabel && <span className={styles.recentCardSizeBadge}>{sizeLabel}</span>}
          </>
        ) : (
          <div className={styles.recentCardPlaceholder}>
            <span className={styles.recentCardSizeCentered}>{sizeLabel || '—'}</span>
          </div>
        )}
      </div>
      <div className={styles.recentCardBody}>
        <div className={styles.recentCardName}>{primary}</div>
        {meta && <div className={styles.recentCardMeta}>{meta}</div>}
      </div>
    </button>
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
