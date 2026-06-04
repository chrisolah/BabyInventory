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
import { SLOTS, AGE_RANGES, recommendedQty } from '../lib/wardrobe'
import { ITEMS, CATEGORY_META } from '../lib/categories'
import { getWishlistProduct } from '../lib/wishlistProducts'
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
  const [claims, setClaims] = useState([])
  // { slotId, slotType, sizeLabel, label, maxQty } — null = sheet closed
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
    if (error || data?.error) { setNotFound(true); return }
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
        <h1 className={styles.notFoundTitle}>This wishlist isn&rsquo;t available</h1>
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
          <div className={styles.heroEyebrow}>Baby Wishlist</div>
          <h1 className={styles.heroTitle}>
            {household?.name ? `${household.name}'s Wishlist` : 'Baby Wishlist'}
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
      {(skipCats.size > 0 || skipSizes.length > 0 || skipSlots.length > 0) && (
        <div className={styles.skipBanner}>
          <span aria-hidden="true">🙏</span>
          <div>
            {skipCats.size > 0 && (
              <div>
                <strong>Well stocked on:</strong>{' '}
                {[...skipCats].map(c => CAT_LABEL[c] || c).join(', ')} — no gifts needed here!
              </div>
            )}
            {skipSlots.length > 0 && (
              <div className={skipCats.size > 0 ? styles.skipLine : ''}>
                <strong>Clothing types covered:</strong>{' '}
                {skipSlots.map(id => CLOTHING_SLOT[id]?.label || id).join(', ')} — these won&rsquo;t appear below.
              </div>
            )}
            {skipSizes.length > 0 && (
              <div className={(skipCats.size > 0 || skipSlots.length > 0) ? styles.skipLine : ''}>
                <strong>Clothing sizes covered:</strong>{' '}
                {skipSizes.join(', ')} — these won&rsquo;t appear below.
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.body}>
        {/* ── Priority section ──────────────────────────────────── */}
        {showPriority && (
          <PrioritySection
            clothing={clothing} items={items}
            claimsMap={claimsMap}
            onClaim={setClaimTarget}
          />
        )}

        {/* ── Clothing by age-range groups ─────────────────────── */}
        {clothing?.length > 0 && (
          <ClothingSection
            clothing={clothing}
            claimsMap={claimsMap}
            onClaim={setClaimTarget}
          />
        )}

        {/* ── Non-clothing by category ──────────────────────────── */}
        {items?.length > 0 && (
          <NonClothingSection
            items={items}
            claimsMap={claimsMap}
            onClaim={setClaimTarget}
          />
        )}

        {!clothing?.length && !items?.length && (
          <div className={styles.emptyState}>
            <div className={styles.emptyEmoji}>🌱</div>
            <p className={styles.emptyText}>Nothing on the wishlist yet.</p>
          </div>
        )}
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

function SlotCard({ slotType, slotId, sizeLabel, ownedCount, claimsMap, isPriority, onClaim }) {
  const isClothing   = slotType === 'clothing'
  const slot         = isClothing ? CLOTHING_SLOT[slotId] : ITEM_SLOT[slotId]
  const label        = slot?.label || slotId.replace(/_/g, ' ')
  const recommended  = isClothing
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
            Claim {stillNeeded > 1 ? 'one' : 'it'}
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
                Buy on Amazon →
              </a>
            ) : null
          })()}
        </>
      )}
    </div>
  )
}

// ── Claim sheet ───────────────────────────────────────────────────────────────

function ClaimSheet({ target, onSubmit, onClose }) {
  const [name, setName] = useState('')
  const [anon, setAnon] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

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
            <div className={styles.sheetDoneTitle}>
              {anon ? 'Gift claimed!' : `Thanks, ${name.trim()}!`}
            </div>
            <p className={styles.sheetDoneSub}>
              You claimed {quantity > 1 ? `${quantity}× ` : ''}{target.label}.{' '}
              {anon ? 'Your name is hidden from the family.' : 'The family will see your name.'}
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
            <button type="button" className={styles.sheetCloseBtn} onClick={onClose}>Done</button>
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
                <span className={styles.anonLabel}>Give anonymously — hide my name from the family</span>
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
                {submitting ? 'Claiming…' : `Claim ${quantity > 1 ? `${quantity}× ` : ''}${target.label.split(' · ')[0]}`}
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
