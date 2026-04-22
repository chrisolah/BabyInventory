import { useState } from 'react'
import { supabase, currentSchema } from '../lib/supabase'
import { track } from '../lib/analytics'
import { AGE_RANGES } from '../lib/wardrobe'
import styles from './BabyFormModal.module.css'

// Add / edit / remove a baby. One modal covers all three actions so the
// fields + layout stay consistent across the household-management surface.
//
// Props:
//   mode: 'create' | 'edit'
//   household: { id, name } — only used on create (to set household_id)
//   baby: row from beta.babies — required on edit
//   onClose() — user backed out without persisting
//   onSaved(action: 'created' | 'updated' | 'removed') — write succeeded
//
// Remove flow lives in this component (only on edit). The product decision
// is: block deletion if any clothing_items reference the baby. Parents can
// mark those items outgrown (existing flow) first if they really want a
// clean slate. Rationale noted in repo memory.

const SIZE_MODES = [
  { value: 'by_age',    label: 'By age' },
  { value: 'by_weight', label: 'By weight' },
  { value: 'both',      label: 'Both' },
]

export default function BabyFormModal({ mode, household, baby, onClose, onSaved }) {
  const isEdit = mode === 'edit'

  // ── Form state ──────────────────────────────────────────────────────
  // Default birthMode: edit keeps whichever date the row already has;
  // create defaults to 'born' because that's the common case (most users
  // add babies post-partum). Expecting parents switch explicitly.
  const [name, setName] = useState(baby?.name ?? '')
  const [birthMode, setBirthMode] = useState(
    baby?.date_of_birth ? 'born' :
    baby?.due_date      ? 'expecting' :
    'born'
  )
  const [dateStr, setDateStr] = useState(
    baby?.date_of_birth ?? baby?.due_date ?? ''
  )
  const [gender, setGender] = useState(baby?.gender ?? null)
  const [sizeMode, setSizeMode] = useState(baby?.size_mode ?? 'by_age')
  // Optional manual age-band override. Empty string = "Auto" (follow DOB).
  // Stored as null in the DB so downstream consumers (inferAgeRange, RLS
  // policies if we add any) don't have to special-case the empty string.
  const [ageRangeOverride, setAgeRangeOverride] = useState(
    baby?.age_range_override ?? ''
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // ── Remove state (edit mode only) ───────────────────────────────────
  //   idle       → no remove attempt yet
  //   confirming → passed the items-check, showing "are you sure"
  //   blocked    → items exist; show inline block message with count
  //   removing   → delete in flight
  const [removeState, setRemoveState] = useState('idle')
  const [blockedItemCount, setBlockedItemCount] = useState(null)

  function close() {
    if (saving || removeState === 'removing') return
    onClose()
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) close()
  }

  // ── Save (create or edit) ───────────────────────────────────────────
  async function save(e) {
    e.preventDefault()
    if (!dateStr) return

    setSaving(true)
    setError(null)

    // DB constraint: either date_of_birth OR due_date must be present.
    // The birthMode toggle picks which column gets the ISO date string.
    const row = {
      name: name.trim() || null,
      gender: gender || null,
      size_mode: sizeMode,
      date_of_birth: birthMode === 'born' ? dateStr : null,
      due_date: birthMode === 'expecting' ? dateStr : null,
      age_range_override: ageRangeOverride || null,
    }

    let supErr
    if (isEdit) {
      const { error: updateErr } = await supabase
        .schema(currentSchema)
        .from('babies')
        .update(row)
        .eq('id', baby.id)
      supErr = updateErr
    } else {
      const { error: insertErr } = await supabase
        .schema(currentSchema)
        .from('babies')
        .insert({ household_id: household.id, ...row })
      supErr = insertErr
    }

    setSaving(false)

    if (supErr) {
      setError(supErr.message)
      return
    }

    if (isEdit) {
      track.babyEdited({ mode: birthMode, has_gender: !!gender })
      onSaved('updated')
    } else {
      track.babyAdded({ mode: birthMode, has_gender: !!gender })
      onSaved('created')
    }
  }

  // ── Remove flow ─────────────────────────────────────────────────────
  // Step 1: user clicks Remove. Before showing the confirm, we check for
  // any clothing_items referencing this baby. If any exist, we block.
  async function requestRemove() {
    setError(null)

    const { count, error: countErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .select('id', { count: 'exact', head: true })
      .eq('baby_id', baby.id)

    if (countErr) {
      setError(countErr.message)
      return
    }

    if ((count ?? 0) > 0) {
      setBlockedItemCount(count)
      setRemoveState('blocked')
      track.babyRemovalBlocked({ items: count })
      return
    }

    setRemoveState('confirming')
  }

  async function confirmRemove() {
    setRemoveState('removing')
    setError(null)

    const { error: delErr } = await supabase
      .schema(currentSchema)
      .from('babies')
      .delete()
      .eq('id', baby.id)

    if (delErr) {
      setRemoveState('idle')
      setError(delErr.message)
      return
    }

    track.babyRemoved({
      had_dob: !!baby.date_of_birth,
      had_due_date: !!baby.due_date,
    })
    onSaved('removed')
  }

  // ── Render ──────────────────────────────────────────────────────────
  const title = isEdit
    ? (baby?.name ? `Edit ${baby.name}` : 'Edit baby')
    : 'Add another baby'

  return (
    <div className={styles.overlay} onClick={onBackdropClick}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{title}</div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label="Close"
            disabled={saving || removeState === 'removing'}
          >
            ×
          </button>
        </div>

        {!isEdit && (
          <p className={styles.modalSub}>
            Twins, triplets, a sibling on the way — bring &rsquo;em all. Each
            baby gets their own inventory so sizes and gaps stay separate.
          </p>
        )}

        <form onSubmit={save}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="bf-name">
              Name <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="bf-name"
              className={styles.input}
              type="text"
              placeholder="Haven&rsquo;t picked one? That&rsquo;s fine too."
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus={!isEdit}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Born or expecting?</label>
            <div className={styles.segToggle}>
              <button
                type="button"
                className={`${styles.segBtn} ${birthMode === 'born' ? styles.segActive : ''}`}
                onClick={() => setBirthMode('born')}
              >
                Born
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${birthMode === 'expecting' ? styles.segActive : ''}`}
                onClick={() => setBirthMode('expecting')}
              >
                Expecting
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="bf-date">
              {birthMode === 'born' ? 'Date of birth' : 'Due date'}
            </label>
            <input
              id="bf-date"
              className={styles.input}
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Gender</label>
            <div className={styles.genderRow}>
              {[
                { v: 'girl',    label: 'Girl' },
                { v: 'boy',     label: 'Boy' },
                { v: 'neutral', label: 'Neutral' },
                { v: null,      label: 'Skip' },
              ].map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  className={`${styles.genderBtn} ${gender === opt.v ? styles.genderActive : ''}`}
                  onClick={() => setGender(opt.v)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="bf-sizemode">Size tracking</label>
            <select
              id="bf-sizemode"
              className={styles.input}
              value={sizeMode}
              onChange={e => setSizeMode(e.target.value)}
            >
              {SIZE_MODES.map(sm => (
                <option key={sm.value} value={sm.value}>{sm.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="bf-age-override">
              Current size band
            </label>
            <select
              id="bf-age-override"
              className={styles.input}
              value={ageRangeOverride}
              onChange={e => setAgeRangeOverride(e.target.value)}
            >
              <option value="">Auto (based on age)</option>
              {AGE_RANGES.map(range => (
                <option key={range} value={range}>{range}</option>
              ))}
            </select>
            <div className={styles.helperText}>
              Big or small for their age? Pin the band you actually shop in
              and we&rsquo;ll stop using their birthday to guess.
            </div>
          </div>

          {error && (
            <div className={styles.error}>{error}</div>
          )}

          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={saving || !dateStr || removeState !== 'idle'}
          >
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add baby')}
          </button>
        </form>

        {/* Remove flow — only surfaces on edit, and only when the form
            isn't already mid-save. Block + confirm states are rendered
            inline beneath the primary form so the user stays in context
            instead of getting a stacked second modal. */}
        {isEdit && (
          <div className={styles.removeArea}>
            {removeState === 'idle' && (
              <button
                type="button"
                className={styles.removeLink}
                onClick={requestRemove}
                disabled={saving}
              >
                Remove this baby
              </button>
            )}

            {removeState === 'blocked' && (
              <div className={styles.blockedBox}>
                <div className={styles.blockedTitle}>
                  Can&rsquo;t remove yet
                </div>
                <div className={styles.blockedBody}>
                  {baby?.name || 'This baby'} has{' '}
                  <strong>{blockedItemCount}</strong>{' '}
                  {blockedItemCount === 1 ? 'item' : 'items'} in their
                  wardrobe. Move or delete those first, then try again.
                </div>
                <button
                  type="button"
                  className={styles.blockedBtn}
                  onClick={() => setRemoveState('idle')}
                >
                  OK
                </button>
              </div>
            )}

            {(removeState === 'confirming' || removeState === 'removing') && (
              <div className={styles.confirmBox}>
                <div className={styles.confirmTitle}>
                  Remove {baby?.name || 'this baby'}?
                </div>
                <div className={styles.confirmBody}>
                  This can&rsquo;t be undone.
                </div>
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    className={styles.confirmCancel}
                    onClick={() => setRemoveState('idle')}
                    disabled={removeState === 'removing'}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.confirmGo}
                    onClick={confirmRemove}
                    disabled={removeState === 'removing'}
                  >
                    {removeState === 'removing' ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
