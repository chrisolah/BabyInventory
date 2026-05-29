// Public wishlist recipient page. No auth required.
// Route: /wishlist/:token
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
import { SLOTS, AGE_RANGES, CATEGORY_LABELS, recommendedQty } from '../lib/wardrobe'
import { ITEMS, CATEGORY_META } from '../lib/categories'
import styles from './WishlistPublic.module.css'

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
  // Claims are kept in local state so they update optimistically after submission
  const [claims, setClaims] = useState([])
  // { slotId, slotType, sizeLabel, label, maxQty } — null means sheet is closed
  const [claimTarget, setClaimTarget] = useState(null)

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
    if (error || data?.error) {
      setNotFound(true)
      return
    }
    setPageData(data)
    setClaims(data.claims || [])
  }

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
    // Merge returned claims into local state
    const fresh = (data.claims || []).map(c => ({
      slot_id: target.slotId,
      slot_type: target.slotType,
      size_label: target.sizeLabel || null,
      claimer_name: c.claimer_name,
      quantity: c.quantity,
      claimed_at: c.claimed_at,
    }))
    setClaims(prev => {
      // Remove old claims for this slot + add fresh ones
      const filtered = prev.filter(c =>
        claimKey(c.slot_type, c.slot_id, c.size_label) !==
        claimKey(target.slotType, target.slotId, target.sizeLabel)
      )
      return [...filtered, ...fresh]
    })
    return { ok: true }
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} aria-label="Loading" />
      </div>
    )
  }

  if (notFound || !pageData) {
    return (
      <div className={styles.notFound}>
        <div className={styles.notFoundEmoji}>🍃</div>
        <h1 className={styles.notFoundTitle}>This wishlist isn&rsquo;t available</h1>
        <p className={styles.notFoundSub}>
          The link may have expired or been deactivated by the family.
        </p>
      </div>
    )
  }

  const { share, household, babies, clothing, items } = pageData
  const skipCats   = new Set(share.skip_categories || [])
  const showPriority = share.show_priority !== false

  return (
    <div className={styles.page}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className={styles.hero}>
        <div className={styles.heroBrand}>
          <SprigloopMark />
          <span className={styles.heroBrandName}>Sprigloop</span>
        </div>
        <h1 className={styles.heroTitle}>
          {household?.name
            ? `${household.name}'s Wishlist`
            : 'Baby Wishlist'}
        </h1>
        {babies?.length > 0 && (
          <div className={styles.babyPills}>
            {babies.map((b, i) => (
              <span key={i} className={styles.babyPill}>{b.name}</span>
            ))}
          </div>
        )}
        {share.target_date && (
          <div className={styles.targetDate}>
            {formatDate(share.target_date)}
          </div>
        )}
      </header>

      {/* ── Message from the family ───────────────────────────────── */}
      {share.message && (
        <div className={styles.messageCard}>
          <span className={styles.messageQuote}>&ldquo;</span>
          <p className={styles.messageText}>{share.message}</p>
        </div>
      )}

      {/* ── Skip-categories notice ────────────────────────────────── */}
      {skipCats.size > 0 && (
        <div className={styles.skipBanner}>
          <span className={styles.skipIcon} aria-hidden="true">🙏</span>
          <div className={styles.skipBody}>
            <strong>They&rsquo;re well stocked on:</strong>{' '}
            {[...skipCats].map(c => CAT_LABEL[c] || c).join(', ')} — no need to buy these!
          </div>
        </div>
      )}

      <div className={styles.body}>
        {/* ── Priority section ──────────────────────────────────────── */}
        {showPriority && <PrioritySection
          clothing={clothing} items={items}
          claimsMap={claimsMap}
          onClaim={setClaimTarget}
        />}

        {/* ── Clothing by age range ─────────────────────────────────── */}
        {clothing?.length > 0 && (
          <ClothingSection
            clothing={clothing}
            claimsMap={claimsMap}
            onClaim={setClaimTarget}
          />
        )}

        {/* ── Non-clothing items by category ───────────────────────── */}
        {items?.length > 0 && (
          <NonClothingSection
            items={items}
            claimsMap={claimsMap}
            onClaim={setClaimTarget}
          />
        )}

        {/* Empty state */}
        {(!clothing?.length && !items?.length) && (
          <div className={styles.emptyState}>
            <div className={styles.emptyEmoji}>🌱</div>
            <p className={styles.emptyText}>Nothing on the wishlist yet.</p>
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <SprigloopMark size={14} />
        <span>Powered by <strong>Sprigloop</strong> — baby inventory &amp; community exchange</span>
      </footer>

      {/* ── Claim sheet ───────────────────────────────────────────── */}
      {claimTarget && (
        <ClaimSheet
          target={claimTarget}
          onSubmit={submitClaim}
          onClose={() => setClaimTarget(null)}
        />
      )}
    </div>
  )
}

// ── Priority section ─────────────────────────────────────────────────────────

function PrioritySection({ clothing, items, claimsMap, onClaim }) {
  const priorityClothing = (clothing || []).filter(r => r.is_priority)
  const priorityItems    = (items || []).filter(r => r.is_priority)
  const total = priorityClothing.length + priorityItems.length
  if (total === 0) return null

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeadPriority}>
        <span className={styles.priorityStar} aria-hidden="true">★</span>
        <span className={styles.sectionTitle}>Most needed</span>
      </div>
      <div className={styles.cardGrid}>
        {priorityClothing.map(row => (
          <SlotCard
            key={`c-${row.id}`}
            slotType="clothing"
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
            slotId={row.slot_id}
            sizeLabel={null}
            ownedCount={row.owned_count || 0}
            claimsMap={claimsMap}
            isPriority
            onClaim={onClaim}
          />
        ))}
      </div>
    </section>
  )
}

// ── Clothing section ──────────────────────────────────────────────────────────

function ClothingSection({ clothing, claimsMap, onClaim }) {
  // Group by size_label, in AGE_RANGES order
  const bySize = {}
  for (const r of clothing) {
    if (!bySize[r.size_label]) bySize[r.size_label] = []
    bySize[r.size_label].push(r)
  }
  const sizes = AGE_RANGES.filter(s => bySize[s]?.length > 0)
  if (sizes.length === 0) return null

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Clothing</h2>
      </div>
      {sizes.map(size => (
        <div key={size} className={styles.sizeGroup}>
          <div className={styles.sizeLabel}>{size}</div>
          <div className={styles.cardGrid}>
            {bySize[size].map(row => (
              <SlotCard
                key={row.id}
                slotType="clothing"
                slotId={row.slot_id}
                sizeLabel={row.size_label}
                ownedCount={row.owned_count || 0}
                claimsMap={claimsMap}
                isPriority={row.is_priority}
                onClaim={onClaim}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

// ── Non-clothing section ──────────────────────────────────────────────────────

const NON_CLOTHING_ORDER = ['sleep', 'feeding', 'diapering', 'travel', 'play', 'health', 'bath']

function NonClothingSection({ items, claimsMap, onClaim }) {
  const byCat = {}
  for (const r of items) {
    if (!byCat[r.top_category]) byCat[r.top_category] = []
    byCat[r.top_category].push(r)
  }
  const cats = NON_CLOTHING_ORDER.filter(c => byCat[c]?.length > 0)
  if (cats.length === 0) return null

  return (
    <>
      {cats.map(cat => (
        <section key={cat} className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{CATEGORY_META[cat]?.label || cat}</h2>
          </div>
          <div className={styles.cardGrid}>
            {byCat[cat].map(row => (
              <SlotCard
                key={row.id}
                slotType="item"
                slotId={row.slot_id}
                sizeLabel={null}
                ownedCount={row.owned_count || 0}
                claimsMap={claimsMap}
                isPriority={row.is_priority}
                onClaim={onClaim}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

// ── Slot card ─────────────────────────────────────────────────────────────────

function SlotCard({ slotType, slotId, sizeLabel, ownedCount, claimsMap, isPriority, onClaim }) {
  const isClothing = slotType === 'clothing'
  const slot     = isClothing ? CLOTHING_SLOT[slotId] : ITEM_SLOT[slotId]
  const label    = slot?.label || slotId.replace(/_/g, ' ')
  const recommended = isClothing
    ? recommendedQty(slot, sizeLabel)
    : (slot?.recommended ?? 1)

  const claimData   = claimsMap[claimKey(slotType, slotId, sizeLabel)] || { total: 0, claimers: [] }
  const stillNeeded = Math.max(0, recommended - ownedCount - claimData.total)
  const isCovered   = stillNeeded === 0

  function handleClaim() {
    onClaim({
      slotId,
      slotType,
      sizeLabel: sizeLabel || null,
      label: sizeLabel ? `${label} · ${sizeLabel}` : label,
      maxQty: stillNeeded,
    })
  }

  return (
    <div className={`${styles.card} ${isCovered ? styles.cardCovered : ''}`}>
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

      {!isCovered ? (
        <div className={styles.cardNeed}>
          Need {stillNeeded} more
        </div>
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
        <button type="button" className={styles.claimBtn} onClick={handleClaim}>
          Claim {stillNeeded > 1 ? 'one' : 'it'}
        </button>
      )}
    </div>
  )
}

// ── Claim sheet ───────────────────────────────────────────────────────────────

function ClaimSheet({ target, onSubmit, onClose }) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const maxQty = target.maxQty || 1

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    const result = await onSubmit(name, quantity)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error === 'share_not_found'
        ? 'This wishlist is no longer active.'
        : 'Something went wrong. Try again.')
      return
    }
    setDone(true)
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
            <div className={styles.sheetDoneTitle}>Thanks, {name.trim()}!</div>
            <p className={styles.sheetDoneSub}>You claimed {quantity > 1 ? `${quantity}× ` : ''}{target.label}. The family will see your name.</p>
            <button type="button" className={styles.sheetCloseBtn} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className={styles.sheetHead}>
              <div className={styles.sheetTitle}>Claim item</div>
              <button type="button" className={styles.sheetX} onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className={styles.sheetItem}>{target.label}</div>

            <form onSubmit={handleSubmit} className={styles.sheetForm}>
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
                  required
                  disabled={submitting}
                />
              </div>

              {maxQty > 1 && (
                <div className={styles.sheetField}>
                  <label className={styles.sheetLabel}>How many?</label>
                  <div className={styles.qtyStepper}>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      aria-label="Decrease"
                    >−</button>
                    <span className={styles.qtyValue}>{quantity}</span>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                      disabled={quantity >= maxQty}
                      aria-label="Increase"
                    >+</button>
                  </div>
                </div>
              )}

              {error && <div className={styles.sheetError}>{error}</div>}

              <button
                type="submit"
                className={styles.sheetSubmit}
                disabled={!name.trim() || submitting}
              >
                {submitting ? 'Claiming…' : `Claim ${quantity > 1 ? `${quantity}× ` : ''}${target.label.split(' · ')[0]}`}
              </button>
              {!name.trim() && (
                <p className={styles.sheetHint}>Enter your name to claim this item.</p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAT_LABEL = {
  clothing: 'Clothing', sleep: 'Sleep', feeding: 'Feeding', diapering: 'Diapering',
  travel: 'Travel', play: 'Play', health: 'Health', bath: 'Bath',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function SprigloopMark({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#2D8C6E" />
      <path d="M12 18V10M12 14Q8 12 8 8Q12 8 12 12M12 12Q16 10 16 6Q12 6 12 10"
        stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
