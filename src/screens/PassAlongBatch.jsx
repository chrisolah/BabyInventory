import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold, matchesBabyFilter } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import { SLOT_BY_ID, CATEGORY_LABELS } from '../lib/wardrobe'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import styles from './PassAlongBatch.module.css'

// PassAlongBatch — the sender-side detail screen for a community exchange
// "batch" (one physical bag — Sprigloop-issued, prepaid). Route: /pass-along/:id
//
// A batch has three destination types, each with a slightly different
// lifecycle (see migration 010 + the merge migration that folded the
// old 'littleloop' destination into 'family'):
//   • family     : draft → shipped → received → fulfilled     (HQ forwards to matched household, or donates if no match)
//   • person     : draft → shipped → fulfilled (auto)         (direct to someone)
//   • charity    : draft → shipped → fulfilled (auto)         (direct to a charity)
//
// Responsibilities:
//   1. Show everything the sender needs in one scrollable view: ref code,
//      destination choice, recipient info (when relevant), items packed,
//      packing instructions, a timeline of where the bag is in its life,
//      and any notes.
//   2. Let the sender edit the batch while it's a draft — change
//      destination, fill in recipient details, remove items, write notes.
//      Once shipped, everything goes read-only.
//   3. Provide the primary "I've shipped it" action. For person/charity
//      this auto-advances status to fulfilled with an outcome ('matched'
//      for person, 'donated' for charity) since Sprigloop isn't in that
//      path. For family, it just flags shipped and HQ takes over from there.
//   4. Offer "Request a Sprigloop bag" as a secondary CTA — for ALL three
//      destinations now that every batch ships via a Sprigloop-issued bag
//      (prelabeled-to-HQ for family; blank-label flat-rate for person /
//      charity). Writes label_requested_at + label_request_address on the
//      batch — same column shape, new semantic: "when the user asked for
//      the bag" + "where to ship the bag TO the user." A bag-dispatch
//      concierge_tasks row gets dropped for Chris's queue.
//   5. Allow deleting a draft batch (RLS enforces draft-only deletes too).
//      Deleting a batch returns its items to 'owned' status so nothing is
//      silently lost.
//
// Items-in-batch are fetched via a secondary query against clothing_items.
// Removing an item just nulls the FK + flips inventory_status back to
// 'owned'; it doesn't delete the item itself.

const DESTINATION_OPTIONS = [
  {
    id: 'family',
    label: 'Send to a Sprigloop family',
    sub: 'Ships to us in a prepaid Sprigloop bag. We forward to a matched family, or donate if no match. Addresses stay private on both ends.',
  },
  {
    id: 'person',
    label: 'A friend or family member',
    sub: 'Ships in a prepaid Sprigloop bag, addressed by you to a sibling, friend, or neighbor with a new baby.',
  },
  {
    id: 'charity',
    label: 'A charity',
    sub: 'Ships in a prepaid Sprigloop bag, addressed by you to a local Goodwill, shelter, or nonprofit you trust.',
  },
]

const STATUS_LABEL = {
  draft:           'Draft',
  bag_requested:   'Bag requested',
  bag_in_transit:  'Bag on its way',
  shipped:         'Shipped',
  received:        'Received at Sprigloop',
  fulfilled:       'Fulfilled',
  canceled:        'Canceled',
}

// Per-destination timeline shape. Each stage is `{ key, label }`. The key
// matches a status or a synthetic "fulfilled_matched" / "fulfilled_donated"
// tag we compose below so copy can diverge at the end.
//
// All three destinations now share the same first-three steps: draft →
// bag_requested → bag_in_transit. After that the family path has the
// extra HQ-side received → fulfilled steps; person/charity collapse the
// final user action straight into a fulfilled outcome.
function timelineFor(destination) {
  if (destination === 'person') {
    return [
      { key: 'draft',            label: 'Draft' },
      { key: 'bag_requested',    label: 'Bag requested' },
      { key: 'bag_in_transit',   label: 'Bag on its way to you' },
      { key: 'fulfilled_matched', label: 'Delivered' },
    ]
  }
  if (destination === 'charity') {
    return [
      { key: 'draft',            label: 'Draft' },
      { key: 'bag_requested',    label: 'Bag requested' },
      { key: 'bag_in_transit',   label: 'Bag on its way to you' },
      { key: 'fulfilled_donated', label: 'Donated' },
    ]
  }
  // family is the only HQ-routed path: ships to Sprigloop, gets received,
  // then forwarded to a matched household (or donated if no match).
  return [
    { key: 'draft',          label: 'Draft' },
    { key: 'bag_requested',  label: 'Bag requested' },
    { key: 'bag_in_transit', label: 'Bag on its way to you' },
    { key: 'shipped',        label: 'Shipped to Sprigloop' },
    { key: 'received',       label: 'Received' },
    { key: 'fulfilled',      label: 'Forwarded to family' },
  ]
}

// Map a batch row to the current timeline key so the timeline component
// can decide which steps are "done," "current," and "upcoming."
function currentStageKey(batch) {
  if (!batch) return 'draft'
  if (batch.status === 'fulfilled') {
    if (batch.destination_type === 'person') return 'fulfilled_matched'
    if (batch.destination_type === 'charity') return 'fulfilled_donated'
    return 'fulfilled'
  }
  return batch.status
}

export default function PassAlongBatch() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    items: householdItems,
    reloadItems,
    selectedBabyId,
    babies,
  } = useHousehold()
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [batch, setBatch] = useState(null)
  const [items, setItems] = useState([])
  const [recipientHousehold, setRecipientHousehold] = useState(null)
  const [error, setError] = useState(null)

  // Local draft of editable fields so the user's typing doesn't race with
  // the loaded row. We persist on blur / on explicit action rather than
  // per-keystroke — cheap on requests, and avoids flicker.
  const [destination, setDestination] = useState('family')
  const [batchNotes, setBatchNotes] = useState('')
  // recipient_name / recipient_address / recipient_notes were collected
  // pre-bag-flow when Sprigloop generated shipping labels for person/
  // charity destinations. Now that every batch ships via a Sprigloop-
  // issued bag (user writes the recipient address on the bag itself),
  // the fields are operationally unnecessary and we no longer collect
  // them. Columns remain in the DB for backward-compat with old rows;
  // the recipient_required check constraint was dropped in migration 018.

  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
    // 'delete' | 'confirmShipped' | 'requestLabel' | null

  // Bag-ship-to address (where Sprigloop ships the bag TO the user).
  // Variable names are still labelName/Street/etc. for historical reasons —
  // these were originally for the prepaid-label flow before we pivoted to
  // shipping users physical Sprigloop bags. Same DB columns
  // (label_requested_at, label_request_address) and same data shape; new
  // meaning. Renaming the variables would be a sprawling diff with no
  // user-facing benefit, so we leave them and document here.
  const [labelName, setLabelName] = useState('')
  const [labelStreet, setLabelStreet] = useState('')
  const [labelUnit, setLabelUnit] = useState('')
  const [labelCity, setLabelCity] = useState('')
  const [labelState, setLabelState] = useState('')
  const [labelZip, setLabelZip] = useState('')

  // Inventory picker state. Before this, the empty-state copy told users to
  // leave the screen and add items from Inventory or ItemDetail, which was a
  // dead-end flow — you'd open a batch you just created and be stuck.
  // The picker shows every currently-owned household item that isn't already
  // in a batch; the user multi-selects and we do one bulk UPDATE to attach
  // them to this batch.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSelected, setPickerSelected] = useState(() => new Set())
  const [pickerError, setPickerError] = useState(null)
  // In-picker baby filter. 'all' shows every eligible item across the
  // household; '<uuid>' narrows to one baby's items plus shared rows;
  // 'shared' narrows to only the null-baby_id rows (outgrown clothes from
  // family or friends, gifts not yet assigned). Starts at 'all' every time
  // the picker opens so
  // multi-baby households see their full pool by default — a batch isn't
  // baby-scoped and forcing a per-baby view would hide eligible items.
  const [pickerBabyFilter, setPickerBabyFilter] = useState('all')

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: batchRow, error: bErr } = await supabase
        .schema(currentSchema)
        .from('pass_along_batches')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return
      if (bErr) {
        setError(bErr.message)
        setLoading(false)
        return
      }
      if (!batchRow) {
        setBatch(null)
        setLoading(false)
        return
      }

      setBatch(batchRow)
      setDestination(batchRow.destination_type || 'family')
      setBatchNotes(batchRow.notes || '')

      // Fetch items in this batch. Ordered by created_at so the list
      // feels stable as users add/remove.
      const { data: itemRows, error: iErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('id, name, item_type, category, size_label, quantity, brand, inventory_status')
        .eq('pass_along_batch_id', id)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (iErr) {
        setError(iErr.message)
        setLoading(false)
        return
      }
      setItems(itemRows || [])

      // If this batch has been matched to a receiving household (family
      // destination only), fetch the household name so we can show the
      // sender where their bag ended up. RLS on households will only
      // return it if Chris's service role has granted visibility — for
      // now this falls back silently if the row isn't readable.
      if (batchRow.recipient_household_id) {
        const { data: hRow } = await supabase
          .schema(currentSchema)
          .from('households')
          .select('id, name')
          .eq('id', batchRow.recipient_household_id)
          .maybeSingle()
        if (!cancelled) setRecipientHousehold(hRow || null)
      } else {
        setRecipientHousehold(null)
      }

      setLoading(false)

      // One analytics event per mount so we can see how often the detail
      // screen is revisited after a batch is shipped.
      track.passAlongBatchViewed({
        id: batchRow.id,
        status: batchRow.status,
        destination: batchRow.destination_type,
        item_count: (itemRows || []).length,
      })
    }

    load()
    return () => { cancelled = true }
  }, [user, id])

  const isDraft         = batch?.status === 'draft'
  const isBagRequested  = batch?.status === 'bag_requested'
  const isBagInTransit  = batch?.status === 'bag_in_transit'
  const isShipped       = batch?.status === 'shipped'
  const isFulfilled     = batch?.status === 'fulfilled'
  const isReceived      = batch?.status === 'received'
  const isCanceled      = batch?.status === 'canceled'
  // Items lock as soon as the user requests a bag — once we've started
  // dispatching for a specific batch contents, switching items would
  // mean we're shipping a bag for a batch that no longer matches.
  const locked = !isDraft

  // Request a Sprigloop bag = the primary CTA on a draft. Disabled until
  // there's at least one item so the user knows what's blocking (the
  // disabled-button copy below names the missing requirement explicitly,
  // per the disabled-button-UX rule).
  const canRequestBag    = isDraft && items.length > 0
  // "I've dropped it in the mailbox" = primary CTA once the bag is on
  // its way to the user. The user is the only signal we have for the
  // mailbox event until USPS tracking integration lands.
  const canConfirmShipped = isBagInTransit

  const timeline = useMemo(
    () => timelineFor(batch?.destination_type || destination),
    [batch?.destination_type, destination],
  )
  const stageKey = currentStageKey(batch)
  const stageIndex = timeline.findIndex(s => s.key === stageKey)

  // ── Helpers ────────────────────────────────────────────────────────────

  // Trim + empty-to-null for the only freeform field we still collect.
  const cleanNotes = batchNotes.trim() || null

  // ── Save destination change ────────────────────────────────────────────
  // Bag-flow simplification: we no longer collect recipient_name/address
  // in-app (user writes those on the bag itself), so destination changes
  // only need to flip destination_type — no recipient cleanup.
  async function changeDestination(nextDest) {
    if (!batch || locked || working || nextDest === destination) return
    setWorking(true)
    setActionError(null)

    const patch = { destination_type: nextDest }

    const { data, error: uErr } = await supabase
      .schema(currentSchema)
      .from('pass_along_batches')
      .update(patch)
      .eq('id', batch.id)
      .select('*')
      .maybeSingle()

    setWorking(false)
    if (uErr) {
      setActionError(uErr.message)
      return
    }
    const prevDest = batch.destination_type
    setBatch(data || { ...batch, ...patch })
    setDestination(nextDest)
    track.passAlongBatchDestinationChanged({
      id: batch.id,
      from: prevDest,
      to: nextDest,
    })
  }

  // Blur-saves for the freeform fields. Only writes if the value actually
  // changed vs. what's on the batch row — spares Supabase unnecessary round
  // trips when users tab through without typing.
  async function saveField(field, cleanValue, previousRaw) {
    if (!batch || locked) return
    const previousClean = (previousRaw ?? '').trim() || null
    if (cleanValue === previousClean) return
    setActionError(null)
    const { error: uErr } = await supabase
      .schema(currentSchema)
      .from('pass_along_batches')
      .update({ [field]: cleanValue })
      .eq('id', batch.id)
    if (uErr) {
      setActionError(uErr.message)
      return
    }
    setBatch(b => ({ ...b, [field]: cleanValue }))
  }

  // ── Remove item from batch ─────────────────────────────────────────────
  // Not a hard delete — the item goes back to the wardrobe as 'owned'.
  // Optimistic update: drop from local list immediately, roll back on error.
  async function removeItem(item) {
    if (!batch || locked || working) return
    const snapshot = items
    setItems(items.filter(i => i.id !== item.id))
    setActionError(null)

    const { error: uErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({ pass_along_batch_id: null, inventory_status: 'owned' })
      .eq('id', item.id)

    if (uErr) {
      setItems(snapshot)
      setActionError(uErr.message)
      return
    }
    // Push the wardrobe status flip to every other screen that's reading
    // the shared items list — Inventory's Owned view should show the item
    // again on back-nav without waiting for a mount refetch.
    reloadItems()
    track.passAlongBatchItemRemoved({
      id: batch.id,
      destination: batch.destination_type,
      remaining: snapshot.length - 1,
    })
  }

  // ── Picker: eligible wardrobe items ────────────────────────────────────
  // Every household row that's currently Owned and isn't already in some
  // other batch. We deliberately ignore the household-level selectedBabyId
  // here — a pass-along batch isn't scoped to a baby, and in a multi-baby
  // household the sender is often packing outgrown stuff from more than
  // one baby into the same bag. The in-picker baby filter (chips above
  // the list) lets the user narrow within the modal when they want to,
  // without hiding anything by default.
  const eligibleItems = useMemo(() => {
    if (!householdItems) return []
    return householdItems.filter(
      it =>
        it.inventory_status === 'owned' &&
        it.pass_along_batch_id == null,
    )
  }, [householdItems])

  const pickerItems = useMemo(() => {
    if (pickerBabyFilter === 'all') return eligibleItems
    if (pickerBabyFilter === 'shared') {
      return eligibleItems.filter(it => it.baby_id == null)
    }
    // Specific baby: that baby's items + shared (null baby_id) rows,
    // matching the shared-item semantic used everywhere else in the app.
    return eligibleItems.filter(it => matchesBabyFilter(it, pickerBabyFilter))
  }, [eligibleItems, pickerBabyFilter])

  // Derived counts keyed by baby id — used to label the filter chips so
  // users can see at a glance which baby has outgrown pile worth packing.
  const pickerCountsByBaby = useMemo(() => {
    const counts = { all: eligibleItems.length, shared: 0 }
    for (const b of babies) counts[b.id] = 0
    for (const it of eligibleItems) {
      if (it.baby_id == null) counts.shared += 1
      else if (counts[it.baby_id] != null) counts[it.baby_id] += 1
    }
    return counts
  }, [eligibleItems, babies])

  function togglePickerItem(itemId) {
    setPickerSelected(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function openPicker() {
    setPickerSelected(new Set())
    setPickerError(null)
    setPickerBabyFilter('all')
    setPickerOpen(true)
  }

  function closePicker() {
    if (working) return
    setPickerOpen(false)
    setPickerSelected(new Set())
    setPickerError(null)
    setPickerBabyFilter('all')
  }

  // ── Picker: attach selected items ──────────────────────────────────────
  // One UPDATE with an IN (…) over the selected ids — a single round trip
  // no matter how many items the user checked. We then re-fetch the batch
  // items (to pull the full selected rows with all the fields the list
  // renderer expects) and kick the shared reloadItems() so Inventory's
  // Owned view reflects the move.
  async function addItemsFromInventory() {
    if (!batch || !isDraft || working) return
    const ids = Array.from(pickerSelected)
    if (ids.length === 0) {
      setPickerError('Pick at least one item to add.')
      return
    }
    setWorking(true)
    setPickerError(null)
    setActionError(null)

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({
        pass_along_batch_id: batch.id,
        inventory_status: 'pass_along',
      })
      .in('id', ids)

    if (updErr) {
      setWorking(false)
      setPickerError(updErr.message)
      return
    }

    // Re-pull this batch's items — the simplest way to get the updated rows
    // with every field ItemRow wants to render, without duplicating field
    // lists between the initial load and this code path.
    const { data: refreshedItems, error: fetchErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .select('id, name, item_type, category, size_label, quantity, brand, inventory_status')
      .eq('pass_along_batch_id', batch.id)
      .order('created_at', { ascending: true })

    setWorking(false)

    if (fetchErr) {
      // The UPDATE already landed; surface the fetch failure but don't roll
      // back. User can reload to see the fresh list.
      setPickerError(fetchErr.message)
      return
    }

    setItems(refreshedItems || [])
    reloadItems()
    track.passAlongItemAdded({
      from: 'batch_picker',
      batch_id: batch.id,
      created_new_batch: false,
      count: ids.length,
    })
    setPickerOpen(false)
    setPickerSelected(new Set())
  }

  // ── Primary action (post-bag-arrival): user confirms they mailed it ────
  // Triggered from the "I've dropped it in the mailbox" button, which only
  // appears once status === 'bag_in_transit' (i.e. Chris has dispatched
  // the Sprigloop bag and the user has it in hand). Person/charity batches
  // auto-advance to fulfilled here because Sprigloop isn't in the path —
  // there's no "received at HQ" step.
  async function handleConfirmShipped() {
    if (!batch || !canConfirmShipped || working) return
    setWorking(true)
    setActionError(null)

    const now = new Date().toISOString()
    const patch = { status: 'shipped', shipped_at: now }

    if (batch.destination_type === 'person') {
      patch.status = 'fulfilled'
      patch.fulfilled_at = now
      patch.outcome = 'matched'
    } else if (batch.destination_type === 'charity') {
      patch.status = 'fulfilled'
      patch.fulfilled_at = now
      patch.outcome = 'donated'
    }

    // Persist any in-flight notes too — the user might have typed in the
    // notes textarea right before confirming without blurring out.
    patch.notes = cleanNotes

    const { data, error: uErr } = await supabase
      .schema(currentSchema)
      .from('pass_along_batches')
      .update(patch)
      .eq('id', batch.id)
      .select('*')
      .maybeSingle()

    setWorking(false)
    if (uErr) {
      setActionError(uErr.message)
      return
    }
    setBatch(data || { ...batch, ...patch })
    setPendingAction(null)
    track.passAlongBatchShipped({
      id: batch.id,
      destination: batch.destination_type,
      item_count: items.length,
      auto_fulfilled: patch.status === 'fulfilled',
    })
  }

  // ── Secondary action: request a Sprigloop bag ──────────────────────────
  // Open to all three destinations. Two-step persistence:
  //   1. Stamp label_requested_at + label_request_address on the batch so the
  //      user-facing timeline reflects the ask. (Columns kept their old
  //      "label" names from the previous prepaid-label flow — same shape,
  //      new meaning. label_request_address now holds the user's
  //      shipping address: where Sprigloop ships the BAG to the user.)
  //   2. Drop a row into beta.concierge_tasks — Chris's admin inbox — with
  //      task_type='bag_request' so the bag dispatch shows up in the
  //      open-work queue without any extra infra. Chris reads the batch's
  //      destination_type to decide which bag SKU to grab from the closet
  //      (prelabeled-HQ vs. blank-label flat-rate).
  //
  // The concierge insert is best-effort. If it fails (schema cache, RLS,
  // transient network), the batch update has already landed and the user's
  // timeline will show the request — Chris can still discover it by
  // scanning pass_along_batches.label_requested_at. We surface the primary
  // failure but swallow the secondary.
  // Required fields for shipping the bag. Unit is optional — plenty of
  // houses don't have one and forcing a non-empty value would feel hostile.
  const labelFieldsValid =
    labelName.trim() &&
    labelStreet.trim() &&
    labelCity.trim() &&
    labelState.trim() &&
    labelZip.trim()

  // Pack the form into a single multi-line block the concierge can paste
  // onto a shipping label or directly into a bag-dispatch carrier flow.
  // Predictable shape (name / street / unit / city, ST ZIP) so Chris can
  // also parse it back out if he ever automates.
  function assembleLabelAddress() {
    const name = labelName.trim()
    const street = labelStreet.trim()
    const unit = labelUnit.trim()
    const city = labelCity.trim()
    const state = labelState.trim()
    const zip = labelZip.trim()
    const streetLine = unit ? `${street}, ${unit}` : street
    const cityStateZip = `${city}, ${state} ${zip}`.trim()
    return [name, streetLine, cityStateZip].filter(Boolean).join('\n')
  }

  async function handleRequestLabel() {
    if (!batch || !canRequestBag || working) return
    if (!labelFieldsValid) {
      setActionError('Fill in name, street, city, state, and ZIP so we can ship your bag to the right place.')
      return
    }
    setWorking(true)
    setActionError(null)

    const assembled = assembleLabelAddress()
    const nowIso = new Date().toISOString()

    // One atomic update on the batch: stamp the bag-request timestamps,
    // record the ship-to address, AND advance the batch into the
    // bag_requested status state (introduced in migration 019). The
    // status flip is what locks items, hides Delete batch, and shows the
    // bag-requested timeline stage.
    const { data, error: uErr } = await supabase
      .schema(currentSchema)
      .from('pass_along_batches')
      .update({
        status:                'bag_requested',
        label_requested_at:    nowIso,
        label_request_address: assembled,
      })
      .eq('id', batch.id)
      .select('*')
      .maybeSingle()

    if (uErr) {
      setWorking(false)
      setActionError(uErr.message)
      return
    }

    // Best-effort: persist the structured address pieces to the user's
    // profile (auth.users.user_metadata.shipping_address) so the next bag
    // request prefills automatically. We merge into the existing metadata
    // bag rather than overwriting — name, prefs, welcome_sent_at all live
    // in the same blob and we don't want to clobber siblings.
    try {
      const existingMeta = user?.user_metadata || {}
      await supabase.auth.updateUser({
        data: {
          ...existingMeta,
          shipping_address: {
            name:   labelName.trim(),
            street: labelStreet.trim(),
            unit:   labelUnit.trim() || null,
            city:   labelCity.trim(),
            state:  labelState.trim(),
            zip:    labelZip.trim(),
          },
        },
      })
    } catch {
      // Deliberately swallowed — the bag request itself already landed.
      // Worst case: user retypes the address next time.
    }

    // Best-effort concierge inbox row. Payload captures the flat block and
    // also the structured pieces so Chris can pull name/street/etc. back out
    // without regex-parsing a string — handy if we ever wire up an API that
    // expects structured input (EasyPost, Shippo, USPS Web Tools, etc.).
    // ship_to_address is the user's shipping address (where Sprigloop ships
    // the bag to). batch.destination_type tells Chris which bag SKU to use:
    // prelabeled-HQ for 'family', blank-label flat-rate for 'person'/'charity'.
    try {
      await supabase
        .schema(currentSchema)
        .from('concierge_tasks')
        .insert({
          task_type: 'bag_request',
          household_id: batch.household_id,
          created_by: user?.id ?? null,
          related_batch_id: batch.id,
          payload: {
            reference_code: batch.reference_code,
            destination_type: batch.destination_type,
            ship_to_address: assembled,
            ship_to_address_parts: {
              name:   labelName.trim(),
              street: labelStreet.trim(),
              unit:   labelUnit.trim() || null,
              city:   labelCity.trim(),
              state:  labelState.trim(),
              zip:    labelZip.trim(),
            },
            item_count: items.length,
            requested_at: nowIso,
          },
        })
    } catch {
      // Deliberately swallowed — the primary persistence already succeeded.
    }

    setWorking(false)
    setBatch(data || batch)
    setPendingAction(null)
    track.passAlongLabelRequested({
      id: batch.id,
      from_status: batch.status,
    })
  }

  // ── Delete draft ───────────────────────────────────────────────────────
  // Before deleting the batch, unlink any items and bounce their status
  // back to 'owned' so nothing is orphaned or lost from the wardrobe.
  // RLS enforces draft-only delete server-side, but we also gate the
  // button to keep the UI honest.
  async function handleDelete() {
    if (!batch || !isDraft || working) return
    setWorking(true)
    setActionError(null)

    if (items.length > 0) {
      const { error: relinkErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .update({ pass_along_batch_id: null, inventory_status: 'owned' })
        .eq('pass_along_batch_id', batch.id)
      if (relinkErr) {
        setWorking(false)
        setActionError(relinkErr.message)
        return
      }
    }

    const { error: delErr } = await supabase
      .schema(currentSchema)
      .from('pass_along_batches')
      .delete()
      .eq('id', batch.id)

    setWorking(false)
    if (delErr) {
      setActionError(delErr.message)
      return
    }
    track.passAlongBatchDeleted({
      id: batch.id,
      destination: batch.destination_type,
      item_count: items.length,
    })
    // Items we just bounced back to 'owned' need to show up in the wardrobe
    // again — Inventory reads from the shared list, so trigger a refresh.
    reloadItems()
    navigate('/pass-along')
  }

  // ── Confirm modal glue ─────────────────────────────────────────────────
  function confirmLabel() {
    if (pendingAction === 'delete') return 'Delete batch'
    if (pendingAction === 'confirmShipped') return 'Mark as mailed'
    if (pendingAction === 'requestLabel') return 'Request bag'
    return ''
  }

  function confirmBody() {
    if (pendingAction === 'delete') {
      return items.length > 0
        ? `This removes the batch and returns ${items.length} item${items.length === 1 ? '' : 's'} to your wardrobe. You can\u2019t undo the delete.`
        : 'This removes the batch. You can\u2019t undo.'
    }
    if (pendingAction === 'confirmShipped') {
      if (destination === 'person' || destination === 'charity') {
        return 'Confirm you\u2019ve dropped the bag in a USPS mailbox. The batch will close out as fulfilled \u2014 it\u2019ll stay in your history.'
      }
      return 'Confirm you\u2019ve dropped the bag in a USPS mailbox. We\u2019ll update you once Sprigloop receives it.'
    }
    if (pendingAction === 'requestLabel') {
      return 'We\u2019ll ship a Sprigloop bag to the address below. Once it arrives, fill it with this batch and drop it in any USPS mailbox.'
    }
    return ''
  }

  function runPendingAction() {
    if (pendingAction === 'delete') return handleDelete()
    if (pendingAction === 'confirmShipped') return handleConfirmShipped()
    if (pendingAction === 'requestLabel') return handleRequestLabel()
  }

  // ── Not found / load error ─────────────────────────────────────────────
  if (!loading && (error || !batch)) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/pass-along')}
            aria-label="Back to pass-along"
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
          <div className={styles.errorBanner}>
            {error
              ? `Couldn\u2019t load this batch: ${error}`
              : 'This batch isn\u2019t in your history anymore.'}{' '}
            <button
              className={styles.linkBtn}
              type="button"
              onClick={() => navigate('/pass-along')}
            >
              Back to pass-along
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────
  const statusLabel = STATUS_LABEL[batch?.status] || batch?.status
  // bag_requested + bag_in_transit are "active" — work is in flight, just on
  // different sides of the user/Sprigloop seam. Same pill style as
  // shipped/received so users see "this is moving" at a glance.
  const pillClass =
    batch?.status === 'fulfilled' ? styles.statusPillFulfilled :
    (batch?.status === 'shipped' ||
      batch?.status === 'received' ||
      batch?.status === 'bag_requested' ||
      batch?.status === 'bag_in_transit') ? styles.statusPillActive :
    batch?.status === 'canceled' ? styles.statusPillCanceled :
    styles.statusPillDraft

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/pass-along')}
          aria-label="Back to pass-along list"
        >
          ←
        </button>
        <div className={styles.titleBlock}>
          <div className={styles.title}>Pass-along batch</div>
          {batch && (
            <div className={styles.subtitle}>{batch.reference_code}</div>
          )}
          <IvySprig />
        </div>
        <ProfileMenu />
      </header>

      <main className={styles.body}>
        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && batch && (
          <>
            {/* Summary — reference code + status pill. The ref code is the
                thing the user writes on the packing slip / matches in an
                email from Chris, so it gets the big-type treatment. */}
            <section className={styles.summary}>
              <div className={styles.summaryTop}>
                <div className={styles.summaryText}>
                  <div className={styles.summaryName}>{batch.reference_code}</div>
                  <div className={styles.summaryMeta}>
                    {items.length === 0
                      ? 'No items packed yet'
                      : `${items.length} item${items.length === 1 ? '' : 's'} packed`}
                  </div>
                </div>
                <span className={`${styles.statusPill} ${pillClass}`}>
                  {statusLabel}
                </span>
              </div>
            </section>

            {/* Canceled batches get a subdued banner so the user understands
                nothing else on the page is actionable. */}
            {isCanceled && (
              <div className={styles.infoBanner}>
                This batch was canceled. It stays in your history for your records.
              </div>
            )}

            {/* Destination — radio-style card stack. Draft = interactive;
                everything else = read-only single card summarizing the choice. */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Where it’s going</div>
              {locked ? (
                <ReadonlyDestinationCard destination={destination} />
              ) : (
                <div className={styles.destStack}>
                  {DESTINATION_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      className={
                        `${styles.destCard} ` +
                        (destination === opt.id ? styles.destCardSel : '')
                      }
                      onClick={() => changeDestination(opt.id)}
                      disabled={working}
                    >
                      <div className={styles.destCardTop}>
                        <span className={styles.destDot} aria-hidden="true">
                          <span className={styles.destDotInner} />
                        </span>
                        <span className={styles.destCardLabel}>{opt.label}</span>
                      </div>
                      <div className={styles.destCardSub}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* "How this works" explainer — shown under the destination
                  stack for all three destinations now. The bag-flow mechanics
                  differ per destination (HQ-routed vs. user-addressed) and
                  this is where we spell that out so the user knows what to
                  expect. CSS class names are historical (familyExplainer /
                  familyMatchedLine) — they’re generic now. The
                  matched-line below stays family-only because only family
                  batches get a recipient_household_id set by HQ. */}
              {destination === 'family' && (
                <div className={styles.familyExplainer}>
                  <strong>How this works:</strong> Request a Sprigloop bag and
                  we’ll mail you one prelabeled to us with prepaid
                  postage. Fill it, drop it in any USPS mailbox. We check the
                  contents and forward them to a matched Sprigloop family
                  that’s opted in to receiving, or donate them on your
                  behalf if no match fits. Addresses stay private on both ends.
                  {recipientHousehold && (
                    <div className={styles.familyMatchedLine}>
                      Matched to: <strong>{recipientHousehold.name}</strong>
                    </div>
                  )}
                </div>
              )}
              {destination === 'person' && (
                <div className={styles.familyExplainer}>
                  <strong>How this works:</strong> Request a Sprigloop bag and
                  we’ll mail you one blank with prepaid postage. Fill it,
                  write your friend’s address on the bag, drop it in any
                  USPS mailbox.
                </div>
              )}
              {destination === 'charity' && (
                <div className={styles.familyExplainer}>
                  <strong>How this works:</strong> Request a Sprigloop bag and
                  we’ll mail you one blank with prepaid postage. Fill it,
                  write the charity’s address on the bag, drop it in any
                  USPS mailbox.
                </div>
              )}
            </section>

            {/* Items — compact rows, one per clothing_items entry. In draft
                state, each row has an × to remove it from the batch. When
                the batch is a draft we also surface an "Add from inventory"
                CTA so the user can build the batch without leaving the page
                (previously they had to navigate to Inventory and use the
                "Send this on" action per-item, which broke when they landed
                on an empty draft). */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                Items in the bag
                <span className={styles.sectionTitleCount}>
                  {items.length} packed
                </span>
              </div>
              {items.length === 0 ? (
                <div className={styles.emptyItems}>
                  No items in this batch yet.{' '}
                  {isDraft
                    ? 'Pick from your wardrobe below to start packing.'
                    : 'This batch went out empty.'}
                </div>
              ) : (
                <ul className={styles.itemList}>
                  {items.map(it => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      removable={!locked}
                      onRemove={() => removeItem(it)}
                      disabled={working}
                    />
                  ))}
                </ul>
              )}
              {isDraft && (
                <button
                  type="button"
                  className={styles.addItemsBtn}
                  onClick={openPicker}
                  disabled={working}
                >
                  + Add items from inventory
                </button>
              )}
            </section>

            {/* Timeline — tiny step indicator. Upcoming steps get muted
                styling, current step highlighted, past steps checkmarked. */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Progress</div>
              <ol className={styles.timeline}>
                {timeline.map((step, i) => {
                  const state =
                    i < stageIndex ? 'done' :
                    i === stageIndex ? 'current' :
                    'upcoming'
                  return (
                    <li key={step.key} className={`${styles.tlItem} ${styles[`tl_${state}`]}`}>
                      <span className={styles.tlDot} aria-hidden="true" />
                      <span className={styles.tlLabel}>{step.label}</span>
                      <span className={styles.tlDate}>
                        {timelineDate(batch, step.key)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>

            {/* Packing instructions — destination-aware copy. Kept brief;
                the full concierge guide lives on the landing page /
                confirmation email once task #6 rewires it. */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Packing instructions</div>
              <div className={styles.instructionsBox}>
                <ul className={styles.instructionsList}>
                  <li>Fold or roll clothes tightly — more fits in your bag.</li>
                  <li>
                    Write your reference code{' '}
                    <strong>{batch.reference_code}</strong> on a slip tucked
                    inside. If the bag gets separated from its label, this is
                    how we find it.
                  </li>
                  {destination === 'family' && (
                    <li>
                      Fill your Sprigloop bag and drop it in any USPS
                      mailbox — the address to Sprigloop is preprinted.
                      Don’t have a bag yet? Request one below.
                    </li>
                  )}
                  {destination === 'person' && (
                    <li>
                      Fill your Sprigloop bag, write your friend’s
                      address on the bag, and drop it in any USPS mailbox.
                      Postage is prepaid. Don’t have a bag yet? Request
                      one below.
                    </li>
                  )}
                  {destination === 'charity' && (
                    <li>
                      Fill your Sprigloop bag, write the charity’s address
                      on the bag, and drop it in any USPS mailbox.
                      Postage is prepaid. Don’t have a bag yet? Request
                      one below.
                    </li>
                  )}
                  <li>Skip anything stained, ripped, or missing parts — saves everyone a return trip.</li>
                </ul>
              </div>
            </section>

            {/* Notes — free text the sender can leave on the batch for
                their own reference or for HQ concierge to read during
                inspection. */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                Notes <span className={styles.optional}>(for yourself or Sprigloop)</span>
              </div>
              <textarea
                className={styles.textarea}
                rows={3}
                value={batchNotes}
                onChange={e => setBatchNotes(e.target.value)}
                onBlur={() => saveField('notes', cleanNotes, batch.notes)}
                disabled={locked || working}
                placeholder="Anything we should know about the bag"
              />
            </section>

            {/* Bag-requested confirmation — shown once the user has
                asked us to ship them a Sprigloop bag, so they know it\u2019s
                in flight. (Column kept its label_requested_at name from
                the previous prepaid-label flow — same shape, new meaning.) */}
            {isBagRequested && batch.label_requested_at && (
              <div className={styles.infoBanner}>
                Sprigloop bag requested on{' '}
                {new Date(batch.label_requested_at).toLocaleDateString()}.
                We’ll ship it to you shortly — keep an eye on your mailbox.
              </div>
            )}
            {isBagInTransit && (
              <div className={styles.infoBanner}>
                Your Sprigloop bag is on its way{batch.bag_dispatched_at
                  ? ` (sent ${new Date(batch.bag_dispatched_at).toLocaleDateString()})`
                  : ''}.
                When it arrives, fill it with this batch and drop it in any USPS
                mailbox — then tap “I’ve dropped it in the mailbox” below.
              </div>
            )}

            {actionError && (
              <div className={styles.errorBanner}>
                Something went wrong: {actionError}
              </div>
            )}

            {/* Actions — primary/danger stack. On draft: Request a Sprigloop
                bag is THE primary CTA (with disabled-button copy that names
                the missing requirement, per the disabled-button-UX rule).
                On bag_in_transit: "I've dropped it in the mailbox" is the
                primary — the user is the only signal we have for that
                event until USPS tracking integration lands. Other states
                (bag_requested, shipped, received, fulfilled, canceled)
                render no actions. */}
            {(isDraft || isBagInTransit) && (
              <section className={styles.actions}>
                {isDraft && (
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => {
                      // Prefill from user_metadata.shipping_address \u2014 saved
                      // on the user's last successful bag request (see
                      // handleRequestLabel) \u2014 so repeat senders don't
                      // retype. name falls back to the display name we
                      // already have on user_metadata for first-time users.
                      const meta = user?.user_metadata || {}
                      const ship = meta.shipping_address || {}
                      setLabelName(ship.name || meta.name || '')
                      setLabelStreet(ship.street || '')
                      setLabelUnit(ship.unit || '')
                      setLabelCity(ship.city || '')
                      setLabelState(ship.state || '')
                      setLabelZip(ship.zip || '')
                      setPendingAction('requestLabel')
                    }}
                    disabled={!canRequestBag || working}
                  >
                    {canRequestBag
                      ? 'Request a Sprigloop bag'
                      : 'Add at least one item to request a bag'}
                  </button>
                )}

                {isBagInTransit && (
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => setPendingAction('confirmShipped')}
                    disabled={!canConfirmShipped || working}
                  >
                    I’ve dropped it in the mailbox
                  </button>
                )}

                {isDraft && (
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => setPendingAction('delete')}
                    disabled={working}
                  >
                    Delete batch
                  </button>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Inventory picker — multi-select from the household's Owned pool.
          Separate from the confirm modal because the body is a scrollable
          list, not a short paragraph, and the footer button copy
          ("Add N items") depends on the selection count. */}
      {pickerOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={closePicker}
          role="presentation"
        >
          <div
            className={`${styles.modal} ${styles.modalPicker}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-picker-title"
            onClick={e => e.stopPropagation()}
          >
            <div id="batch-picker-title" className={styles.modalTitle}>
              Add items from inventory
            </div>
            <div className={styles.modalBody}>
              Pick anything from your wardrobe you’d like to include in
              this batch.
            </div>

            {/* Baby filter — only renders for multi-baby households. 'All'
                is the default so the sender sees everything they could
                pack; the per-baby chips are for when they want to focus
                on one pile (e.g., "just Roo's outgrowns"). 'Shared' covers
                the null-baby_id rows for unassigned shared items. */}
            {babies.length > 1 && (
              <div className={styles.pickerChipRow}>
                <button
                  type="button"
                  className={
                    `${styles.pickerChip} ${pickerBabyFilter === 'all' ? styles.pickerChipSel : ''}`
                  }
                  onClick={() => setPickerBabyFilter('all')}
                  disabled={working}
                >
                  All
                  <span className={styles.pickerChipCount}>
                    {pickerCountsByBaby.all}
                  </span>
                </button>
                {babies.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    className={
                      `${styles.pickerChip} ${pickerBabyFilter === b.id ? styles.pickerChipSel : ''}`
                    }
                    onClick={() => setPickerBabyFilter(b.id)}
                    disabled={working}
                  >
                    {b.name || 'Baby'}
                    <span className={styles.pickerChipCount}>
                      {pickerCountsByBaby[b.id] || 0}
                    </span>
                  </button>
                ))}
                {pickerCountsByBaby.shared > 0 && (
                  <button
                    type="button"
                    className={
                      `${styles.pickerChip} ${pickerBabyFilter === 'shared' ? styles.pickerChipSel : ''}`
                    }
                    onClick={() => setPickerBabyFilter('shared')}
                    disabled={working}
                  >
                    Shared
                    <span className={styles.pickerChipCount}>
                      {pickerCountsByBaby.shared}
                    </span>
                  </button>
                )}
              </div>
            )}

            {pickerItems.length === 0 ? (
              <div className={styles.pickerEmpty}>
                {eligibleItems.length === 0
                  ? 'You don’t have any unpacked owned items to add right now.'
                  : 'No items match this filter. Try a different baby or switch back to All.'}
              </div>
            ) : (
              <ul className={styles.pickerList}>
                {pickerItems.map(it => {
                  const slot = it.item_type ? SLOT_BY_ID[it.item_type] : null
                  const typeLabel =
                    slot?.label ||
                    CATEGORY_LABELS[it.category] ||
                    humanizeItemType(it.item_type || it.category)
                  const displayName = it.name || typeLabel
                  const secondary = [it.size_label, it.brand].filter(Boolean).join(' · ')
                  const checked = pickerSelected.has(it.id)
                  return (
                    <li key={it.id}>
                      <label
                        className={
                          `${styles.pickerRow} ${checked ? styles.pickerRowSel : ''}`
                        }
                      >
                        <input
                          type="checkbox"
                          className={styles.pickerCheckbox}
                          checked={checked}
                          onChange={() => togglePickerItem(it.id)}
                          disabled={working}
                        />
                        <span className={styles.pickerRowText}>
                          <span className={styles.pickerRowName}>{displayName}</span>
                          {secondary && (
                            <span className={styles.pickerRowMeta}>{secondary}</span>
                          )}
                        </span>
                        {it.quantity > 1 && (
                          <span className={styles.pickerRowQty}>×{it.quantity}</span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}

            {pickerError && (
              <div className={styles.pickerError}>{pickerError}</div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={closePicker}
                disabled={working}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalPrimary}
                onClick={addItemsFromInventory}
                disabled={working || pickerSelected.size === 0}
              >
                {working
                  ? 'Adding…'
                  : pickerSelected.size === 0
                    ? 'Add items'
                    : `Add ${pickerSelected.size} item${pickerSelected.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal — reused for ship / delete / request-label.
          Request-label adds an address input inside the modal body. */}
      {pendingAction && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !working && setPendingAction(null)}
          role="presentation"
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-confirm-title"
            onClick={e => e.stopPropagation()}
          >
            <div id="batch-confirm-title" className={styles.modalTitle}>
              {confirmLabel()}?
            </div>
            <div className={styles.modalBody}>{confirmBody()}</div>

            {pendingAction === 'requestLabel' && (
              <div className={styles.labelForm}>
                <label className={styles.labelFormField}>
                  <span className={styles.labelFormLabel}>Your name</span>
                  <input
                    className={styles.modalInput}
                    type="text"
                    value={labelName}
                    onChange={e => setLabelName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    autoComplete="name"
                    disabled={working}
                  />
                </label>
                <label className={styles.labelFormField}>
                  <span className={styles.labelFormLabel}>Street address</span>
                  <input
                    className={styles.modalInput}
                    type="text"
                    value={labelStreet}
                    onChange={e => setLabelStreet(e.target.value)}
                    placeholder="123 Main St"
                    autoComplete="address-line1"
                    disabled={working}
                  />
                </label>
                <label className={styles.labelFormField}>
                  <span className={styles.labelFormLabel}>
                    Apt / Unit <span className={styles.optional}>(optional)</span>
                  </span>
                  <input
                    className={styles.modalInput}
                    type="text"
                    value={labelUnit}
                    onChange={e => setLabelUnit(e.target.value)}
                    placeholder="Apt 4B"
                    autoComplete="address-line2"
                    disabled={working}
                  />
                </label>
                <div className={styles.labelFormRow}>
                  <label className={`${styles.labelFormField} ${styles.labelFormCity}`}>
                    <span className={styles.labelFormLabel}>City</span>
                    <input
                      className={styles.modalInput}
                      type="text"
                      value={labelCity}
                      onChange={e => setLabelCity(e.target.value)}
                      placeholder="Detroit"
                      autoComplete="address-level2"
                      disabled={working}
                    />
                  </label>
                  <label className={`${styles.labelFormField} ${styles.labelFormState}`}>
                    <span className={styles.labelFormLabel}>State</span>
                    <input
                      className={styles.modalInput}
                      type="text"
                      value={labelState}
                      onChange={e => setLabelState(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="MI"
                      maxLength={2}
                      autoComplete="address-level1"
                      disabled={working}
                    />
                  </label>
                  <label className={`${styles.labelFormField} ${styles.labelFormZip}`}>
                    <span className={styles.labelFormLabel}>ZIP</span>
                    <input
                      className={styles.modalInput}
                      type="text"
                      inputMode="numeric"
                      value={labelZip}
                      onChange={e => setLabelZip(e.target.value.replace(/[^0-9-]/g, '').slice(0, 10))}
                      placeholder="48201"
                      autoComplete="postal-code"
                      disabled={working}
                    />
                  </label>
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setPendingAction(null)}
                disabled={working}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  pendingAction === 'delete'
                    ? styles.modalDanger
                    : styles.modalPrimary
                }
                onClick={runPendingAction}
                disabled={working}
              >
                {working ? 'Working…' : confirmLabel()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────

// Compact read-only card shown in place of the destination picker once
// the batch is no longer editable. Mirrors the selected destCard\u2019s
// visual weight but with no interaction.
function ReadonlyDestinationCard({ destination }) {
  const opt = DESTINATION_OPTIONS.find(o => o.id === destination)
  if (!opt) return null
  return (
    <div className={`${styles.destCard} ${styles.destCardReadonly}`}>
      <div className={styles.destCardTop}>
        <span className={styles.destCardLabel}>{opt.label}</span>
      </div>
      <div className={styles.destCardSub}>{opt.sub}</div>
    </div>
  )
}

// One row in the items list. Shows type + size + brand (if any) and a
// remove button while the batch is editable. Uses the wardrobe SLOT_BY_ID
// lookup to humanize item_type the same way Inventory + ItemDetail do.
function ItemRow({ item, removable, onRemove, disabled }) {
  const slot = item.item_type ? SLOT_BY_ID[item.item_type] : null
  const typeLabel =
    slot?.label ||
    CATEGORY_LABELS[item.category] ||
    humanizeItemType(item.item_type || item.category)
  const displayName = item.name || typeLabel
  const secondary = [item.size_label, item.brand].filter(Boolean).join(' · ')

  return (
    <li className={styles.itemRow}>
      <div className={styles.itemRowText}>
        <div className={styles.itemRowName}>{displayName}</div>
        {secondary && <div className={styles.itemRowMeta}>{secondary}</div>}
      </div>
      {item.quantity > 1 && (
        <span className={styles.itemRowQty}>×{item.quantity}</span>
      )}
      {removable && (
        <button
          type="button"
          className={styles.itemRowRemove}
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${displayName} from batch`}
        >
          ×
        </button>
      )}
    </li>
  )
}

// Returns a localized date string for a timeline step, or empty if the
// batch hasn't reached that step yet. Synthetic fulfilled_* keys share
// the single fulfilled_at timestamp.
function timelineDate(batch, stepKey) {
  if (!batch) return ''
  if (stepKey === 'draft') {
    return batch.created_at
      ? new Date(batch.created_at).toLocaleDateString()
      : ''
  }
  if (stepKey === 'bag_requested' && batch.label_requested_at) {
    return new Date(batch.label_requested_at).toLocaleDateString()
  }
  if (stepKey === 'bag_in_transit' && batch.bag_dispatched_at) {
    return new Date(batch.bag_dispatched_at).toLocaleDateString()
  }
  if (stepKey === 'shipped' && batch.shipped_at) {
    return new Date(batch.shipped_at).toLocaleDateString()
  }
  if (stepKey === 'received' && batch.received_at) {
    return new Date(batch.received_at).toLocaleDateString()
  }
  if (
    (stepKey === 'fulfilled' ||
      stepKey === 'fulfilled_matched' ||
      stepKey === 'fulfilled_donated') &&
    batch.fulfilled_at
  ) {
    return new Date(batch.fulfilled_at).toLocaleDateString()
  }
  return ''
}

function humanizeItemType(s) {
  if (!s) return 'Item'
  return s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}
