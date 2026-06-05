import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { SLOTS } from '../lib/wardrobe'
import { ITEMS as ITEM_DEFS, CATEGORY_META } from '../lib/categories'
import ShareWishlistModal from '../components/ShareWishlistModal'
import BottomNav from '../components/BottomNav'
import styles from './WishlistEdit.module.css'

// Lookup maps
const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]))
const ITEM_BY_ID = Object.fromEntries(ITEM_DEFS.map(i => [i.id, i]))

function getItemLabel(item) {
  if (item.top_category === 'clothing') {
    const slot = SLOT_BY_ID[item.item_type]
    return item.name || item.brand || slot?.label || item.item_type
  }
  const def = ITEM_BY_ID[item.item_type]
  return item.name || item.brand || def?.label || item.item_type
}

function getItemSub(item) {
  const parts = []
  if (item.size_label) parts.push(item.size_label)
  if (item.top_category !== 'clothing') {
    const cat = CATEGORY_META[item.top_category]
    if (cat?.label) parts.push(cat.label)
  }
  return parts.join(' · ')
}

export default function WishlistEdit() {
  const navigate = useNavigate()
  const { items, reloadItems, selectedBabyId, babies, currentBaby, household } = useHousehold()
  const [mode, setMode] = useState('edit') // 'edit' | 'preview'
  const [showShareModal, setShowShareModal] = useState(false)
  const [working, setWorking] = useState(new Set())
  const [shareToken, setShareToken] = useState(null)

  // Wishlist = all items with inventory_status === 'needed'
  const wishlistItems = items.filter(it => it.inventory_status === 'needed')

  // Local ordered list — starts from DB order, reordered by drag
  const [orderedIds, setOrderedIds] = useState(() => wishlistItems.map(it => it.id))

  // Sync when items change
  useEffect(() => {
    const existingIds = new Set(orderedIds)
    const newIds = wishlistItems.map(it => it.id).filter(id => !existingIds.has(id))
    const validIds = orderedIds.filter(id => wishlistItems.find(it => it.id === id))
    setOrderedIds([...validIds, ...newIds])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Fetch share token for preview
  useEffect(() => {
    if (!household?.id) return
    supabase.schema(currentSchema)
      .from('wishlist_shares')
      .select('token')
      .eq('household_id', household.id)
      .eq('is_active', true)
      .limit(1)
      .single()
      .then(({ data }) => { if (data?.token) setShareToken(data.token) })
  }, [household?.id])

  const orderedItems = orderedIds
    .map(id => wishlistItems.find(it => it.id === id))
    .filter(Boolean)

  const priorityItems = orderedItems.filter(it => it.is_priority)
  const regularItems  = orderedItems.filter(it => !it.is_priority)

  // ── Toggle priority ──
  const togglePriority = useCallback(async (item) => {
    const id = item.id
    setWorking(prev => new Set([...prev, id]))
    const table = item.top_category === 'clothing' ? 'clothing_items' : 'items'
    await supabase.schema(currentSchema)
      .from(table)
      .update({ is_priority: !item.is_priority })
      .eq('id', id)
    await reloadItems()
    setWorking(prev => { const s = new Set(prev); s.delete(id); return s })
  }, [reloadItems])

  // ── Remove from wishlist ──
  const removeItem = useCallback(async (item) => {
    const id = item.id
    setWorking(prev => new Set([...prev, id]))
    const table = item.top_category === 'clothing' ? 'clothing_items' : 'items'
    await supabase.schema(currentSchema)
      .from(table)
      .update({ inventory_status: 'owned' })
      .eq('id', id)
    await reloadItems()
    setWorking(prev => { const s = new Set(prev); s.delete(id); return s })
  }, [reloadItems])

  // ── Drag and drop (HTML5 + touch fallback) ──
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  function handleDragStart(id) {
    dragItem.current = id
  }

  function handleDragEnter(id) {
    dragOver.current = id
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOver.current === null) return
    if (dragItem.current === dragOver.current) { dragItem.current = null; dragOver.current = null; return }
    setOrderedIds(prev => {
      const list = [...prev]
      const fromIdx = list.indexOf(dragItem.current)
      const toIdx   = list.indexOf(dragOver.current)
      if (fromIdx === -1 || toIdx === -1) return prev
      list.splice(fromIdx, 1)
      list.splice(toIdx, 0, dragItem.current)
      return list
    })
    dragItem.current = null
    dragOver.current = null
  }

  // ── Move up/down (accessible fallback) ──
  function moveItem(id, dir) {
    setOrderedIds(prev => {
      const list = [...prev]
      const idx = list.indexOf(id)
      const target = idx + dir
      if (target < 0 || target >= list.length) return prev
      ;[list[idx], list[target]] = [list[target], list[idx]]
      return list
    })
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className={styles.headerTitle}>Edit Wishlist</div>
        <button
          className={styles.shareBtn}
          onClick={() => setShowShareModal(true)}
        >
          Share
        </button>
      </header>

      {/* Mode toggle */}
      <div className={styles.modeBar}>
        <button
          className={`${styles.modeBtn} ${mode === 'edit' ? styles.modeBtnActive : ''}`}
          onClick={() => setMode('edit')}
        >
          Edit
        </button>
        <button
          className={`${styles.modeBtn} ${mode === 'preview' ? styles.modeBtnActive : ''}`}
          onClick={() => setMode('preview')}
        >
          Preview
        </button>
      </div>

      {mode === 'edit' ? (
        <main className={styles.body}>
          {wishlistItems.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyEmoji}>🌱</div>
              <p className={styles.emptyText}>No items on your wishlist yet.</p>
              <button className={styles.emptyBtn} onClick={() => navigate('/add-item?mode=needed')}>
                Add items
              </button>
            </div>
          ) : (
            <>
              {priorityItems.length > 0 && (
                <section>
                  <div className={styles.sectionLabel}>⭐ Most needed</div>
                  {priorityItems.map((item, idx) => (
                    <WishlistRow
                      key={item.id}
                      item={item}
                      working={working.has(item.id)}
                      onPriority={togglePriority}
                      onRemove={removeItem}
                      onDragStart={handleDragStart}
                      onDragEnter={handleDragEnter}
                      onDragEnd={handleDragEnd}
                      onMoveUp={idx > 0 ? () => moveItem(item.id, -1) : null}
                      onMoveDown={idx < priorityItems.length - 1 ? () => moveItem(item.id, 1) : null}
                    />
                  ))}
                </section>
              )}

              {regularItems.length > 0 && (
                <section>
                  <div className={styles.sectionLabel}>All items</div>
                  {regularItems.map((item, idx) => (
                    <WishlistRow
                      key={item.id}
                      item={item}
                      working={working.has(item.id)}
                      onPriority={togglePriority}
                      onRemove={removeItem}
                      onDragStart={handleDragStart}
                      onDragEnter={handleDragEnter}
                      onDragEnd={handleDragEnd}
                      onMoveUp={idx > 0 ? () => moveItem(item.id, -1) : null}
                      onMoveDown={idx < regularItems.length - 1 ? () => moveItem(item.id, 1) : null}
                    />
                  ))}
                </section>
              )}

              <button
                className={styles.addMoreBtn}
                onClick={() => navigate('/add-item?mode=needed')}
              >
                + Add more items
              </button>
            </>
          )}
        </main>
      ) : (
        /* Preview — iframe of the public wishlist page */
        <div className={styles.previewWrap}>
          {shareToken ? (
            <>
              <div className={styles.previewNote}>
                This is exactly what family sees when you share your link.
              </div>
              <iframe
                className={styles.previewFrame}
                src={`/wishlist/${shareToken}`}
                title="Wishlist preview"
              />
            </>
          ) : (
            <div className={styles.previewEmpty}>
              <div className={styles.previewEmptyText}>
                Create a shareable link to see the preview.
              </div>
              <button className={styles.shareBtn} onClick={() => setShowShareModal(true)}>
                Create share link
              </button>
            </div>
          )}
        </div>
      )}

      <BottomNav />
      {showShareModal && <ShareWishlistModal onClose={() => setShowShareModal(false)} />}
    </div>
  )
}

function WishlistRow({ item, working, onPriority, onRemove, onDragStart, onDragEnter, onDragEnd, onMoveUp, onMoveDown }) {
  const label = getItemLabel(item)
  const sub   = getItemSub(item)

  return (
    <div
      className={`${styles.row} ${working ? styles.rowWorking : ''}`}
      draggable
      onDragStart={() => onDragStart(item.id)}
      onDragEnter={() => onDragEnter(item.id)}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
    >
      {/* Drag handle */}
      <span className={styles.dragHandle} aria-hidden="true">⠿</span>

      {/* Item info */}
      <div className={styles.rowInfo}>
        <div className={styles.rowLabel}>{label}</div>
        {sub && <div className={styles.rowSub}>{sub}</div>}
      </div>

      {/* Controls */}
      <div className={styles.rowControls}>
        {/* Move up/down (accessible) */}
        <div className={styles.moveButtons}>
          <button
            className={styles.moveBtn}
            onClick={onMoveUp}
            disabled={!onMoveUp || working}
            aria-label="Move up"
          >↑</button>
          <button
            className={styles.moveBtn}
            onClick={onMoveDown}
            disabled={!onMoveDown || working}
            aria-label="Move down"
          >↓</button>
        </div>

        {/* Priority star */}
        <button
          className={`${styles.starBtn} ${item.is_priority ? styles.starBtnActive : ''}`}
          onClick={() => onPriority(item)}
          disabled={working}
          aria-label={item.is_priority ? 'Remove from most needed' : 'Mark as most needed'}
          title={item.is_priority ? 'Remove from Most Needed' : 'Add to Most Needed'}
        >
          {item.is_priority ? '★' : '☆'}
        </button>

        {/* Remove */}
        <button
          className={styles.removeBtn}
          onClick={() => onRemove(item)}
          disabled={working}
          aria-label={`Remove ${label} from wishlist`}
        >
          ×
        </button>
      </div>
    </div>
  )
}
