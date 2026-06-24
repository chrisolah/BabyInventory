// Public registry recipient page. No auth required.
// Route: /registry/:token
//
// Loads via the get_wishlist_for_share security-definer RPC (anon-callable).
// Claims submitted via claim_wishlist_item RPC — also anon-callable.
//
// Data shape from RPC:
//   share:    { token, message, target_date, show_priority, skip_categories, included_categories }
//   household: { name }
//   babies:   [{ name, due_date, date_of_birth }]
//   clothing: [{ id, slot_id, category, size_label, is_priority, baby_id, owned_count }]
//   items:    [{ id, slot_id, top_category, sub_category, is_priority, owned_count }]
//   claims:   [{ slot_id, slot_type, size_label, claimer_name, quantity, claimed_at }]

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { SLOTS, AGE_RANGES, recommendedQty } from '../lib/wardrobe'
import { ITEMS, CATEGORY_META, CONSUMABLE_SLOT_IDS } from '../lib/categories'
import { getWishlistProduct } from '../lib/wishlistProducts'
import styles from './WishlistPublic.module.css'

// ── Category icons + nav (matches RegistryEdit) ───────────────────────────────
function ClothingIcon() { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M2 6l4-2 4 2 4-2 4 2v10H2V6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg> }
function SleepIcon()    { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M3 10a7 7 0 0012.6-4.2A7 7 0 003 10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg> }
function FeedingIcon()  { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M8 3v3a2 2 0 002 2h0a2 2 0 002-2V3M10 8v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function DiaperIcon()   { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><rect x="2" y="5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M2 10h16" stroke="currentColor" strokeWidth="1.4"/></svg> }
function TravelIcon()   { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><rect x="3" y="8" width="14" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M7 8V6a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.4"/></svg> }
function PlayIcon()     { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7l5 3-5 3V7z" fill="currentColor"/></svg> }
function HealthIcon()   { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function BathIcon()     { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M3 11h14v2a5 5 0 01-14 0v-2z" stroke="currentColor" strokeWidth="1.4"/><path d="M5 11V7a2 2 0 014 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function PriorityIcon() { return <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L10 14.4l-4.8 2.4.9-5.3L2.2 7.7l5.4-.8L10 2z"/></svg> }

const WISHLIST_CATS = [
  { id: 'priority',  label: 'Priority',  icon: PriorityIcon,  color: 'amber'  },
  { id: 'clothing',  label: 'Clothing',  icon: ClothingIcon,  color: 'purple' },
  { id: 'sleep',     label: 'Sleep',     icon: SleepIcon,     color: 'blue'   },
  { id: 'feeding',   label: 'Feeding',   icon: FeedingIcon,   color: 'amber'  },
  { id: 'diapering', label: 'Diapering', icon: DiaperIcon,    color: 'gray'   },
  { id: 'travel',    label: 'Travel',    icon: TravelIcon,    color: 'purple' },
  { id: 'play',      label: 'Play',      icon: PlayIcon,      color: 'coral'  },
  { id: 'health',    label: 'Health',    icon: HealthIcon,    color: 'red'    },
  { id: 'bath',      label: 'Bath',      icon: BathIcon,      color: 'green'  },
]

// Build slot label lookup maps once
const CLOTHING_SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]))
const ITEM_SLOT     = Object.fromEntries(ITEMS.map(i => [i.id, i]))

function claimKey(slotType, slotId, sizeLabel) {
  return `${slotType}:${slotId}:${sizeLabel || ''}`
}

export default function WishlistPublic() {
  const { token } = useParams()
  const [pageData, setPageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [claims, setClaims] = useState([])
  // { slotId, slotType, sizeLabel, label, maxQty } — null = sheet closed
  const [claimTarget, setClaimTarget] = useState(null)
  const [selectedCat, setSelectedCat] = useState('priority')
  const [giftInfoDismissed, setGiftInfoDismissed] = useState(false)
  const [skipBannerDismissed, setSkipBannerDismissed] = useState(false)
  const [selectedSize, setSelectedSize] = useState(null)

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .schema(currentSchema)
      .rpc('get_wishlist_for_share', { p_token: token })
    setLoading(false)
    if (error || data?.error) { setNotFound(true); return }
    setPageData(data)
    setClaims(data.claims || [])
  }

  // Build quantity-overrides map: "slot_id:size_label" → desired_qty
  const qtyOverridesMap = useMemo(() => {
    const map = {}
    for (const o of (pageData?.quantity_overrides || [])) {
      map[`${o.slot_id}:${o.size_label || ''}`] = o.desired_qty
    }
    return map
  }, [pageData])

  // Build a map: claimKey → { total, claimers[] }
  const claimsMap = useMemo(() => {
    const map = {}
    for (const c of claims) {
      const k = claimKey(c.slot_type, c.slot_id, c.size_label)
      if (!map[k]) map[k] = { total: 0, claimers: [] }
      map[k].total += c.quantity
      map[k].claimers.push({ name: c.claimer_name, qty: c.quantity })
    }
    return map
  }, [claims])

  async function submitClaim(claimerName, quantity) {
    const target = claimTarget
    const { data, error } = await supabase
      .schema(currentSchema)
      .rpc('claim_wishlist_item', {
        p_token:        token,
        p_slot_id:      target.slotId,
        p_slot_type:    target.slotType,
        p_size_label:   target.sizeLabel || null,
        p_claimer_name: claimerName.trim(),
        p_quantity:     quantity,
      })
    if (error || data?.error) {
      return { ok: false, error: data?.error || 'Something went wrong. Try again.' }
    }
    const fresh = (data.claims || []).map(c => ({
      slot_id: target.slotId,
      slot_type: target.slotType,
      size_label: target.sizeLabel || null,
      claimer_name: c.claimer_name,
      quantity: c.quantity,
      claimed_at: c.claimed_at,
    }))
    setClaims(prev => {
      const filtered = prev.filter(c =>
        claimKey(c.slot_type, c.slot_id, c.size_label) !==
        claimKey(target.slotType, target.slotId, target.sizeLabel)
      )
      return [...filtered, ...fresh]
    })
    return { ok: true }
  }

  async function submitUnclaim(claimerName, quantity) {
    const target = claimTarget
    await supabase
      .schema(currentSchema)
      .rpc('unclaim_wishlist_item', {
        p_token:        token,
        p_slot_id:      target.slotId,
        p_slot_type:    target.slotType,
        p_size_label:   target.sizeLabel || null,
        p_claimer_name: claimerName,
      })
    // Remove the claim from local state regardless of RPC result
    setClaims(prev => prev.filter(c =>
      !(c.slot_id === target.slotId &&
        c.slot_type === target.slotType &&
        (c.size_label || '') === (target.sizeLabel || '') &&
        c.claimer_name === claimerName)
    ))
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <SprigMark size={36} />
        <div className={styles.spinner} aria-label="Loading" />
      </div>
    )
  }

  if (notFound || !pageData) {
    return (
      <div className={styles.notFound}>
        <SprigMark size={48} />
        <h1 className={styles.notFoundTitle}>This registry isn&rsquo;t available</h1>
        <p className={styles.notFoundSub}>
          The link may have expired or been deactivated by the family.
        </p>
        <a href="https://sprigloop.com" className={styles.notFoundLink}>Learn about Sprigloop</a>
      </div>
    )
  }

  const { share, household, babies, clothing, items } = pageData
  // Filter out 'clothing' — it was a legacy skip_category before slot/size filtering existed
  const skipCats    = new Set((share.skip_categories || []).filter(c => c !== 'clothing'))
  const skipSizes   = share.skip_sizes || []
  const skipSlots   = share.skip_slots || []
  const showPriority = share.show_priority !== false

  return (
    <div className={styles.page}>
      {/* ── Header / hero ────────────────────────────────────── */}
      <header className={styles.hero}>
        <div className={styles.heroTopbar}>
          <a href="https://sprigloop.com" className={styles.heroBrand}>
            <SprigMark size={20} />
            <span className={styles.heroBrandName}>Sprigloop</span>
          </a>
        </div>
        <div className={styles.heroBody}>
          <div className={styles.heroEyebrow}>Baby Registry</div>
          <h1 className={styles.heroTitle}>
            {household?.name ? `${household.name}'s Registry` : 'Baby Registry'}
          </h1>
          <div className={styles.heroMeta}>
            {babies?.map((b, i) => (
              <span key={i} className={styles.babyPill}>{b.name}</span>
            ))}
            {babies?.length > 0 && share.target_date && (
              <div className={styles.heroDot} aria-hidden="true" />
            )}
            {share.target_date && (
              <span className={styles.targetDate}>{formatDate(share.target_date)}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Message from the family ───────────────────────────── */}
      {share.message && (
        <div className={styles.messageCard}>
          <span className={styles.messageQuote}>&ldquo;</span>
          <p className={styles.messageText}>{share.message}</p>
        </div>
      )}

      {/* ── Skip notice ───────────────────────────────────────── */}
      {!skipBannerDismissed && (skipCats.size > 0 || skipSizes.length > 0 || skipSlots.length > 0) && (
        <div className={styles.skipBanner}>
          <span aria-hidden="true">🙏</span>
          <div className={styles.skipBannerBody}>
            {skipCats.size > 0 && (
              <div>
                <strong>Well stocked on:</strong>{' '}
                {[...skipCats].map(c => CAT_LABEL[c] || c).join(', ')} — no gifts needed here!
              </div>
            )}
            {skipSlots.length > 0 && (
              <div className={skipCats.size > 0 ? styles.skipLine : ''}>
                <strong>Not included by choice:</strong>{' '}
                {skipSlots.map(id => (CLOTHING_SLOT[id] || ITEM_SLOT[id])?.label || id.replace(/_/g, ' ')).join(', ')} — the parents have chosen not to include {skipSlots.length === 1 ? 'this' : 'these'} in their registry.
              </div>
            )}
            {skipSizes.length > 0 && (
              <div className={(skipCats.size > 0 || skipSlots.length > 0) ? styles.skipLine : ''}>
                <strong>Clothing sizes covered:</strong>{' '}
                {skipSizes.join(', ')} — these won&rsquo;t appear below.
              </div>
            )}
          </div>
          <button
            className={styles.skipBannerClose}
            onClick={() => setSkipBannerDismissed(true)}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      {/* ── Category chip nav ─────────────────────────────────── */}
      <div className={styles.catRow}>
        <div className={styles.catRowInner}>
          {WISHLIST_CATS.map(cat => {
            // compute badge count
            let count = 0
            if (cat.id === 'priority') {
              count = [...(clothing||[]), ...(items||[])].filter(r => r.is_priority).length
            } else if (cat.id === 'clothing') {
              count = (clothing||[]).filter(r => {
                const slot = CLOTHING_SLOT[r.slot_id]
                const rec = recommendedQty(slot, r.size_label)
                const k = claimKey('clothing', r.slot_id, r.size_label)
                return Math.max(0, rec - (r.owned_count||0) - (claimsMap[k]?.total||0)) > 0
              }).length
            } else {
              count = (items||[]).filter(r => {
                if (r.top_category !== cat.id) return false
                const slot = ITEM_SLOT[r.slot_id]
                const rec = slot?.recommended ?? 1
                const k = claimKey('item', r.slot_id, null)
                return Math.max(0, rec - (r.owned_count||0) - (claimsMap[k]?.total||0)) > 0
              }).length
            }
            const active = selectedCat === cat.id
            return (
              <button key={cat.id} type="button"
                className={`${styles.catChip} ${styles[`catChip_${cat.color}`]} ${active ? styles.catChipActive : ''}`}
                onClick={() => { setSelectedCat(cat.id); setSelectedSize(null) }}
                aria-pressed={active}
              >
                <div className={`${styles.catChipIcon} ${styles[`catChipIcon_${cat.color}`]}`}><cat.icon /></div>
                <span className={styles.catChipLabel}>{cat.label}</span>
                {count > 0 && <span className={styles.catChipBadge}>{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Size sub-nav for clothing ──────────────────────────── */}
      {selectedCat === 'clothing' && (() => {
        const availSizes = AGE_RANGES.filter(s => (clothing||[]).some(r => r.size_label === s))
        if (availSizes.length < 2) return null
        return (
          <div className={styles.sizeNav}>
            <div className={styles.sizeNavInner}>
              <button className={`${styles.sizeChipNav} ${!selectedSize ? styles.sizeChipNavActive : ''}`}
                onClick={() => setSelectedSize(null)}>All</button>
              {availSizes.map(size => (
                <button key={size}
                  className={`${styles.sizeChipNav} ${selectedSize === size ? styles.sizeChipNavActive : ''}`}
                  onClick={() => setSelectedSize(selectedSize === size ? null : size)}>{size}</button>
              ))}
            </div>
          </div>
        )
      })()}

      <div className={styles.body}>
        {/* ── Gift-giver info card ── */}
        {!giftInfoDismissed && (
          <div className={styles.infoCard}>
            <button className={styles.infoDismiss} onClick={() => setGiftInfoDismissed(true)} aria-label="Dismiss">×</button>
            <div className={styles.infoTitle}>This registry is a little different</div>
            <p className={styles.infoBody}>
              It&rsquo;s built from what {household?.name ? `the ${household.name}'s` : 'the family'}{' '}
              already own — so every item here is a real gap, not a guess.
              Quantities show exactly how many are still needed, and claiming an item
              coordinates with other gift-givers automatically.
            </p>
          </div>
        )}

        {/* ── Priority ── */}
        {selectedCat === 'priority' && (() => {
          const rows = [
            ...(clothing||[]).filter(r => r.is_priority).map(r => ({...r, _type:'clothing', topCategory:'clothing'})),
            ...(items||[]).filter(r => r.is_priority).map(r => ({...r, _type:'item'})),
          ]
          return rows.length === 0
            ? <div className={styles.emptyState}><div className={styles.emptyEmoji}>☆</div><p className={styles.emptyText}>No priority items yet.</p></div>
            : <div className={styles.cardGrid}>{rows.map(r => <SlotCard key={`${r._type}-${r.id}`} slotType={r._type} topCategory={r.topCategory || r.top_category} slotId={r.slot_id} sizeLabel={r.size_label||null} ownedCount={r.owned_count||0} claimsMap={claimsMap} qtyOverridesMap={qtyOverridesMap} isPriority onClaim={setClaimTarget} />)}</div>
        })()}

        {/* ── Clothing ── */}
        {selectedCat === 'clothing' && (() => {
          const filtered = (clothing||[]).filter(r => !selectedSize || r.size_label === selectedSize)
          const bySize = {}
          for (const r of filtered) {
            const s = r.size_label || 'No size'
            if (!bySize[s]) bySize[s] = []
            bySize[s].push(r)
          }
          const sizes = AGE_RANGES.filter(s => bySize[s]?.length > 0)
          if (sizes.length === 0) return <div className={styles.emptyState}><div className={styles.emptyEmoji}>👕</div><p className={styles.emptyText}>No clothing gaps.</p></div>
          return sizes.map(size => (
            <div key={size}>
              {!selectedSize && <div className={styles.sizeLabel}>{size}</div>}
              <div className={styles.cardGrid}>
                {bySize[size].map(r => <SlotCard key={r.id} slotType="clothing" topCategory="clothing" slotId={r.slot_id} sizeLabel={r.size_label} ownedCount={r.owned_count||0} claimsMap={claimsMap} qtyOverridesMap={qtyOverridesMap} isPriority={r.is_priority} onClaim={setClaimTarget} />)}
              </div>
            </div>
          ))
        })()}

        {/* ── Non-clothing categories ── */}
        {selectedCat !== 'priority' && selectedCat !== 'clothing' && (() => {
          const rows = (items||[]).filter(r => r.top_category === selectedCat)
          if (rows.length === 0) return <div className={styles.emptyState}><div className={styles.emptyEmoji}>🌱</div><p className={styles.emptyText}>No gaps in this category.</p></div>
          return <div className={styles.cardGrid}>{rows.map(r => <SlotCard key={r.id} slotType="item" topCategory={r.top_category} slotId={r.slot_id} sizeLabel={null} ownedCount={r.owned_count||0} claimsMap={claimsMap} qtyOverridesMap={qtyOverridesMap} isPriority={r.is_priority} onClaim={setClaimTarget} />)}</div>
        })()}
      </div>

      <footer className={styles.footer}>
        <a href="https://sprigloop.com" className={styles.footerBrand}>
          <SprigMark size={16} />
          <span className={styles.footerWordmark}>Sprigloop</span>
        </a>
        <nav className={styles.footerLinks}>
          <a href="https://sprigloop.com/about" className={styles.footerLink}>About</a>
          <a href="https://sprigloop.com/contact" className={styles.footerLink}>Contact</a>
          <a href="/privacy" className={styles.footerLink}>Privacy</a>
          <a href="/terms" className={styles.footerLink}>Terms</a>
        </nav>
        <span className={styles.footerCopy}>© 2026 Sprigloop</span>
      </footer>

      {claimTarget && (
        <ClaimSheet
          target={claimTarget}
          onSubmit={submitClaim}
          onUnclaim={submitUnclaim}
          onClose={() => setClaimTarget(null)}
        />
      )}
    </div>
  )
}

// ── Priority section ──────────────────────────────────────────────────────────

function PrioritySection({ clothing, items, claimsMap, onClaim }) {
  const [open, setOpen] = useState(false)
  const priorityClothing = (clothing || []).filter(r => r.is_priority)
  const priorityItems    = (items || []).filter(r => r.is_priority)
  const total = priorityClothing.length + priorityItems.length
  if (total === 0) return null

  const unclaimed = [...priorityClothing, ...priorityItems].filter(r => {
    const k = claimKey(
      priorityClothing.includes(r) ? 'clothing' : 'item',
      r.slot_id,
      r.size_label || null
    )
    const slot = priorityClothing.includes(r) ? CLOTHING_SLOT[r.slot_id] : ITEM_SLOT[r.slot_id]
    const rec  = priorityClothing.includes(r)
      ? recommendedQty(slot, r.size_label)
      : (slot?.recommended ?? 1)
    const claimed = claimsMap[k]?.total || 0
    return (r.owned_count || 0) + claimed < rec
  }).length

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={`${styles.sectionToggle} ${styles.sectionTogglePriority}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className={styles.sectionToggleLeft}>
          <span className={styles.priorityStar} aria-hidden="true">★</span>
          <span className={styles.sectionTitle}>Most needed</span>
          {unclaimed > 0 && (
            <span className={styles.badge}>{unclaimed} still needed</span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className={styles.cardGrid}>
          {priorityClothing.map(row => (
            <SlotCard
              key={`c-${row.id}`}
              slotType="clothing"
              topCategory="clothing"
              slotId={row.slot_id}
              sizeLabel={row.size_label}
              ownedCount={row.owned_count || 0}
              claimsMap={claimsMap}
              isPriority
              onClaim={onClaim}
            />
          ))}
          {priorityItems.map(row => (
            <SlotCard
              key={`i-${row.id}`}
              slotType="item"
              topCategory={row.top_category}
              slotId={row.slot_id}
              sizeLabel={null}
              ownedCount={row.owned_count || 0}
              claimsMap={claimsMap}
              isPriority
              onClaim={onClaim}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Clothing section ──────────────────────────────────────────────────────────

function ClothingSection({ clothing, claimsMap, onClaim }) {
  const bySize = {}
  for (const r of clothing) {
    if (!bySize[r.size_label]) bySize[r.size_label] = []
    bySize[r.size_label].push(r)
  }
  const sizes = AGE_RANGES.filter(s => bySize[s]?.length > 0)
  if (sizes.length === 0) return null

  return (
    <section className={styles.section}>
      <div className={styles.sectionStaticHead}>
        <h2 className={styles.sectionTitle}>Clothing</h2>
        <span className={styles.sectionHint}>Tap a size to expand</span>
      </div>
      {sizes.map(size => (
        <SizeGroup
          key={size}
          size={size}
          rows={bySize[size]}
          claimsMap={claimsMap}
          onClaim={onClaim}
        />
      ))}
    </section>
  )
}

function SizeGroup({ size, rows, claimsMap, onClaim }) {
  const [open, setOpen] = useState(false)

  const unclaimedCount = rows.filter(row => {
    const slot = CLOTHING_SLOT[row.slot_id]
    const rec  = recommendedQty(slot, row.size_label)
    const k    = claimKey('clothing', row.slot_id, row.size_label)
    return (row.owned_count || 0) + (claimsMap[k]?.total || 0) < rec
  }).length

  return (
    <div className={styles.sizeGroupCollapse}>
      <button
        type="button"
        className={styles.sectionToggle}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className={styles.sectionToggleLeft}>
          <span className={styles.sizeLabel}>{size}</span>
          {unclaimedCount > 0 && (
            <span className={styles.badge}>{unclaimedCount} needed</span>
          )}
          {unclaimedCount === 0 && (
            <span className={styles.badgeDone}>All covered</span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className={styles.cardGrid}>
          {rows.map(row => (
            <SlotCard
              key={row.id}
              slotType="clothing"
              topCategory="clothing"
              slotId={row.slot_id}
              sizeLabel={row.size_label}
              ownedCount={row.owned_count || 0}
              claimsMap={claimsMap}
              isPriority={row.is_priority}
              onClaim={onClaim}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Non-clothing section ──────────────────────────────────────────────────────

const NON_CLOTHING_ORDER = ['sleep', 'feeding', 'diapering', 'travel', 'play', 'health', 'bath']

function NonClothingSection({ items, claimsMap, onClaim }) {
  // Hide fully-covered non-consumable slots — gift-givers only need to see what's still needed.
  const visibleItems = items.filter(r => {
    const isConsumable = CONSUMABLE_SLOT_IDS.has(r.slot_id)
    if (isConsumable) return true
    const slot = ITEM_SLOT[r.slot_id]
    const rec  = slot?.recommended ?? 1
    const k    = claimKey('item', r.slot_id, null)
    const stillNeeded = Math.max(0, rec - (r.owned_count || 0) - (claimsMap[k]?.total || 0))
    return stillNeeded > 0
  })

  const byCat = {}
  for (const r of visibleItems) {
    if (!byCat[r.top_category]) byCat[r.top_category] = []
    byCat[r.top_category].push(r)
  }
  const cats = NON_CLOTHING_ORDER.filter(c => byCat[c]?.length > 0)
  if (cats.length === 0) return null

  return (
    <>
      {cats.map(cat => (
        <CategoryGroup
          key={cat}
          cat={cat}
          rows={byCat[cat]}
          claimsMap={claimsMap}
          onClaim={onClaim}
        />
      ))}
    </>
  )
}

function CategoryGroup({ cat, rows, claimsMap, onClaim }) {
  const [open, setOpen] = useState(false)

  const unclaimedCount = rows.filter(row => {
    const slot = ITEM_SLOT[row.slot_id]
    const rec  = slot?.recommended ?? 1
    const k    = claimKey('item', row.slot_id, null)
    return (row.owned_count || 0) + (claimsMap[k]?.total || 0) < rec
  }).length

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.sectionToggle}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className={styles.sectionToggleLeft}>
          <span className={styles.sectionTitle}>
            {CATEGORY_META[cat]?.label || cat}
          </span>
          {unclaimedCount > 0 && (
            <span className={styles.badge}>{unclaimedCount} needed</span>
          )}
          {unclaimedCount === 0 && (
            <span className={styles.badgeDone}>All covered</span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className={styles.cardGrid}>
          {rows.map(row => (
            <SlotCard
              key={row.id}
              slotType="item"
              topCategory={row.top_category || cat}
              slotId={row.slot_id}
              sizeLabel={null}
              ownedCount={row.owned_count || 0}
              claimsMap={claimsMap}
              isPriority={row.is_priority}
              onClaim={onClaim}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Slot card ─────────────────────────────────────────────────────────────────

const PUB_CAT_COLOR = {
  clothing: 'purple', sleep: 'blue', feeding: 'amber',
  diapering: 'gray', travel: 'purple', play: 'coral',
  health: 'red', bath: 'green',
}

function SlotCard({ slotType, topCategory, slotId, sizeLabel, ownedCount, claimsMap, qtyOverridesMap, isPriority, onClaim }) {
  const isClothing   = slotType === 'clothing'
  const isConsumable = !isClothing && CONSUMABLE_SLOT_IDS.has(slotId)
  const slot         = isClothing ? CLOTHING_SLOT[slotId] : ITEM_SLOT[slotId]
  const label        = slot?.label || slotId.replace(/_/g, ' ')
  const recommended  = isClothing
    ? recommendedQty(slot, sizeLabel)
    : (slot?.recommended ?? 1)
  const overrideKey  = `${slotId}:${sizeLabel || ''}`
  const desiredQty   = qtyOverridesMap?.[overrideKey] ?? recommended

  const claimData   = claimsMap[claimKey(slotType, slotId, sizeLabel)] || { total: 0, claimers: [] }
  const stillNeeded = isConsumable ? 1 : Math.max(0, desiredQty - ownedCount - claimData.total)
  const isCovered   = !isConsumable && stillNeeded === 0

  function handleClaim() {
    onClaim({
      slotId,
      slotType,
      sizeLabel: sizeLabel || null,
      label: sizeLabel ? `${label} · ${sizeLabel}` : label,
      maxQty: stillNeeded,
    })
  }

  const bandColor = topCategory ? (PUB_CAT_COLOR[topCategory] || 'gray') : (slotType === 'clothing' ? 'purple' : 'gray')

  return (
    <div className={`${styles.card} ${isCovered ? styles.cardCovered : ''}`}>
      <div className={`${styles.cardBand} ${styles[`band_${bandColor}`]}`} />
      <div className={styles.cardBody}>
      <div className={styles.cardTop}>
        <span className={styles.cardLabel}>{label}</span>
        {isPriority && !isCovered && (
          <span className={styles.cardStar} aria-label="Priority">★</span>
        )}
        {isCovered && (
          <span className={styles.cardCheck} aria-label="Covered">✓</span>
        )}
      </div>

      {isClothing && sizeLabel && (
        <span className={styles.cardSize}>{sizeLabel}</span>
      )}

      {isConsumable ? (
        <div className={styles.cardNeedConsumable}>Keep stocked</div>
      ) : !isCovered ? (
        <div className={styles.cardNeed}>Need {stillNeeded} more</div>
      ) : (
        <div className={styles.cardCoveredLabel}>Covered</div>
      )}

      {claimData.claimers.length > 0 && (
        <div className={styles.cardClaimers}>
          {claimData.claimers.map((c, i) => (
            <span key={i} className={styles.claimer}>
              {c.name}{c.qty > 1 ? ` ×${c.qty}` : ''}
            </span>
          ))}
        </div>
      )}

      {!isCovered && (
        <>
          <button type="button" className={styles.claimBtn} onClick={handleClaim}>
            Claim
          </button>
          {(() => {
            const product = getWishlistProduct(slotId)
            return product ? (
              <a
                href={product.url}
                className={styles.buyLink}
                target="_blank"
                rel="noopener noreferrer sponsored"
              >
                Sprigloop pick →
              </a>
            ) : null
          })()}
        </>
      )}
      </div>{/* cardBody */}
    </div>
  )
}

// ── Claim sheet ───────────────────────────────────────────────────────────────

function ClaimSheet({ target, onSubmit, onUnclaim, onClose }) {
  const [name, setName] = useState('')
  const [anon, setAnon] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [claimedName, setClaimedName] = useState('')

  const maxQty = target.maxQty || 1
  const canSubmit = anon || name.trim().length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const result = await onSubmit(anon ? 'Anonymous' : name.trim(), quantity)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error === 'share_not_found'
        ? 'This registry is no longer active.'
        : 'Something went wrong. Try again.')
      return
    }
    setClaimedName(anon ? 'Anonymous' : name.trim())
    setDone(true)
  }

  async function handleUndo() {
    setUndoing(true)
    await onUnclaim(claimedName, quantity)
    setUndoing(false)
    onClose()
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.sheetOverlay} onClick={onBackdropClick}>
      <div className={styles.sheet} role="dialog" aria-modal="true">
        <div className={styles.sheetHandle} />

        {done ? (
          <div className={styles.sheetDone}>
            <div className={styles.sheetDoneEmoji}>🎁</div>
            <div className={styles.sheetDoneTitle}>
              {anon ? 'Gift claimed!' : `Thanks, ${name.trim()}!`}
            </div>
            <p className={styles.sheetDoneSub}>
              You claimed {quantity > 1 ? `${quantity}× ` : ''}{target.label}.{' '}
              {anon ? 'Your name is hidden from the parents.' : 'The parents will see your name.'}
            </p>
            {(() => {
              const product = getWishlistProduct(target.slotId)
              return product ? (
                <div className={styles.sheetProduct}>
                  <div className={styles.sheetProductLabel}>Sprigloop pick</div>
                  <a
                    href={product.url}
                    className={styles.sheetProductLink}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                  >
                    {product.name} →
                  </a>
                  <div className={styles.sheetProductNote}>{product.note}</div>
                </div>
              ) : null
            })()}
            <div className={styles.sheetDoneBtns}>
              <button type="button" className={styles.sheetCloseBtn} onClick={onClose}>Done</button>
              <button
                type="button"
                className={styles.sheetUndoBtn}
                onClick={handleUndo}
                disabled={undoing}
              >
                {undoing ? 'Removing…' : 'Undo claim'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.sheetHead}>
              <div className={styles.sheetTitle}>Claim item</div>
              <button type="button" className={styles.sheetX} onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className={styles.sheetItem}>{target.label}</div>

            <form onSubmit={handleSubmit} className={styles.sheetForm}>
              {!anon && (
                <div className={styles.sheetField}>
                  <label className={styles.sheetLabel} htmlFor="claimer-name">Your name</label>
                  <input
                    id="claimer-name"
                    type="text"
                    className={styles.sheetInput}
                    placeholder="e.g. Grandma Linda"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                    disabled={submitting}
                    style={{ fontSize: '16px' }}
                  />
                </div>
              )}

              <button
                type="button"
                className={styles.anonToggle}
                onClick={() => setAnon(a => !a)}
                aria-pressed={anon}
              >
                <span className={`${styles.anonCheck} ${anon ? styles.anonCheckOn : ''}`}>
                  {anon ? '✓' : ''}
                </span>
                <span className={styles.anonLabel}>Give anonymously — hide my name from the parents</span>
              </button>

              {maxQty > 1 && (
                <div className={styles.sheetField}>
                  <label className={styles.sheetLabel}>How many?</label>
                  <div className={styles.qtyStepper}>
                    <button type="button" className={styles.qtyBtn}
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1} aria-label="Decrease">−</button>
                    <span className={styles.qtyValue}>{quantity}</span>
                    <button type="button" className={styles.qtyBtn}
                      onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                      disabled={quantity >= maxQty} aria-label="Increase">+</button>
                  </div>
                </div>
              )}

              {error && <div className={styles.sheetError}>{error}</div>}

              <button
                type="submit"
                className={styles.sheetSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? 'Claiming…' : 'Claim'}
              </button>
              {!canSubmit && (
                <p className={styles.sheetHint}>Enter your name or gift anonymously.</p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers + shared components ───────────────────────────────────────────────

const CAT_LABEL = {
  clothing: 'Clothing', sleep: 'Sleep', feeding: 'Feeding', diapering: 'Diapering',
  travel: 'Travel', play: 'Play', health: 'Health', bath: 'Bath',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch { return dateStr }
}

// Three-leafed sprig — matches favicon.svg exactly (stem + bud + 2 offset leaves)
function SprigMark({ size = 20 }) {
  const r = Math.round(size * 0.2)
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      <rect width="32" height="32" rx={r} fill="#2D8C6E" />
      <path
        d="M15.5 27 C14.5 22 14 18 15 14 C15.5 11 15.5 9 15.5 7"
        stroke="white" strokeWidth="2.8" strokeLinecap="round"
      />
      <ellipse cx="15.5" cy="5" rx="2.2" ry="3" fill="white" />
      <ellipse cx="20" cy="12" rx="5" ry="2.2"
        transform="rotate(-30 20 12)" fill="white" />
      <ellipse cx="11" cy="18" rx="5" ry="2.2"
        transform="rotate(30 11 18)" fill="white" />
    </svg>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 16 16" width="16" height="16" fill="none"
      className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
