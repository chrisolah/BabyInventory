import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold, matchesBabyFilter } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import {
  AGE_RANGES,
  SLOT_BY_ID,
  CATEGORY_LABELS,
  computeCoverage,
  pluralize,
} from '../lib/wardrobe'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import BabySwitcher from '../components/BabySwitcher'
import styles from './SlotDetail.module.css'

// Slot detail is the drill-down page for a single slot at a single age range.
// Route: /inventory/slot/:ageRange/:slotId
//
// Shows:
//   - Summary block: N of M owned, progress bar, "why this number" explainer
//   - "You need N more" card + Add one CTA (pre-fills AddItem)
//   - What you have (N): the list of Owned items for this slot + age range
//   - On the wish list: needed items already tracked for this slot
//   - From the community: placeholder for the exchange loop (not wired yet)
//
// If the URL params are invalid (bad slot id or unknown age range) we show a
// minimal error and let the user back out to Inventory.

export default function SlotDetail() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { ageRange, slotId } = useParams()
  const {
    household,
    selectedBabyId,
    loading: householdLoading,
    error: householdError,
  } = useHousehold()

  const slot = slotId ? SLOT_BY_ID[slotId] : null
  const ageRangeValid = AGE_RANGES.includes(ageRange)

  const [itemsLoading, setItemsLoading] = useState(true)
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  // ── Load items once household is known ──────────────────────────────────
  // Household is supplied by context; items are slot-specific in intent but
  // we fetch all household items and let computeCoverage do the slot bucket
  // match. Keeps the query shape identical to Inventory so the two pages
  // never disagree about counts.
  useEffect(() => {
    if (!user || !household) return
    let cancelled = false

    async function loadItems() {
      setItemsLoading(true)
      setError(null)

      const { data: itemsData, error: itemsErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (itemsErr) {
        setError(itemsErr.message)
        setItemsLoading(false)
        return
      }

      setItems(itemsData || [])
      setItemsLoading(false)
    }

    loadItems()
    return () => { cancelled = true }
  }, [user, household])

  useEffect(() => {
    if (householdError) setError(householdError)
  }, [householdError])

  const loading = householdLoading || itemsLoading

  // Filter by the switcher selection BEFORE computing coverage so the slot
  // detail page shows this baby's counts (plus shared items), matching what
  // the Wish list tab shows for the same selection.
  const babyFilteredItems = useMemo(
    () => items.filter(it => matchesBabyFilter(it, selectedBabyId)),
    [items, selectedBabyId],
  )

  // Reuse computeCoverage and pick out the row for this slot — keeps the
  // mapping logic in one place and ensures the slot detail screen agrees
  // with the main Wish list tab about "how many do I have."
  const row = useMemo(() => {
    if (!slot || !ageRangeValid) return null
    const all = computeCoverage(babyFilteredItems, ageRange)
    return all.find(r => r.slot.id === slot.id) || null
  }, [babyFilteredItems, slot, ageRange, ageRangeValid])

  useEffect(() => {
    if (!slot || !ageRangeValid || !row) return
    track.recommendationViewed({
      age_range: ageRange,
      slot: slot.id,
      owned: row.ownedCount,
      recommended: row.recommended,
    })
  }, [slot, ageRangeValid, row, ageRange])

  // ── Invalid URL fallback ────────────────────────────────────────────────
  if (!slot || !ageRangeValid) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/inventory')}
            aria-label="Back"
          >
            ←
          </button>
          <div className={styles.titleBlock}>
            <div className={styles.title}>Not found</div>
            <IvySprig />
          </div>
          <ProfileMenu />
        </header>
        <main className={styles.body}>
          <div className={styles.error}>
            That size or category isn&rsquo;t in your wardrobe.{' '}
            <button
              className={styles.linkBtn}
              onClick={() => navigate('/inventory')}
              type="button"
            >
              Back to inventory
            </button>
          </div>
        </main>
      </div>
    )
  }

  const recommended = row?.recommended ?? 0
  const ownedCount = row?.ownedCount ?? 0
  const needed = row?.needed ?? recommended
  const percent = recommended > 0
    ? Math.min(100, Math.round((ownedCount / recommended) * 100))
    : 0
  const ownedItems = row?.ownedItems ?? []
  const neededItems = row?.neededItems ?? []

  function handleAddOne() {
    // Pre-fill AddItem from the slot's category + current age range. The
    // baby the user is currently looking at comes through the context on
    // the other side, so we don't encode it in the URL — that way a
    // shared/copied link is baby-agnostic and picks up whoever the viewer
    // has selected.
    const params = new URLSearchParams({
      mode: 'owned',
      category: slot.category,
      size: ageRange,
      from_slot: slot.id,
    })
    track.recommendationClicked({
      age_range: ageRange,
      slot: slot.id,
      action: 'add_one',
    })
    navigate(`/add-item?${params.toString()}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/inventory')}
          aria-label="Back to inventory"
        >
          ←
        </button>
        <div className={styles.titleBlock}>
          <div className={styles.title}>{slot.label}</div>
          <div className={styles.subtitle}>
            {ageRange} · {CATEGORY_LABELS[slot.category] || slot.category}
          </div>
          {/* Mobile-only sprig beneath the subtitle. Hidden on desktop. */}
          <IvySprig />
        </div>
        <ProfileMenu />
      </header>

      {/* Chip switcher — self-hides for single-baby households. Sits under
          the header so toggling a baby re-scopes the coverage math below
          it without leaving the page. */}
      <BabySwitcher from="slot_detail" />

      <main className={styles.body}>
        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && error && (
          <div className={styles.error}>
            Couldn&rsquo;t load this slot: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Summary block */}
            <section className={styles.summary}>
              <div className={styles.count}>
                {ownedCount} <span className={styles.countDenom}>of {recommended}</span>
              </div>
              <div className={styles.countSub}>
                {slot.label} for {ageRange}
              </div>
              <div className={styles.detailBar}>
                <div
                  className={styles.detailBarFill}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className={styles.why}>
                {recommended} is the Sprig recommendation based on a typical 2×/week
                laundry cycle.
              </div>
            </section>

            {/* Need-N-more card — only when there's a gap */}
            {needed > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionTitle}>You need {needed} more</div>
                <div className={styles.needRow}>
                  <div className={styles.needRowLabel}>
                    {needed} more {pluralize(needed, slot.label.toLowerCase())} in {ageRange}
                  </div>
                  {slot.hint && (
                    <div className={styles.needRowSub}>{slot.hint}</div>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.addCta}
                  onClick={handleAddOne}
                >
                  + Add one
                </button>
              </section>
            )}

            {needed === 0 && recommended > 0 && (
              <section className={styles.section}>
                <div className={styles.completeCard}>
                  <div className={styles.completeTitle}>
                    ✓ You&rsquo;re covered on {slot.label.toLowerCase()} for {ageRange}
                  </div>
                  <div className={styles.completeSub}>
                    Owned {ownedCount}, recommended {recommended}. Nice.
                  </div>
                </div>
              </section>
            )}

            {/* Owned items in this slot */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                What you have ({ownedItems.length})
              </div>
              {ownedItems.length === 0 && (
                <div className={styles.emptyNote}>
                  Nothing yet. Add your first {slot.label.toLowerCase()} for {ageRange}.
                </div>
              )}
              {ownedItems.length > 0 && (
                <div className={styles.itemList}>
                  {ownedItems.map(item => (
                    <button
                      type="button"
                      className={styles.item}
                      key={item.id}
                      onClick={() => navigate(`/item/${item.id}`)}
                      aria-label={`Open ${item.name || humanizeItemType(item.item_type)}`}
                    >
                      <div className={styles.itemThumb} aria-hidden="true" />
                      <div className={styles.itemBody}>
                        <div className={styles.itemName}>
                          {item.name || humanizeItemType(item.item_type)}
                        </div>
                        <div className={styles.itemMeta}>
                          {[item.size_label, item.brand, item.quantity > 1 ? `×${item.quantity}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <span className={styles.itemBadge}>Owned</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Wish list entries already in this slot */}
            {neededItems.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionTitle}>
                  On your wish list ({neededItems.length})
                </div>
                <div className={styles.itemList}>
                  {neededItems.map(item => (
                    <button
                      type="button"
                      className={styles.item}
                      key={item.id}
                      onClick={() => navigate(`/item/${item.id}`)}
                      aria-label={`Open ${item.name || humanizeItemType(item.item_type)}`}
                    >
                      <div className={styles.itemThumb} aria-hidden="true" />
                      <div className={styles.itemBody}>
                        <div className={styles.itemName}>
                          {item.name || humanizeItemType(item.item_type)}
                        </div>
                        <div className={styles.itemMeta}>
                          {[item.size_label, item.brand].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span className={styles.itemBadgeAmber}>Wish</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Community — placeholder for the exchange loop.
                Not interactive yet; kept here so parents see the vision. */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>From the community</div>
              <div className={styles.communityCard}>
                <div className={styles.communityBody}>
                  <div className={styles.communityTitle}>
                    Exchange is coming soon
                  </div>
                  <div className={styles.communitySub}>
                    Families nearby will be able to pass on {ageRange.toLowerCase()}{' '}
                    {slot.label.toLowerCase()} they&rsquo;ve outgrown — no selling, no shipping.
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function humanizeItemType(s) {
  if (!s) return 'Item'
  return s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}
