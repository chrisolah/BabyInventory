import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { SLOTS, AGE_RANGES, recommendedQty } from '../lib/wardrobe'
import { ITEMS as ITEM_DEFS, CATEGORY_META } from '../lib/categories'
import ShareWishlistModal from '../components/ShareWishlistModal'
import BottomNav from '../components/BottomNav'
import styles from './WishlistEdit.module.css'

const SLOT_BY_ID  = Object.fromEntries(SLOTS.map(s => [s.id, s]))
const ITEM_BY_ID  = Object.fromEntries(ITEM_DEFS.map(i => [i.id, i]))

const NON_CLOTHING_ORDER = ['sleep','feeding','diapering','travel','play','health','bath']

function getLabel(item) {
  if (item.top_category === 'clothing') {
    const slot = SLOT_BY_ID[item.item_type]
    return item.name || item.brand || slot?.label || item.item_type
  }
  const def = ITEM_BY_ID[item.item_type]
  return item.name || item.brand || def?.label || item.item_type
}

function getCatLabel(cat) {
  return CATEGORY_META[cat]?.label || cat
}

export default function WishlistEdit() {
  const navigate  = useNavigate()
  const { items, reloadItems, household, babies, currentBaby } = useHousehold()
  const [showShareModal, setShowShareModal] = useState(false)
  const [working, setWorking] = useState(new Set())

  const wishlist = items.filter(it => it.inventory_status === 'needed')

  // Local ordered ids for drag reorder
  const [orderedIds, setOrderedIds] = useState(() => wishlist.map(it => it.id))
  useEffect(() => {
    const valid = orderedIds.filter(id => wishlist.find(it => it.id === id))
    const newIds = wishlist.map(it => it.id).filter(id => !orderedIds.includes(id))
    setOrderedIds([...valid, ...newIds])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const orderedWishlist = orderedIds.map(id => wishlist.find(it => it.id === id)).filter(Boolean)

  const priorityItems  = orderedWishlist.filter(it => it.is_priority)
  const clothingItems  = orderedWishlist.filter(it => !it.is_priority && it.top_category === 'clothing')
  const nonClothingItems = orderedWishlist.filter(it => !it.is_priority && it.top_category !== 'clothing')

  // Group clothing by size
  const clothingBySize = {}
  for (const item of clothingItems) {
    const size = item.size_label || 'No size'
    if (!clothingBySize[size]) clothingBySize[size] = []
    clothingBySize[size].push(item)
  }
  const sizes = AGE_RANGES.filter(s => clothingBySize[s]?.length > 0)

  // Group non-clothing by category
  const byCat = {}
  for (const item of nonClothingItems) {
    if (!byCat[item.top_category]) byCat[item.top_category] = []
    byCat[item.top_category].push(item)
  }
  const usedCats = NON_CLOTHING_ORDER.filter(c => byCat[c]?.length > 0)

  const togglePriority = useCallback(async (item) => {
    const id = item.id
    setWorking(prev => new Set([...prev, id]))
    const table = item.top_category === 'clothing' ? 'clothing_items' : 'items'
    await supabase.schema(currentSchema).from(table)
      .update({ is_priority: !item.is_priority }).eq('id', id)
    await reloadItems()
    setWorking(prev => { const s = new Set(prev); s.delete(id); return s })
  }, [reloadItems])

  const removeItem = useCallback(async (item) => {
    const id = item.id
    setWorking(prev => new Set([...prev, id]))
    const table = item.top_category === 'clothing' ? 'clothing_items' : 'items'
    await supabase.schema(currentSchema).from(table)
      .update({ inventory_status: 'owned' }).eq('id', id)
    await reloadItems()
    setWorking(prev => { const s = new Set(prev); s.delete(id); return s })
  }, [reloadItems])

  // Drag to reorder
  const dragItem = useRef(null)
  const dragOver = useRef(null)
  function handleDragStart(id) { dragItem.current = id }
  function handleDragEnter(id) { dragOver.current = id }
  function handleDragEnd() {
    if (!dragItem.current || !dragOver.current || dragItem.current === dragOver.current) {
      dragItem.current = null; dragOver.current = null; return
    }
    setOrderedIds(prev => {
      const list = [...prev]
      const from = list.indexOf(dragItem.current)
      const to   = list.indexOf(dragOver.current)
      if (from === -1 || to === -1) return prev
      list.splice(from, 1); list.splice(to, 0, dragItem.current)
      return list
    })
    dragItem.current = null; dragOver.current = null
  }

  const babyName = currentBaby?.name || babies[0]?.name || null
  const householdName = household?.name || 'Your'

  return (
    <div className={styles.page}>

      {/* Header — mirrors public wishlist style */}
      <header className={styles.hero}>
        <div className={styles.heroTopbar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Back">←</button>
          <div className={styles.heroActions}>
            <button className={styles.shareBtn}
              onClick={() => setShowShareModal(true)}>
              Share
            </button>
          </div>
        </div>
        <div className={styles.heroEyebrow}>Baby Wishlist</div>
        <h1 className={styles.heroTitle}>{householdName}&apos;s Wishlist</h1>
        {babyName && <div className={styles.heroBabyPill}>{babyName}</div>}
        <p className={styles.heroHint}>
          Star items to mark them as most needed. Drag to reorder. Tap × to remove.
        </p>
      </header>

      <div className={styles.body}>

        {wishlist.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyEmoji}>🌱</div>
            <p className={styles.emptyText}>Nothing on your wishlist yet.</p>
            <button className={styles.emptyBtn} onClick={() => navigate('/add-item?mode=needed')}>
              Add items
            </button>
          </div>
        )}

        {/* Most needed */}
        {priorityItems.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionToggle}>
              <span className={styles.priorityStar}>★</span>
              <span className={styles.sectionTitle}>Most needed</span>
              <span className={styles.badge}>{priorityItems.length} items</span>
            </div>
            <div className={styles.cardGrid}>
              {priorityItems.map(item => (
                <EditCard key={item.id} item={item}
                  working={working.has(item.id)}
                  onPriority={togglePriority} onRemove={removeItem}
                  onDragStart={handleDragStart} onDragEnter={handleDragEnter}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </section>
        )}

        {/* Clothing by size */}
        {clothingItems.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionStaticHead}>
              <h2 className={styles.sectionTitle}>Clothing</h2>
            </div>
            {sizes.map(size => (
              <div key={size} className={styles.sizeGroup}>
                <div className={styles.sizeChip}>{size}</div>
                <div className={styles.cardGrid}>
                  {clothingBySize[size].map(item => (
                    <EditCard key={item.id} item={item}
                      working={working.has(item.id)}
                      onPriority={togglePriority} onRemove={removeItem}
                      onDragStart={handleDragStart} onDragEnter={handleDragEnter}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Non-clothing by category */}
        {usedCats.map(cat => (
          <section key={cat} className={styles.section}>
            <div className={styles.sectionStaticHead}>
              <h2 className={styles.sectionTitle}>{getCatLabel(cat)}</h2>
            </div>
            <div className={styles.cardGrid}>
              {byCat[cat].map(item => (
                <EditCard key={item.id} item={item}
                  working={working.has(item.id)}
                  onPriority={togglePriority} onRemove={removeItem}
                  onDragStart={handleDragStart} onDragEnter={handleDragEnter}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </section>
        ))}

        {wishlist.length > 0 && (
          <button className={styles.addMoreBtn}
            onClick={() => navigate('/add-item?mode=needed')}>
            + Add more items
          </button>
        )}
      </div>

      <BottomNav />
      {showShareModal && <ShareWishlistModal onClose={() => setShowShareModal(false)} />}
    </div>
  )
}

// ── Edit card — looks like a WishlistPublic card with overlaid controls ──
function EditCard({ item, working, onPriority, onRemove, onDragStart, onDragEnter, onDragEnd }) {
  const label = getLabel(item)
  const size  = item.size_label || null

  return (
    <div
      className={`${styles.card} ${working ? styles.cardWorking : ''}`}
      draggable
      onDragStart={() => onDragStart(item.id)}
      onDragEnter={() => onDragEnter(item.id)}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
    >
      {/* Card content */}
      <div className={styles.cardMain}>
        <span className={styles.cardLabel}>{label}</span>
        {size && <span className={styles.cardSize}>{size}</span>}
      </div>

      {/* Edit controls */}
      <div className={styles.cardControls}>
        <button
          className={`${styles.starBtn} ${item.is_priority ? styles.starBtnActive : ''}`}
          onClick={() => onPriority(item)}
          disabled={working}
          aria-label={item.is_priority ? 'Remove from most needed' : 'Mark as most needed'}
        >
          {item.is_priority ? '★' : '☆'}
        </button>
        <button
          className={styles.removeBtn}
          onClick={() => onRemove(item)}
          disabled={working}
          aria-label={`Remove ${label}`}
        >×</button>
      </div>

      {/* Drag hint */}
      <span className={styles.dragHandle} aria-hidden="true">⠿</span>
    </div>
  )
}
