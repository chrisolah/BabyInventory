import { useState, useEffect } from 'react'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { AGE_RANGES } from '../lib/wardrobe'
import styles from './ShareWishlistModal.module.css'

const ALL_CATS = ['clothing', 'sleep', 'feeding', 'diapering', 'travel', 'play', 'health', 'bath']
const NON_CLOTHING_CATS = ALL_CATS.filter(c => c !== 'clothing')
const CAT_LABEL = {
  clothing: 'Clothing', sleep: 'Sleep', feeding: 'Feeding', diapering: 'Diapering',
  travel: 'Travel', play: 'Play', health: 'Health', bath: 'Bath',
}

export default function ShareWishlistModal({ onClose }) {
  const { household } = useHousehold()
  const [phase, setPhase] = useState('loading') // 'loading' | 'setup' | 'active' | 'editing'
  const [share, setShare] = useState(null)
  const [claims, setClaims] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  // Form state — used for both setup and editing
  const [message, setMessage] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [showPriority, setShowPriority] = useState(true)
  const [includedCats, setIncludedCats] = useState(new Set(ALL_CATS))
  const [skipCats, setSkipCats] = useState(new Set())
  const [skipSizes, setSkipSizes] = useState(new Set())

  useEffect(() => {
    if (!household?.id) return
    loadShare()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id])

  async function loadShare() {
    setPhase('loading')
    const { data } = await supabase
      .schema(currentSchema)
      .from('wishlist_shares')
      .select('*')
      .eq('household_id', household.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    const active = data?.[0] ?? null
    if (active) {
      setShare(active)
      populateFormFromShare(active)
      const { data: claimsData } = await supabase
        .schema(currentSchema)
        .from('wishlist_claims')
        .select('*')
        .eq('share_id', active.id)
        .order('claimed_at', { ascending: true })
      setClaims(claimsData || [])
      setPhase('active')
    } else {
      setPhase('setup')
    }
  }

  function populateFormFromShare(s) {
    setMessage(s.message || '')
    setTargetDate(s.target_date || '')
    setShowPriority(s.show_priority !== false)
    setIncludedCats(new Set(s.included_categories || ALL_CATS))
    setSkipCats(new Set(s.skip_categories || []))
    setSkipSizes(new Set(s.skip_sizes || []))
  }

  function toggleIncluded(cat) {
    setIncludedCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function toggleSkip(cat) {
    setSkipCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function toggleSkipSize(size) {
    setSkipSizes(prev => {
      const next = new Set(prev)
      next.has(size) ? next.delete(size) : next.add(size)
      return next
    })
  }

  async function createShare() {
    if (!household?.id) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .schema(currentSchema)
      .from('wishlist_shares')
      .insert({
        household_id: household.id,
        message: message.trim() || null,
        target_date: targetDate || null,
        show_priority: showPriority,
        included_categories: includedCats.size < ALL_CATS.length ? [...includedCats] : null,
        skip_categories: skipCats.size > 0 ? [...skipCats] : null,
        skip_sizes: skipSizes.size > 0 ? [...skipSizes] : null,
      })
      .select()
      .single()
    setSaving(false)
    if (err) { setError('Something went wrong. Try again.'); return }
    setShare(data)
    setClaims([])
    setPhase('active')
  }

  async function saveEdits() {
    if (!share) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .schema(currentSchema)
      .from('wishlist_shares')
      .update({
        message: message.trim() || null,
        target_date: targetDate || null,
        show_priority: showPriority,
        included_categories: includedCats.size < ALL_CATS.length ? [...includedCats] : null,
        skip_categories: skipCats.size > 0 ? [...skipCats] : null,
        skip_sizes: skipSizes.size > 0 ? [...skipSizes] : null,
      })
      .eq('id', share.id)
      .select()
      .single()
    setSaving(false)
    if (err) { setError('Something went wrong. Try again.'); return }
    setShare(data)
    setPhase('active')
  }

  async function confirmAndDeactivate() {
    if (!share) return
    await supabase
      .schema(currentSchema)
      .from('wishlist_shares')
      .update({ is_active: false })
      .eq('id', share.id)
    setShare(null)
    setClaims([])
    setConfirmDeactivate(false)
    setMessage('')
    setTargetDate('')
    setShowPriority(true)
    setIncludedCats(new Set(ALL_CATS))
    setSkipCats(new Set())
    setSkipSizes(new Set())
    setPhase('setup')
  }

  const shareUrl = share ? `${window.location.origin}/wishlist/${share.token}` : ''

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: user can copy from the input manually
    }
  }

  function startEditing() {
    // populateFormFromShare was already called when we loaded; just switch phase
    setError(null)
    setPhase('editing')
  }

  function cancelEditing() {
    // Restore form to match current saved share before returning
    if (share) populateFormFromShare(share)
    setError(null)
    setPhase('active')
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const isFormPhase = phase === 'setup' || phase === 'editing'

  return (
    <div className={styles.overlay} onClick={onBackdropClick}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="swm-title">
        <div className={styles.modalHead}>
          <div className={styles.modalTitle} id="swm-title">
            {phase === 'active'  ? 'Wishlist link'        :
             phase === 'editing' ? 'Edit wishlist link'   :
                                   'Share your wishlist'}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {phase === 'loading' && (
          <div className={styles.loading}>Loading…</div>
        )}

        {isFormPhase && (
          <SharedForm
            isEditing={phase === 'editing'}
            message={message} setMessage={setMessage}
            targetDate={targetDate} setTargetDate={setTargetDate}
            showPriority={showPriority} setShowPriority={setShowPriority}
            includedCats={includedCats} onToggleIncluded={toggleIncluded}
            skipCats={skipCats} onToggleSkip={toggleSkip}
            skipSizes={skipSizes} onToggleSkipSize={toggleSkipSize}
            saving={saving} error={error}
            onSubmit={phase === 'editing' ? saveEdits : createShare}
            onCancel={phase === 'editing' ? cancelEditing : null}
          />
        )}

        {phase === 'active' && share && (
          <ActiveView
            shareUrl={shareUrl}
            copied={copied}
            onCopy={copyLink}
            claims={claims}
            share={share}
            confirmDeactivate={confirmDeactivate}
            onEdit={startEditing}
            onDeactivate={() => setConfirmDeactivate(true)}
            onDeactivateConfirm={confirmAndDeactivate}
            onDeactivateCancel={() => setConfirmDeactivate(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── Shared form (used for both setup and editing) ─────────────────────────────

function SharedForm({
  isEditing,
  message, setMessage,
  targetDate, setTargetDate,
  showPriority, setShowPriority,
  includedCats, onToggleIncluded,
  skipCats, onToggleSkip,
  skipSizes, onToggleSkipSize,
  saving, error,
  onSubmit, onCancel,
}) {
  const clothingIncluded = includedCats.has('clothing')

  return (
    <div className={styles.setupForm}>
      {!isEditing && (
        <p className={styles.sub}>
          Create a link to share with family and friends. They can see what you still need and claim items directly — no account required.
        </p>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="swm-message">Message (optional)</label>
        <textarea
          id="swm-message"
          className={styles.textarea}
          placeholder="Thanks for thinking of us! Here's what we still need…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={2}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="swm-date">Shower or due date (optional)</label>
        <input
          id="swm-date"
          type="date"
          className={styles.input}
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>What to include</label>
        <div className={styles.chipRow}>
          {ALL_CATS.map(cat => (
            <button
              key={cat}
              type="button"
              className={`${styles.chip} ${includedCats.has(cat) ? styles.chipActive : ''}`}
              onClick={() => onToggleIncluded(cat)}
            >
              {CAT_LABEL[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>We&rsquo;re well stocked on…</label>
        <p className={styles.fieldNote}>
          Recipients see a note to skip these. Select categories and/or specific clothing sizes you already have covered.
        </p>

        {/* Non-clothing category skip chips */}
        <div className={styles.chipRow}>
          {NON_CLOTHING_CATS.map(cat => (
            <button
              key={cat}
              type="button"
              className={`${styles.chip} ${skipCats.has(cat) ? styles.chipSkipActive : ''}`}
              onClick={() => onToggleSkip(cat)}
            >
              {CAT_LABEL[cat]}
            </button>
          ))}
        </div>

        {/* Clothing size skip chips — only shown if clothing is included */}
        {clothingIncluded && (
          <div className={styles.sizeSkipBlock}>
            <span className={styles.sizeSkipLabel}>Clothing sizes</span>
            <div className={styles.chipRow}>
              {AGE_RANGES.map(size => (
                <button
                  key={size}
                  type="button"
                  className={`${styles.chip} ${skipSizes.has(size) ? styles.chipSkipActive : ''}`}
                  onClick={() => onToggleSkipSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>Show priority items first</span>
        <button
          type="button"
          role="switch"
          aria-checked={showPriority}
          className={`${styles.toggle} ${showPriority ? styles.toggleOn : ''}`}
          onClick={() => setShowPriority(p => !p)}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.formBtns}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={onSubmit}
          disabled={saving || includedCats.size === 0}
        >
          {saving
            ? (isEditing ? 'Saving…' : 'Creating…')
            : (isEditing ? 'Save changes' : 'Create wishlist link')}
        </button>
        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
      {includedCats.size === 0 && (
        <p className={styles.disabledNote}>Select at least one category to include.</p>
      )}
    </div>
  )
}

// ── Active view ───────────────────────────────────────────────────────────────

function ActiveView({
  shareUrl, copied, onCopy, claims, share,
  confirmDeactivate, onEdit, onDeactivate, onDeactivateConfirm, onDeactivateCancel,
}) {
  // Group claims by slot_id + slot_type + size_label
  const claimGroups = []
  const seen = {}
  for (const c of claims) {
    const key = `${c.slot_type}:${c.slot_id}:${c.size_label || ''}`
    if (!seen[key]) {
      seen[key] = { slot_id: c.slot_id, slot_type: c.slot_type, size_label: c.size_label, claimers: [] }
      claimGroups.push(seen[key])
    }
    seen[key].claimers.push({ name: c.claimer_name, quantity: c.quantity })
  }

  function slotLabel(group) {
    const label = group.slot_id.replace(/_/g, ' ')
    return group.size_label ? `${label} · ${group.size_label}` : label
  }

  const CAT_LABEL = {
    clothing: 'Clothing', sleep: 'Sleep', feeding: 'Feeding', diapering: 'Diapering',
    travel: 'Travel', play: 'Play', health: 'Health', bath: 'Bath',
  }

  const includedList = share.included_categories
    ? share.included_categories.map(c => CAT_LABEL[c] || c).join(', ')
    : 'All categories'

  const skipParts = []
  if (share.skip_categories?.length) {
    skipParts.push(...share.skip_categories.map(c => CAT_LABEL[c] || c))
  }
  if (share.skip_sizes?.length) {
    skipParts.push(`Clothing ${share.skip_sizes.join(', ')}`)
  }
  const skipList = skipParts.length ? skipParts.join('; ') : null

  return (
    <div className={styles.activeView}>
      <p className={styles.sub}>
        Share this link with family and friends. They can view your gaps and claim items without signing up.
      </p>

      <div className={styles.linkRow}>
        <input
          readOnly
          className={styles.linkInput}
          value={shareUrl}
          onFocus={e => e.target.select()}
          aria-label="Wishlist share URL"
        />
        <button
          type="button"
          className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
          onClick={onCopy}
        >
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
      </div>

      {/* ── Current settings summary ── */}
      <div className={styles.settingsSummary}>
        <div className={styles.settingsRow}>
          <span className={styles.settingsKey}>Includes</span>
          <span className={styles.settingsVal}>{includedList}</span>
        </div>
        {skipList && (
          <div className={styles.settingsRow}>
            <span className={styles.settingsKey}>Skip notice</span>
            <span className={styles.settingsVal}>{skipList}</span>
          </div>
        )}
        {share.target_date && (
          <div className={styles.settingsRow}>
            <span className={styles.settingsKey}>Date</span>
            <span className={styles.settingsVal}>{formatDate(share.target_date)}</span>
          </div>
        )}
        {share.message && (
          <div className={styles.settingsRow}>
            <span className={styles.settingsKey}>Message</span>
            <span className={styles.settingsVal}>&ldquo;{share.message.length > 60 ? share.message.slice(0, 60) + '…' : share.message}&rdquo;</span>
          </div>
        )}
        <button type="button" className={styles.editSettingsBtn} onClick={onEdit}>
          Edit settings
        </button>
      </div>

      <div className={styles.claimsHeader}>
        <span className={styles.sectionTitle}>
          {claims.length === 0
            ? 'No claims yet'
            : `${claims.length} ${claims.length === 1 ? 'claim' : 'claims'}`}
        </span>
      </div>

      {claimGroups.length > 0 && (
        <div className={styles.claimsList}>
          {claimGroups.map(group => (
            <div
              key={`${group.slot_type}:${group.slot_id}:${group.size_label}`}
              className={styles.claimGroup}
            >
              <span className={styles.claimSlot}>{slotLabel(group)}</span>
              <span className={styles.claimNames}>
                {group.claimers
                  .map(c => `${c.name}${c.quantity > 1 ? ` ×${c.quantity}` : ''}`)
                  .join(', ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {claims.length === 0 && (
        <p className={styles.noClaims}>
          When someone claims an item from your link, you'll see it here.
        </p>
      )}

      <div className={styles.deactivateZone}>
        {!confirmDeactivate ? (
          <button type="button" className={styles.deactivateBtn} onClick={onDeactivate}>
            Deactivate link
          </button>
        ) : (
          <div className={styles.deactivateConfirm}>
            <span className={styles.deactivateWarning}>
              This will break the existing link. Anyone with it won't be able to view or claim items.
            </span>
            <div className={styles.deactivateBtns}>
              <button type="button" className={styles.deactivateConfirmBtn} onClick={onDeactivateConfirm}>
                Yes, deactivate
              </button>
              <button type="button" className={styles.deactivateCancelBtn} onClick={onDeactivateCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}
