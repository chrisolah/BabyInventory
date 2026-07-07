import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { SLOTS, AGE_RANGES, recommendedQty } from '../lib/wardrobe'
import { ITEMS as ITEM_DEFS, CATEGORY_META, CONSUMABLE_SLOT_IDS } from '../lib/categories'
import IvySprig from '../components/IvySprig'
import BottomNav from '../components/BottomNav'
import styles from './WishlistEdit.module.css'

// Category icons — same SVG icons used in Inventory/Plan
function ClothingIcon() { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M2 6l4-2 4 2 4-2 4 2v10H2V6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg> }
function SleepIcon()    { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M3 10a7 7 0 0012.6-4.2A7 7 0 003 10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg> }
function FeedingIcon()  { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M8 3v3a2 2 0 002 2h0a2 2 0 002-2V3M10 8v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function DiaperIcon()   { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><rect x="2" y="5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M2 10h16" stroke="currentColor" strokeWidth="1.4"/></svg> }
function TravelIcon()   { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><rect x="3" y="8" width="14" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M7 8V6a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.4"/></svg> }
function PlayIcon()     { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7l5 3-5 3V7z" fill="currentColor"/></svg> }
function HealthIcon()   { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function BathIcon()     { return <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M3 11h14v2a5 5 0 01-14 0v-2z" stroke="currentColor" strokeWidth="1.4"/><path d="M5 11V7a2 2 0 014 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function PriorityIcon() { return <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L10 14.4l-4.8 2.4.9-5.3L2.2 7.7l5.4-.8L10 2z"/></svg> }

const WISH_CATEGORIES = [
  { id: 'priority',  label: 'Priority',  icon: PriorityIcon,  color: 'amber'  },
  { id: 'clothing',  label: 'Clothing',  icon: ClothingIcon,  color: 'teal'   },
  { id: 'sleep',     label: 'Sleep',     icon: SleepIcon,     color: 'blue'   },
  { id: 'feeding',   label: 'Feeding',   icon: FeedingIcon,   color: 'amber'  },
  { id: 'diapering', label: 'Diapering', icon: DiaperIcon,    color: 'gray'   },
  { id: 'travel',    label: 'Travel',    icon: TravelIcon,    color: 'purple' },
  { id: 'play',      label: 'Play',      icon: PlayIcon,      color: 'coral'  },
  { id: 'health',    label: 'Health',    icon: HealthIcon,    color: 'red'    },
  { id: 'bath',      label: 'Bath',      icon: BathIcon,      color: 'green'  },
]

const CLOTHING_SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]))
const ITEM_SLOT     = Object.fromEntries(ITEM_DEFS.map(i => [i.id, i]))
const NON_CLOTHING_ORDER = ['sleep','feeding','diapering','travel','play','health','bath']

export default function WishlistEdit() {
  const navigate = useNavigate()
  const { household, babies, currentBaby } = useHousehold()

  const [loading, setLoading]   = useState(true)
  const [pageData, setPageData] = useState(null)
  const [shareId, setShareId]   = useState(null)
  const [token, setToken]       = useState(null)
  const [skipSlots, setSkipSlots] = useState(new Set())
  const [working, setWorking]       = useState(new Set())
  const [copyDone, setCopyDone]     = useState(false)
  const [qtyOverrides, setQtyOverrides] = useState({}) // { "slot_id:size_label": desired_qty }
  const [selectedCat, setSelectedCat] = useState('priority')
  const [selectedSize, setSelectedSize] = useState(null) // null = all sizes
  const [sellDismissed, setSellDismissed] = useState(
    () => sessionStorage.getItem('registry_sell_dismissed') === '1'
  )

  function dismissSell() {
    sessionStorage.setItem('registry_sell_dismissed', '1')
    setSellDismissed(true)
  }

  useEffect(() => {
    if (!household?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      let { data: existing } = await supabase.schema(currentSchema)
        .from('wishlist_shares').select('id, token, skip_slots, skip_categories, show_priority')
        .eq('household_id', household.id).eq('is_active', true).limit(1).maybeSingle()

      let share = existing
      if (!share) {
        const { data: created } = await supabase.schema(currentSchema)
          .from('wishlist_shares')
          .insert({ household_id: household.id, is_active: true })
          .select('id, token, skip_slots, skip_categories, show_priority').single()
        share = created
      }
      if (!share || cancelled) { setLoading(false); return }

      setShareId(share.id)
      setToken(share.token)
      setSkipSlots(new Set(share.skip_slots || []))

      const [{ data, error }, { data: overrideRows }] = await Promise.all([
        supabase.schema(currentSchema).rpc('get_wishlist_for_share', { p_token: share.token }),
        supabase.schema(currentSchema)
          .from('registry_quantity_overrides')
          .select('slot_id, size_label, desired_qty')
          .eq('household_id', household.id),
      ])
      if (!cancelled) {
        if (!error && data && !data.error) setPageData(data)
        const map = {}
        for (const o of overrideRows || []) {
          map[`${o.slot_id}:${o.size_label || ''}`] = o.desired_qty
        }
        setQtyOverrides(map)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [household?.id])

  const reloadGaps = useCallback(async () => {
    if (!token) return
    const { data, error } = await supabase.schema(currentSchema)
      .rpc('get_wishlist_for_share', { p_token: token })
    if (!error && data && !data.error) setPageData(data)
  }, [token])

  const saveSkips = useCallback(async (next) => {
    if (!shareId) return
    await supabase.schema(currentSchema).from('wishlist_shares')
      .update({ skip_slots: next.size > 0 ? [...next] : null }).eq('id', shareId)
  }, [shareId])

  const togglePriority = useCallback(async (row, slotType) => {
    const id = row.id
    setWorking(prev => new Set([...prev, id]))
    const table = slotType === 'clothing' ? 'clothing_items' : 'items'
    await supabase.schema(currentSchema).from(table)
      .update({ is_priority: !row.is_priority }).eq('id', id)
    await reloadGaps()
    setWorking(prev => { const s = new Set(prev); s.delete(id); return s })
  }, [reloadGaps])

  // Clothing hides are scoped per size ("slotId:sizeLabel") so hiding socks
  // for 0-3M doesn't also hide socks for 9-12M. Non-clothing items have no
  // size axis, so sizeLabel is null there and the key stays a plain slotId.
  // (Fixed 2026-07-07 — every hide used to be slot-only, so hiding one size
  // silently hid that item everywhere.)
  const toggleVisibility = useCallback(async (slotId, sizeLabel) => {
    const key = sizeLabel ? `${slotId}:${sizeLabel}` : slotId
    setSkipSlots(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      saveSkips(next)
      return next
    })
    setTimeout(reloadGaps, 200)
  }, [saveSkips, reloadGaps])

  const upsertQty = useCallback(async (slotId, sizeLabel, newQty) => {
    const key = `${slotId}:${sizeLabel || ''}`
    setQtyOverrides(prev => ({ ...prev, [key]: newQty }))
    await supabase.schema(currentSchema).rpc('upsert_registry_qty_override', {
      p_slot_id:     slotId,
      p_size_label:  sizeLabel || null,
      p_desired_qty: newQty,
    })
  }, [])

  async function copyLink() {
    const url = token ? `${window.location.origin}/registry/${token}` : null
    if (!url) return
    try { await navigator.clipboard.writeText(url) } catch {}
    setCopyDone(true); setTimeout(() => setCopyDone(false), 2000)
  }

  if (loading) return <div className={styles.page}><div className={styles.loadingBar} /></div>

  const clothing = pageData?.clothing || []
  const items    = pageData?.items    || []
  const household_data = pageData?.household

  const priorityClothing = clothing.filter(r => r.is_priority)
  const priorityItems    = items.filter(r => r.is_priority)
  const priorityCount    = priorityClothing.length + priorityItems.length

  // Count gaps per category for badge
  const catCounts = {
    priority: priorityCount,
    clothing: clothing.filter(r => !skipSlots.has(`${r.slot_id}:${r.size_label}`)).length,
    sleep: items.filter(r => r.top_category === 'sleep' && !skipSlots.has(r.slot_id)).length,
    feeding: items.filter(r => r.top_category === 'feeding' && !skipSlots.has(r.slot_id)).length,
    diapering: items.filter(r => r.top_category === 'diapering' && !skipSlots.has(r.slot_id)).length,
    travel: items.filter(r => r.top_category === 'travel' && !skipSlots.has(r.slot_id)).length,
    play: items.filter(r => r.top_category === 'play' && !skipSlots.has(r.slot_id)).length,
    health: items.filter(r => r.top_category === 'health' && !skipSlots.has(r.slot_id)).length,
    bath: items.filter(r => r.top_category === 'bath' && !skipSlots.has(r.slot_id)).length,
  }

  const householdName = household_data?.name || household?.name || 'Your'
  const babyName = pageData?.babies?.[0]?.name || currentBaby?.name || null

  return (
    <div className={styles.page}>
      {/* Header — matches Home/Inventory style */}
      <header className={styles.header}>
        <div className={styles.brand}>sprigloop</div>
        <div className={styles.sprigCenter}><IvySprig /></div>
        <div className={styles.headerActions}>
          <button className={styles.copyBtn} onClick={copyLink}>
            {copyDone ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      </header>

      {/* Sub-header with registry title */}
      <div className={styles.titleRow}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className={styles.titleInfo}>
          <div className={styles.titleMain}>{householdName}&apos;s Registry</div>
          {babyName && <div className={styles.titleSub}>{babyName}</div>}
        </div>
      </div>

      {/* ── Registry sell card ── */}
      {!sellDismissed && (
        <div className={styles.sellCard}>
          <div className={styles.sellInner}>
            <button className={styles.sellDismiss} onClick={dismissSell} aria-label="Dismiss">×</button>
            <div className={styles.sellTitle}>Your registry, built from reality</div>
            <p className={styles.sellBody}>
              Most registries are a wish list you fill before baby arrives — guesses dressed up as needs.
              This one tracks what you actually own and surfaces only the real gaps, organised by size.
              Your family and friends see <em>exactly</em> how many more bodysuits you need in 0–3M, not just &ldquo;bodysuits.&rdquo;
              When someone claims an item it&rsquo;s coordinated automatically — no duplicates, no awkward returns.
            </p>
            <div className={styles.sellPills}>
              <span className={styles.sellPill}>✓ Knows what you own</span>
              <span className={styles.sellPill}>✓ Quantity-aware</span>
              <span className={styles.sellPill}>✓ Auto-coordinated claims</span>
              <span className={styles.sellPill}>✓ Size-organised</span>
            </div>
          </div>
        </div>
      )}

      {/* Category tile tabs — matches Inventory/Plan style */}
      <div className={styles.catRow}>
        <div className={styles.catRowInner}>
        {WISH_CATEGORIES.map(cat => {
          const active = selectedCat === cat.id
          const count  = catCounts[cat.id] || 0
          return (
            <button
              key={cat.id}
              className={`${styles.catChip} ${styles[`catChip_${cat.color}`]} ${active ? styles.catChipActive : ''}`}
              onClick={() => setSelectedCat(cat.id)}
              aria-pressed={active}
              aria-label={cat.label}
            >
              <div className={`${styles.catChipIcon} ${styles[`catChipIcon_${cat.color}`]}`}>
                <cat.icon />
              </div>
              <span className={styles.catChipLabel}>{cat.label}</span>
              {count > 0 && <span className={styles.catChipBadge}>{count}</span>}
            </button>
          )
        })}
        </div>
      </div>

      {/* Size sub-nav — appears below category row when clothing is selected */}
      {selectedCat === 'clothing' && (() => {
        const availSizes = AGE_RANGES.filter(s =>
          (pageData?.clothing || []).some(r => r.size_label === s)
        )
        if (availSizes.length < 2) return null
        return (
          <div className={styles.sizeNav}>
            <div className={styles.sizeNavInner}>
              <button
                className={`${styles.sizeChipNav} ${!selectedSize ? styles.sizeChipNavActive : ''}`}
                onClick={() => setSelectedSize(null)}
              >All</button>
              {availSizes.map(size => (
                <button
                  key={size}
                  className={`${styles.sizeChipNav} ${selectedSize === size ? styles.sizeChipNavActive : ''}`}
                  onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                >{size}</button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Hint */}
      <div className={styles.hint}>★ most needed &nbsp;·&nbsp; × hide from family &amp; friends</div>

      {/* Category content */}
      <div className={styles.body}>
        {selectedCat === 'priority' && (
          <CategoryView
            rows={[...priorityClothing.map(r=>({...r,_type:'clothing'})), ...priorityItems.map(r=>({...r,_type:'item'}))]}
            skipSlots={skipSlots} working={working}
            onPriority={togglePriority} onToggleVisibility={toggleVisibility}
            qtyOverrides={qtyOverrides} onQtyChange={upsertQty}
            emptyText="Star items to mark them as most needed for family and friends."
          />
        )}
        {selectedCat === 'clothing' && (
          <ClothingCategoryView
            rows={clothing} skipSlots={skipSlots} working={working}
            selectedSize={selectedSize}
            onPriority={togglePriority} onToggleVisibility={toggleVisibility}
            qtyOverrides={qtyOverrides} onQtyChange={upsertQty}
          />
        )}
        {NON_CLOTHING_ORDER.includes(selectedCat) && (
          <CategoryView
            rows={items.filter(r => r.top_category === selectedCat).map(r=>({...r,_type:'item'}))}
            skipSlots={skipSlots} working={working}
            onPriority={togglePriority} onToggleVisibility={toggleVisibility}
            qtyOverrides={qtyOverrides} onQtyChange={upsertQty}
            emptyText={`No ${selectedCat} gaps yet.`}
          />
        )}
      </div>

      <BottomNav />
    </div>
  )
}

// Clothing grouped by size
function ClothingCategoryView({ rows, skipSlots, working, selectedSize, onPriority, onToggleVisibility, qtyOverrides, onQtyChange }) {
  const filteredRows = selectedSize ? rows.filter(r => r.size_label === selectedSize) : rows
  const bySize = {}
  for (const r of filteredRows) {
    const size = r.size_label || 'No size'
    if (!bySize[size]) bySize[size] = []
    bySize[size].push(r)
  }
  const sizes = AGE_RANGES.filter(s => bySize[s]?.length > 0)

  if (rows.length === 0) return <div className={styles.empty}>No clothing gaps yet.</div>

  return (
    <div className={styles.sizeList}>
      {sizes.map(size => (
        <div key={size}>
          {!selectedSize && <div className={styles.sizeLabel}>{size}</div>}
          <div className={styles.cardGrid}>
            {bySize[size].map(row => (
              <GapCard key={row.id} row={{...row,_type:'clothing'}}
                skipSlots={skipSlots} working={working.has(row.id)}
                onPriority={onPriority} onToggleVisibility={onToggleVisibility}
                qtyOverrides={qtyOverrides} onQtyChange={onQtyChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CategoryView({ rows, skipSlots, working, onPriority, onToggleVisibility, qtyOverrides, onQtyChange, emptyText }) {
  if (rows.length === 0) return <div className={styles.empty}>{emptyText}</div>
  return (
    <div className={styles.cardGrid}>
      {rows.map(row => (
        <GapCard key={`${row._type}-${row.id}`} row={row}
          skipSlots={skipSlots} working={working.has(row.id)}
          onPriority={onPriority} onToggleVisibility={onToggleVisibility}
          qtyOverrides={qtyOverrides} onQtyChange={onQtyChange}
        />
      ))}
    </div>
  )
}

const CAT_COLOR = {
  clothing: 'purple', sleep: 'blue', feeding: 'amber',
  diapering: 'gray', travel: 'purple', play: 'coral',
  health: 'red', bath: 'green',
}

function GapCard({ row, skipSlots, working, onPriority, onToggleVisibility, qtyOverrides, onQtyChange }) {
  const isClothing  = row._type === 'clothing'
  const slot        = isClothing ? CLOTHING_SLOT[row.slot_id] : ITEM_SLOT[row.slot_id]
  const label       = slot?.label || row.slot_id
  const isConsumable = !isClothing && CONSUMABLE_SLOT_IDS.has(row.slot_id)
  const recommended = isClothing ? recommendedQty(slot, row.size_label) : (slot?.recommended ?? 1)
  const overrideKey = `${row.slot_id}:${row.size_label || ''}`
  const desiredQty  = qtyOverrides?.[overrideKey] ?? recommended
  const stillNeeded = Math.max(0, desiredQty - (row.owned_count || 0))
  // Clothing hide state is scoped per size; non-clothing has no size axis.
  const skipKey     = isClothing ? `${row.slot_id}:${row.size_label}` : row.slot_id
  const hidden      = skipSlots.has(skipKey)
  const color       = isClothing ? 'purple' : (CAT_COLOR[row.top_category] || 'gray')

  function adjustQty(delta) {
    const next = Math.max(1, desiredQty + delta)
    if (next !== desiredQty) onQtyChange(row.slot_id, row.size_label || null, next)
  }

  return (
    <div className={`${styles.card} ${hidden ? styles.cardHidden : ''} ${working ? styles.cardWorking : ''}`}>
      <div className={`${styles.cardBand} ${styles[`band_${color}`]}`} />
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.cardLabel}>{label}</span>
          {row.is_priority && !hidden && <span className={styles.cardStar}>★</span>}
          {hidden && <span className={styles.cardHiddenIcon}>🚫</span>}
        </div>

        {isClothing && row.size_label && (
          <span className={styles.cardSize}>{row.size_label}</span>
        )}

        {isConsumable ? (
          <div className={styles.cardNeedConsumable}>Keep stocked</div>
        ) : (
          <div className={styles.cardNeedRow}>
            {!hidden && (
              <div className={styles.qtyControl}>
                <button className={styles.qtyBtn} onClick={() => adjustQty(-1)} disabled={working || desiredQty <= 1} aria-label="Decrease">−</button>
                <span className={styles.qtyValue}>{desiredQty}</span>
                <button className={styles.qtyBtn} onClick={() => adjustQty(1)} disabled={working} aria-label="Increase">+</button>
              </div>
            )}
            <div className={styles.cardNeed}>
              {hidden ? 'Hidden' : `Need ${stillNeeded} more`}
            </div>
          </div>
        )}

        <div className={styles.cardControls}>
          {!hidden && (
            <button
              className={`${styles.starBtn} ${row.is_priority ? styles.starBtnActive : ''}`}
              onClick={() => onPriority(row, row._type)}
              disabled={working}
              aria-label={row.is_priority ? 'Remove priority' : 'Mark as most needed'}
            >{row.is_priority ? '★ Priority' : '☆ Prioritize'}</button>
          )}
          <button
            className={`${styles.hideBtn} ${hidden ? styles.hideBtnActive : ''}`}
            onClick={() => onToggleVisibility(row.slot_id, isClothing ? row.size_label : null)}
            disabled={working}
            aria-label={hidden ? 'Show to family & friends' : 'Hide from family & friends'}
          >{hidden ? '👁' : '×'}</button>
        </div>
      </div>
    </div>
  )
}
