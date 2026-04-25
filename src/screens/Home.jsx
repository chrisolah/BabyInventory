import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import BabySwitcher from '../components/BabySwitcher'
import InviteMemberModal from '../components/InviteMemberModal'
import TagScanner from '../components/TagScanner'
import styles from './Home.module.css'

// Home is the signed-in landing page for the inventory app. For now it's a
// shell: a persistent header (brand + "Invite member" button) and an empty-
// state card inviting the user to start their inventory.
//
// Home ALSO acts as the onboarding + "already-started" gate. PublicRoute's
// declarative redirect beats Signup/Login's imperative `navigate(...)` when
// the auth state flips, so any post-auth path funnels through /home first.
// From here we do two checks in order:
//   1. onboarding_step < 4 → /onboarding (incomplete profile)
//   2. any clothing_items exist → /inventory (they've started; the empty-
//      state card on Home is the wrong frame once the inventory isn't empty)
// Everyone else stays on Home and sees the "Start your inventory" card.
//
// The "Invite household member" button lives in the header so it's accessible
// from any scroll position and survives as we build out more body content.
// Invite plumbing (pending_invites + email delivery) isn't wired yet, so the
// modal currently just collects the email and fires an analytics event — we
// say so in the helper note to set expectations honestly.
export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { reloadItems } = useHousehold()
  const [showInvite, setShowInvite] = useState(false)
  // 'checking' until we know onboarding is complete; 'ready' once we do.
  // We never transition to an "incomplete" state because we just redirect.
  const [status, setStatus] = useState('checking')

  const firstName = user?.user_metadata?.name?.split(' ')[0] ?? ''

  // Onboarding gate. Runs once per mounted user. If the summary query fails
  // (e.g. migration 003 hasn't been applied in this env), we log and let the
  // user stay on Home rather than trapping them in a redirect loop.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function check() {
      const { data, error } = await supabase
        .schema(currentSchema)
        .from('user_activity_summary')
        .select('onboarding_step')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Onboarding gate: user_activity_summary query failed —', error.message)
        setStatus('ready')
        return
      }

      const step = data?.onboarding_step ?? 0
      if (step < 4) {
        navigate('/onboarding', { replace: true })
        return
      }

      // Onboarding done — if they've already added anything, skip the empty
      // "Start your inventory" framing and drop them straight on /inventory.
      // RLS scopes this to households the user belongs to, so a single-row
      // head-count query is enough; no need to resolve the household first.
      const { count, error: countErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('id', { count: 'exact', head: true })
        .limit(1)

      if (cancelled) return

      if (countErr) {
        // Don't trap the user if the count query fails (e.g. migration 006
        // hasn't landed in this env). Fall back to the empty-state Home.
        // eslint-disable-next-line no-console
        console.warn('Home: clothing_items count failed —', countErr.message)
        setStatus('ready')
        return
      }

      if ((count ?? 0) > 0) {
        navigate('/inventory', { replace: true })
        return
      }

      setStatus('ready')
    }

    check()
    return () => { cancelled = true }
  }, [user, navigate])

  function openInvite() {
    track.householdInviteOpened('home_header')
    setShowInvite(true)
  }

  function closeInvite() {
    setShowInvite(false)
  }

  // Home's scan entry point hands off to /add-item with the scanned fields
  // on the URL. We funnel everything through the same AddItem screen so
  // there's one confirm surface to maintain, and so a user who scans and
  // then edits an existing field still lands in the same familiar form.
  // Fields the model returned as null are just omitted from the URL.
  function onHomeScanResult(fields) {
    if (!fields) return
    const params = new URLSearchParams({ mode: 'owned' })
    if (fields.category)   params.set('category',  fields.category)
    if (fields.item_type)  params.set('from_slot', fields.item_type)
    if (fields.size_label) params.set('size',      fields.size_label)
    if (fields.brand)      params.set('brand',     fields.brand.slice(0, 80))
    const filled = ['category','item_type','size_label','brand']
      .reduce((n, k) => n + (fields[k] ? 1 : 0), 0)
    track.tagScanCompleted({ filled, from: 'home' })
    navigate(`/add-item?${params.toString()}`)
  }

  // Batch save path. The single-scan path (onHomeScanResult) routes through
  // /add-item so the user confirms the prefilled form. Batch mode skips that
  // confirm step — BatchReview saves N rows directly into clothing_items —
  // so we just refresh the household items cache and drop the user on
  // /inventory with a toast that calls out the count.
  function onHomeBatchSaved(count) {
    reloadItems()
    navigate('/inventory', {
      state: { toast: `Added ${count} item${count === 1 ? '' : 's'}` },
    })
  }

  if (status === 'checking') {
    // Brief blank screen while we resolve the gate. Keeps the page from
    // flashing "Welcome" at users we're about to redirect.
    return <div className={styles.page} />
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <div className={styles.brand}>Sprig</div>
          {/* Mobile-only sprig beneath the brand. Hidden on desktop. */}
          <IvySprig />
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.inviteBtn}
            onClick={openInvite}
            aria-label="Invite household member"
          >
            <svg
              className={styles.inviteIcon}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 3.5v9M3.5 8h9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Invite member
          </button>
          <ProfileMenu />
        </div>
      </header>

      {/* Chip switcher — self-hides for single-baby households. Lets a
          multi-baby parent pre-scope from the landing page, though the
          actual filtering happens once they hit /inventory. */}
      <BabySwitcher from="home" />

      <main className={styles.body}>
        <h1 className={styles.greeting}>
          {firstName ? `Hi, ${firstName}` : 'Welcome'}
        </h1>
        <p className={styles.sub}>
          Your inventory lives here. Add what you have, and we'll help you keep
          track of sizes, gaps, and outgrown items.
        </p>

        {/* Scan-a-tag is the headline CTA. "Start your inventory" remains
            beneath it for users who prefer to go straight to manual entry
            or for cases where the camera hand-off fails. */}
        <div className={styles.scanBlock}>
          <TagScanner
            variant="primary"
            onResult={onHomeScanResult}
            onBatchSaved={onHomeBatchSaved}
          />
          <div className={styles.scanCaption}>
            Snap a clothing tag and we&rsquo;ll fill in brand, size, and type.
            Got a stack to add? Tap <strong>Scan many</strong> in the camera to
            scan several in a row.
          </div>
        </div>

        <button
          type="button"
          className={styles.emptyCard}
          onClick={() => navigate('/inventory')}
        >
          <div className={styles.emptyTitle}>Start your inventory</div>
          <div className={styles.emptySub}>
            Tap here to see your wardrobe and add your first item — a onesie,
            sleepsuit, anything you already have.
          </div>
        </button>
      </main>

      {showInvite && (
        <InviteMemberModal from="home_header" onClose={closeInvite} />
      )}
    </div>
  )
}
