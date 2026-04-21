import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LogoutButton from '../components/LogoutButton'
import styles from './Inventory.module.css'

// Inventory is the user's wardrobe view. Two tabs:
//   - Have → items with inventory_status = 'owned' (or 'outgrown' — still visible)
//   - Need → items with inventory_status = 'needed'
// Items are grouped by category and listed beneath each category header.
//
// The full prototype has a size-coverage card, filter chips, and "coming up
// soon" alerts — all of which need wardrobe-recommendation data we don't have
// yet. This pass deliberately ships without them; the page is still useful
// as the add-item landing.
//
// Loads: first household the user belongs to (most-recently joined), the
// baby in that household (for the header title), and every clothing_item in
// that household. RLS filters to just the user's household on the server.

const CATEGORY_LABELS = {
  tops_and_bodysuits: 'Tops and bodysuits',
  one_pieces: 'One-pieces',
  bottoms: 'Bottoms',
  dresses_and_skirts: 'Dresses and skirts',
  outerwear: 'Outerwear',
  sleepwear: 'Sleepwear',
  footwear: 'Footwear',
  accessories: 'Accessories',
  swimwear: 'Swimwear',
}
// Display order mirrors how parents naturally think about the wardrobe —
// tops/bottoms first, seasonal/specialty last.
const CATEGORY_ORDER = [
  'tops_and_bodysuits',
  'one_pieces',
  'bottoms',
  'dresses_and_skirts',
  'outerwear',
  'sleepwear',
  'footwear',
  'accessories',
  'swimwear',
]

const STATUS_LABEL = {
  owned: 'Owned',
  needed: 'Needed',
  outgrown: 'Outgrown',
  donated: 'Donated',
  exchanged: 'Exchanged',
}

const PRIORITY_LABEL = {
  must_have: 'Must have',
  nice_to_have: 'Nice to have',
  low_priority: 'Low priority',
}

export default function Inventory() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tab, setTab] = useState('owned') // 'owned' | 'wishlist'
  const [loading, setLoading] = useState(true)
  const [household, setHousehold] = useState(null)
  const [baby, setBaby] = useState(null)
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  // ── Load household, baby, items on mount ────────────────────────────────
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      // Membership → household. Most-recently joined wins (same policy as
      // Onboarding resume), which is a safe default for a solo-household
      // MVP and a reasonable starting point for multi-household later.
      const { data: memberships, error: memErr } = await supabase
        .schema(currentSchema)
        .from('household_members')
        .select('household_id, households(id, name)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)

      if (cancelled) return
      if (memErr || !memberships?.[0]?.households) {
        setError(memErr?.message || 'No household found')
        setLoading(false)
        return
      }

      const h = memberships[0].households

      // Baby is optional — header still works without it.
      const { data: babies } = await supabase
        .schema(currentSchema)
        .from('babies')
        .select('id, name')
        .eq('household_id', h.id)
        .limit(1)

      if (cancelled) return

      const { data: itemsData, error: itemsErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('*')
        .eq('household_id', h.id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (itemsErr) {
        setError(itemsErr.message)
        setLoading(false)
        return
      }

      setHousehold(h)
      setBaby(babies?.[0] ?? null)
      setItems(itemsData || [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user])

  // ── Filter by tab + group by category ───────────────────────────────────
  const grouped = useMemo(() => {
    const targetStatus = tab === 'owned' ? 'owned' : 'needed'
    const filtered = items.filter(i => i.inventory_status === targetStatus)
    const groups = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]))
    for (const it of filtered) {
      if (groups[it.category]) groups[it.category].push(it)
    }
    // Return only categories that have items, in defined order.
    return CATEGORY_ORDER
      .filter(c => groups[c].length > 0)
      .map(c => ({ category: c, items: groups[c] }))
  }, [items, tab])

  const title = baby?.name ? `${baby.name}'s wardrobe` : 'Your wardrobe'

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/home')}
          aria-label="Back"
        >
          ←
        </button>
        <div className={styles.title}>{title}</div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => navigate('/add-item')}
            aria-label="Add item"
          >
            <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <LogoutButton />
        </div>
      </header>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'owned' ? styles.tabActive : ''}`}
          onClick={() => setTab('owned')}
        >
          Have
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'wishlist' ? styles.tabActive : ''}`}
          onClick={() => setTab('wishlist')}
        >
          Need
        </button>
      </div>

      <main className={styles.body}>
        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && error && (
          <div className={styles.error}>
            Couldn't load your inventory: {error}
          </div>
        )}

        {!loading && !error && grouped.length === 0 && (
          <EmptyState tab={tab} onAdd={() => navigate('/add-item')} />
        )}

        {!loading && !error && grouped.map(group => (
          <section className={styles.group} key={group.category}>
            <div className={styles.groupHeader}>
              <span className={styles.groupTitle}>
                {CATEGORY_LABELS[group.category] || group.category}
              </span>
              <span className={styles.groupCount}>
                {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className={styles.groupItems}>
              {group.items.map(it => (
                <ItemRow key={it.id} item={it} tab={tab} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

// ── Components ────────────────────────────────────────────────────────────

function EmptyState({ tab, onAdd }) {
  // Encourage-add copy, per the scoping decision. Different framing per tab:
  // Have is about what they already own; Need is about what they'll need next.
  if (tab === 'owned') {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>Start your inventory</div>
        <div className={styles.emptyBody}>
          Let&rsquo;s start with something you already have — a onesie, a sleepsuit, anything.
        </div>
        <button type="button" className={styles.emptyCta} onClick={onAdd}>
          Add first item
        </button>
      </div>
    )
  }
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>Nothing you need yet</div>
      <div className={styles.emptyBody}>
        Add items you know you&rsquo;ll need — we&rsquo;ll help you spot gaps before you run out.
      </div>
      <button type="button" className={styles.emptyCta} onClick={onAdd}>
        Add a need
      </button>
    </div>
  )
}

function ItemRow({ item, tab }) {
  // Badge text differs by tab:
  //   - Owned tab: show inventory_status (Owned / Outgrown / etc.)
  //   - Wishlist tab: show priority (Must have / Nice to have) if set
  const badge = tab === 'owned'
    ? (STATUS_LABEL[item.inventory_status] ?? item.inventory_status)
    : (PRIORITY_LABEL[item.priority] ?? 'Needed')

  const displayName = item.name || humanizeItemType(item.item_type)
  const metaParts = [item.size_label, item.brand, item.quantity > 1 ? `×${item.quantity}` : null]
    .filter(Boolean)

  return (
    <div className={styles.itemRow}>
      <div className={styles.itemThumb} aria-hidden="true" />
      <div className={styles.itemBody}>
        <div className={styles.itemName}>{displayName}</div>
        <div className={styles.itemMeta}>{metaParts.join(' · ')}</div>
      </div>
      <span className={styles.itemBadge}>{badge}</span>
    </div>
  )
}

// item_type is free text in the DB ("long_sleeve_onesie", "sleepsuit", etc.).
// For display, turn snake_case into "Snake case".
function humanizeItemType(s) {
  if (!s) return 'Item'
  return s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}
