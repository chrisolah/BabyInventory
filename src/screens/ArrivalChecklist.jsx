// Pre-birth arrival checklist — time-gated screen showing day-1 readiness.
// Entered from the countdown card on Home or a link in Plan.
// After due date passes, redirects to /plan.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { SLOTS, recommendedQty } from '../lib/wardrobe'
import { ITEMS, CONSUMABLE_SLOT_IDS } from '../lib/categories'
import { ARRIVAL_TIERS } from '../lib/arrivalChecklist'
import BottomNav from '../components/BottomNav'
import styles from './ArrivalChecklist.module.css'

const CLOTHING_SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]))
const ITEM_SLOT     = Object.fromEntries(ITEMS.map(i => [i.id, i]))

function daysUntil(dateStr) {
  if (!dateStr) return null
  const due = new Date(dateStr)
  const now = new Date()
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
}

export default function ArrivalChecklist() {
  const navigate = useNavigate()
  const { household, babies, currentBaby } = useHousehold()

  const [loading, setLoading]   = useState(true)
  const [clothingItems, setClothingItems] = useState([])
  const [ownedItems, setOwnedItems]       = useState([])
  const [prioritySlots, setPrioritySlots] = useState(new Set())
  const [working, setWorking]   = useState(new Set())
  const [openTiers, setOpenTiers] = useState({ day1: true, week1: true, noRush: false })

  // Find due date from babies
  const baby = currentBaby || babies?.[0]
  const dueDateStr = baby?.due_date || baby?.date_of_birth
  const daysLeft = daysUntil(dueDateStr)
  const babyName = baby?.name || 'your baby'

  // Redirect if due date has passed
  useEffect(() => {
    if (daysLeft !== null && daysLeft <= 0) navigate('/plan', { replace: true })
  }, [daysLeft, navigate])

  useEffect(() => {
    if (!household?.id) return
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id, baby?.id])

  async function load() {
    setLoading(true)
    const babyId = baby?.id

    const [{ data: ci }, { data: items }] = await Promise.all([
      supabase.schema(currentSchema).from('clothing_items')
        .select('slot_id, size_label, quantity, is_priority, inventory_status')
        .eq('household_id', household.id)
        .eq('inventory_status', 'owned'),
      supabase.schema(currentSchema).from('items')
        .select('slot_id, is_priority, inventory_status')
        .eq('household_id', household.id)
        .eq('inventory_status', 'owned'),
    ])

    setClothingItems(ci || [])
    setOwnedItems(items || [])

    // Build priority set from owned items
    const pSlots = new Set()
    for (const r of (ci || [])) if (r.is_priority) pSlots.add(`clothing:${r.slot_id}:${r.size_label}`)
    for (const r of (items || [])) if (r.is_priority) pSlots.add(`item:${r.slot_id}`)
    setPrioritySlots(pSlots)

    setLoading(false)
  }

  function getOwnedCount(slot) {
    if (slot.type === 'clothing') {
      return clothingItems
        .filter(r => r.slot_id === slot.id && r.size_label === slot.size)
        .reduce((sum, r) => sum + (r.quantity || 1), 0)
    }
    return ownedItems.filter(r => r.slot_id === slot.id).length
  }

  function getRecommended(slot) {
    if (slot.type === 'clothing') {
      const s = CLOTHING_SLOT[slot.id]
      return recommendedQty(s, slot.size)
    }
    return ITEM_SLOT[slot.id]?.recommended ?? 1
  }

  function isPriority(slot) {
    const key = slot.type === 'clothing'
      ? `clothing:${slot.id}:${slot.size}`
      : `item:${slot.id}`
    return prioritySlots.has(key)
  }

  async function togglePriority(slot) {
    const key = slot.type === 'clothing'
      ? `clothing:${slot.id}:${slot.size}`
      : `item:${slot.id}`
    setWorking(prev => new Set([...prev, key]))

    const next = !prioritySlots.has(key)
    setPrioritySlots(prev => {
      const s = new Set(prev)
      next ? s.add(key) : s.delete(key)
      return s
    })

    if (slot.type === 'clothing') {
      await supabase.schema(currentSchema).from('clothing_items')
        .update({ is_priority: next })
        .eq('household_id', household.id)
        .eq('slot_id', slot.id)
        .eq('size_label', slot.size)
        .eq('inventory_status', 'owned')
    } else {
      await supabase.schema(currentSchema).from('items')
        .update({ is_priority: next })
        .eq('household_id', household.id)
        .eq('slot_id', slot.id)
        .eq('inventory_status', 'owned')
    }

    setWorking(prev => { const s = new Set(prev); s.delete(key); return s })
  }

  function addItem(slot) {
    if (slot.type === 'clothing') {
      navigate(`/add-item?category=clothing&slot=${slot.id}&size=${encodeURIComponent(slot.size)}`)
    } else {
      navigate(`/add-item?category=${slot.category}&slot=${slot.id}`)
    }
  }

  // Compute day-1 readiness
  const day1Slots = ARRIVAL_TIERS[0].slots
  const day1Ready = day1Slots.filter(s => getOwnedCount(s) >= getRecommended(s)).length
  const day1Pct   = Math.round((day1Ready / day1Slots.length) * 100)

  if (loading) return <div className={styles.page}><div className={styles.loadingBar} /></div>

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className={styles.headerCenter}>
          <div className={styles.headerTitle}>
            Ready for {babyName}
          </div>
          {daysLeft !== null && (
            <div className={styles.headerSub}>{daysLeft} days to go</div>
          )}
        </div>
        <div className={styles.headerRight} />
      </header>

      {/* Day-1 readiness hero card */}
      <div className={styles.heroWrap}>
        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.heroTitle}>What to have ready before you leave the hospital</div>
            <div className={styles.heroDesc}>
              Work through these three tiers in order. Star items to flag them on your registry
              so family and friends can help fill the gaps.
            </div>
            <div className={styles.heroProgress}>
              <div className={styles.heroProgressTrack}>
                <div className={styles.heroProgressFill} style={{ width: `${day1Pct}%` }} />
              </div>
              <span className={styles.heroProgressLabel}>
                {day1Pct}% day-1 ready &nbsp;·&nbsp; {day1Ready} of {day1Slots.length} essentials covered
              </span>
            </div>
          </div>
          <div className={styles.heroRing}>
            <svg viewBox="0 0 80 80" width="72" height="72">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="7"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke="#fff" strokeWidth="7"
                strokeDasharray={`${(day1Pct / 100) * 213.6} 213.6`}
                strokeDashoffset="53.4"
                strokeLinecap="round"
              />
              <text x="40" y="46" textAnchor="middle" fill="#fff"
                fontSize="18" fontWeight="700" fontFamily="system-ui">{day1Pct}%</text>
            </svg>
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className={styles.body}>
        {ARRIVAL_TIERS.map(tier => (
          <div key={tier.id} className={styles.tier}>
            <button
              className={styles.tierHeader}
              onClick={() => setOpenTiers(prev => ({ ...prev, [tier.id]: !prev[tier.id] }))}
            >
              <div className={styles.tierDot} style={{ background: tier.color }} />
              <div className={styles.tierInfo}>
                <div className={styles.tierLabel}>{tier.label}</div>
                <div className={styles.tierSub}>{tier.sub}</div>
              </div>
              <span className={styles.tierChevron}>{openTiers[tier.id] ? '▾' : '›'}</span>
            </button>

            {openTiers[tier.id] && (
              <div className={styles.tierSlots}>
                {tier.slots.map(slot => {
                  const owned = getOwnedCount(slot)
                  const rec   = getRecommended(slot)
                  const covered = owned >= rec
                  const label = slot.type === 'clothing'
                    ? `${CLOTHING_SLOT[slot.id]?.label || slot.id} · ${slot.size}`
                    : ITEM_SLOT[slot.id]?.label || slot.id
                  const prio  = isPriority(slot)
                  const key   = slot.type === 'clothing' ? `clothing:${slot.id}:${slot.size}` : `item:${slot.id}`
                  const busy  = working.has(key)

                  return (
                    <div key={key} className={`${styles.slotRow} ${covered ? styles.slotCovered : ''}`}>
                      <div className={styles.slotInfo}>
                        <div className={styles.slotLabel}>
                          {covered && <span className={styles.checkmark}>✓ </span>}
                          {label}
                        </div>
                        <div className={styles.slotCount}>
                          {slot.type !== 'clothing' && CONSUMABLE_SLOT_IDS.has(slot.id)
                            ? 'Keep stocked'
                            : covered ? 'Covered' : `${owned} of ${rec}`}
                          {prio && !covered && <span className={styles.prioStar}> ★</span>}
                        </div>
                      </div>
                      <div className={styles.slotActions}>
                        {!covered && (
                          <button
                            className={styles.addBtn}
                            onClick={() => addItem(slot)}
                          >+ Add</button>
                        )}
                        <button
                          className={`${styles.starBtn} ${prio ? styles.starBtnActive : ''}`}
                          onClick={() => togglePriority(slot)}
                          disabled={busy}
                          aria-label={prio ? 'Remove from registry priority' : 'Mark as priority on registry'}
                        >{prio ? '★' : '☆'}</button>
                      </div>
                    </div>
                  )
                })}

                {/* Share registry CTA — only on tier 1 */}
                {tier.id === 'day1' && (
                  <button
                    className={styles.shareBtn}
                    onClick={() => navigate('/registry/edit')}
                  >
                    🔗 Share your registry — let family &amp; friends fill these gaps
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
