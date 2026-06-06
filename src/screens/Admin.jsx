// Admin analytics + records dashboard. Three tabs share a global toolbar
// (time-window chips + "Hide my sessions" toggle). All data comes from
// SECURITY DEFINER RPCs declared in 20260501120000_admin_views.sql; the
// AdminGuard route guard upstream gates entry on email allowlist.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getDailyVisits,
  getFunnelRollup,
  getHouseholdSummary,
  getPageBreakdown,
  getGuideBreakdown,
  getActivationFunnel,
  getTimeToFirstItem,
  getAnonConversion,
  getRegistryShareRate,
  getRetention,
  getCategoryDepth,
  getPassAlongFunnel,
  FUNNELS,
  TIME_WINDOWS,
} from '../lib/admin'
import styles from './Admin.module.css'

export default function Admin() {
  const [tab, setTab] = useState('visits')
  const [windowId, setWindowId] = useState('7d')
  const [excludeAdmins, setExcludeAdmins] = useState(true)
  const [funnelId, setFunnelId] = useState('acquisition')

  const window = useMemo(
    () => TIME_WINDOWS.find((w) => w.id === windowId) ?? TIME_WINDOWS[1],
    [windowId]
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleCell}>
          <div className={styles.title}>Admin</div>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.exit} to="/home">Exit</Link>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.toolbar}>
          <div className={styles.windowChips} role="tablist" aria-label="Time window">
            {TIME_WINDOWS.map((w) => (
              <button
                key={w.id}
                className={`${styles.chip} ${windowId === w.id ? styles.chipActive : ''}`}
                onClick={() => setWindowId(w.id)}
                aria-pressed={windowId === w.id}
              >
                {w.label}
              </button>
            ))}
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={excludeAdmins}
              onChange={(e) => setExcludeAdmins(e.target.checked)}
            />
            <span>Hide my sessions</span>
          </label>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Admin sections">
          {[
            ['visits', 'Visits'],
            ['pages', 'Pages'],
            ['funnel', 'Funnel'],
            ['households', 'Households'],
            ['growth', 'Growth'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
              onClick={() => setTab(id)}
              aria-selected={tab === id}
              role="tab"
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.tabPanel}>
          {tab === 'visits' && (
            <VisitsTab sinceDays={window.days} excludeAdmins={excludeAdmins} />
          )}
          {tab === 'pages' && (
            <PagesTab sinceDays={window.days} excludeAdmins={excludeAdmins} />
          )}
          {tab === 'funnel' && (
            <FunnelTab
              funnelId={funnelId}
              onFunnelChange={setFunnelId}
              sinceDays={window.days}
              excludeAdmins={excludeAdmins}
            />
          )}
          {tab === 'households' && <HouseholdsTab excludeAdmins={excludeAdmins} />}
          {tab === 'growth' && <GrowthTab excludeAdmins={excludeAdmins} />}
        </div>
      </main>
    </div>
  )
}

// ── Visits tab ─────────────────────────────────────────────────────────────
function VisitsTab({ sinceDays, excludeAdmins }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    getDailyVisits({ sinceDays, excludeAdmins })
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((err) => { if (!cancelled) setError(err?.message ?? String(err)) })
    return () => { cancelled = true }
  }, [sinceDays, excludeAdmins])

  if (error) return <div className={styles.error}>Couldn't load visits: {error}</div>
  if (!rows) return <div className={styles.loading}>Loading…</div>
  if (rows.length === 0) return <div className={styles.empty}>No visits in this window.</div>

  const max = Math.max(...rows.map((r) => Number(r.sessions)), 1)
  const totalSessions = rows.reduce((acc, r) => acc + Number(r.sessions), 0)
  const totalUsers = rows.reduce((acc, r) => acc + Number(r.users), 0)
  const totalEvents = rows.reduce((acc, r) => acc + Number(r.events), 0)

  return (
    <>
      <div className={styles.summaryRow}>
        <Stat label="Sessions" value={totalSessions} />
        <Stat label="Users" value={totalUsers} />
        <Stat label="Events" value={totalEvents} />
      </div>
      <div className={styles.barList}>
        {rows.map((r) => (
          <div key={r.day} className={styles.bar}>
            <div className={styles.barLabel}>{formatDay(r.day)}</div>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${(Number(r.sessions) / max) * 100}%` }}
              />
            </div>
            <div className={styles.barValue}>{Number(r.sessions)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Pages tab ──────────────────────────────────────────────────────────────
function PagesTab({ sinceDays, excludeAdmins }) {
  const [pages, setPages] = useState(null)
  const [guides, setGuides] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setPages(null); setGuides(null); setError(null)
    Promise.all([
      getPageBreakdown({ sinceDays, excludeAdmins }),
      getGuideBreakdown({ sinceDays: Math.max(sinceDays, 30), excludeAdmins }),
    ])
      .then(([p, g]) => { if (!cancelled) { setPages(p); setGuides(g) } })
      .catch((err) => { if (!cancelled) setError(err?.message ?? String(err)) })
    return () => { cancelled = true }
  }, [sinceDays, excludeAdmins])

  if (error) return <div className={styles.error}>Couldn't load page data: {error}</div>
  if (!pages) return <div className={styles.loading}>Loading…</div>

  const PAGE_LABELS = {
    landing:      'Landing',
    how_it_works: 'How it works',
    guides:       'Guides listing',
    guide_detail: 'Guide articles',
    about:        'About',
    contact:      'Contact',
    privacy:      'Privacy',
    terms:        'Terms',
    login:        'Login',
    signup:       'Signup',
    home:         'Home (app)',
    inventory:    'Inventory',
    plan:         'Plan',
    'pass-along': 'Pass Along',
    item:         'Item detail',
    'add-item':   'Add item',
    onboarding:   'Onboarding',
    profile:      'Profile',
    wishlist:     'Wishlist (public)',
  }

  return (
    <>
      <h3 className={styles.sectionHeading}>Traffic by page</h3>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>Page</th>
            <th className={styles.colNum}>Sessions</th>
            <th className={styles.colNum}>Signed-in users</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((row) => (
            <tr key={row.page}>
              <td>{PAGE_LABELS[row.page] ?? row.page}</td>
              <td className={styles.colNum}>{Number(row.sessions).toLocaleString()}</td>
              <td className={styles.colNum}>{Number(row.users).toLocaleString()}</td>
            </tr>
          ))}
          {pages.length === 0 && (
            <tr><td colSpan={3} className={styles.empty}>No page views in this window.</td></tr>
          )}
        </tbody>
      </table>

      {guides && guides.length > 0 && (
        <>
          <h3 className={styles.sectionHeading} style={{ marginTop: '2rem' }}>Guide reads</h3>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Guide</th>
                <th className={styles.colNum}>Reads</th>
                <th className={styles.colNum}>Unique readers</th>
                <th className={styles.colNum}>Affiliate clicks</th>
              </tr>
            </thead>
            <tbody>
              {guides.map((row) => (
                <tr key={row.slug}>
                  <td style={{ fontSize: '12px', maxWidth: '240px', wordBreak: 'break-word' }}>{row.slug}</td>
                  <td className={styles.colNum}>{Number(row.reads).toLocaleString()}</td>
                  <td className={styles.colNum}>{Number(row.unique_readers).toLocaleString()}</td>
                  <td className={styles.colNum}>{Number(row.affiliate_clicks).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}

// ── Funnel tab ─────────────────────────────────────────────────────────────
function FunnelTab({ funnelId, onFunnelChange, sinceDays, excludeAdmins }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    getFunnelRollup(funnelId, { sinceDays, excludeAdmins })
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((err) => { if (!cancelled) setError(err?.message ?? String(err)) })
    return () => { cancelled = true }
  }, [funnelId, sinceDays, excludeAdmins])

  return (
    <>
      <div className={styles.funnelPicker}>
        <label htmlFor="funnel-select" className={styles.funnelLabel}>
          Funnel
        </label>
        <select
          id="funnel-select"
          className={styles.select}
          value={funnelId}
          onChange={(e) => onFunnelChange(e.target.value)}
        >
          {FUNNELS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>

      {error && <div className={styles.error}>Couldn't load funnel: {error}</div>}
      {!rows && !error && <div className={styles.loading}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div className={styles.empty}>No events for this funnel in this window.</div>
      )}
      {rows && rows.length > 0 && (
        <div className={styles.barList}>
          {rows.map((r, i) => {
            const sessions = Number(r.sessions)
            const top = Number(rows[0].sessions) || 1
            const conv = i === 0 ? null : (sessions / top) * 100
            return (
              <div key={r.step} className={styles.funnelStep}>
                <div className={styles.funnelStepHeader}>
                  <span className={styles.funnelStepName}>
                    <span className={styles.funnelStepNum}>{r.step}</span>
                    {r.event_name}
                  </span>
                  <span className={styles.funnelStepCount}>
                    {sessions}
                    {conv !== null && (
                      <span className={styles.funnelConv}> ({conv.toFixed(0)}%)</span>
                    )}
                  </span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(sessions / top) * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Households tab ────────────────────────────────────────────────────────
function HouseholdsTab({ excludeAdmins }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    getHouseholdSummary({ excludeAdmins })
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((err) => { if (!cancelled) setError(err?.message ?? String(err)) })
    return () => { cancelled = true }
  }, [excludeAdmins])

  if (error) return <div className={styles.error}>Couldn't load households: {error}</div>
  if (!rows) return <div className={styles.loading}>Loading…</div>
  if (rows.length === 0) return <div className={styles.empty}>No households yet.</div>

  return (
    <ul className={styles.householdList}>
      {rows.map((h) => {
        const isOpen = expanded === h.household_id
        return (
          <li key={h.household_id} className={styles.household}>
            <button
              className={styles.householdRow}
              onClick={() => setExpanded(isOpen ? null : h.household_id)}
              aria-expanded={isOpen}
            >
              <div className={styles.householdName}>
                {h.household_name || '(unnamed household)'}
              </div>
              <div className={styles.householdMeta}>
                {h.member_count} {h.member_count === 1 ? 'member' : 'members'} ·{' '}
                {h.baby_count} {h.baby_count === 1 ? 'baby' : 'babies'} ·{' '}
                {h.item_count} {h.item_count === 1 ? 'item' : 'items'}
              </div>
              <div className={styles.householdLast}>
                {h.last_event_at
                  ? `Active ${timeAgo(h.last_event_at)}`
                  : `Created ${timeAgo(h.created_at)}`}
              </div>
            </button>
            {isOpen && (
              <div className={styles.householdDetail}>
                <DetailRow label="Members" items={h.member_emails} fallback="(unknown email)" />
                <DetailRow label="Babies" items={h.baby_names} fallback="(unnamed)" />
                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>Created</div>
                  <div>{new Date(h.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function DetailRow({ label, items, fallback }) {
  const list = items ?? []
  return (
    <div className={styles.detailRow}>
      <div className={styles.detailLabel}>{label}</div>
      {list.length === 0 ? (
        <div className={styles.detailEmpty}>—</div>
      ) : (
        <ul className={styles.detailList}>
          {list.map((it, i) => (
            <li key={i}>{it ?? fallback}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value.toLocaleString()}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

function formatDay(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = now - then
  const min = 60 * 1000
  const hr = 60 * min
  const day = 24 * hr
  if (diffMs < min) return 'just now'
  if (diffMs < hr) return `${Math.round(diffMs / min)}m ago`
  if (diffMs < day) return `${Math.round(diffMs / hr)}h ago`
  if (diffMs < 30 * day) return `${Math.round(diffMs / day)}d ago`
  return new Date(iso).toLocaleDateString()
}

// ── Growth Tab ────────────────────────────────────────────────────────────────

function GrowthTab({ excludeAdmins }) {
  const [loading, setLoading] = useState(true)
  const [activation, setActivation] = useState([])
  const [timeToFirst, setTimeToFirst] = useState(null)
  const [anon, setAnon] = useState(null)
  const [shareRate, setShareRate] = useState(null)
  const [retention, setRetention] = useState([])
  const [categories, setCategories] = useState([])
  const [passAlong, setPassAlong] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeAdmins])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [act, ttf, anv, sr, ret, cats, pa] = await Promise.all([
        getActivationFunnel({ excludeAdmins }),
        getTimeToFirstItem({ excludeAdmins }),
        getAnonConversion(),
        getRegistryShareRate({ excludeAdmins }),
        getRetention({ excludeAdmins }),
        getCategoryDepth({ excludeAdmins }),
        getPassAlongFunnel({ excludeAdmins }),
      ])
      setActivation(act)
      setTimeToFirst(ttf)
      setAnon(anv)
      setShareRate(sr)
      setRetention(ret)
      setCategories(cats)
      setPassAlong(pa)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className={styles.loading}>Loading growth metrics…</div>
  if (error)   return <div className={styles.error}>{error}</div>

  const maxCatItems = Math.max(...categories.map(c => c.items), 1)

  return (
    <div className={styles.growthGrid}>

      {/* ── Activation funnel ── */}
      <div className={styles.growthCard} style={{ gridColumn: 'span 2' }}>
        <div className={styles.growthCardTitle}>Activation funnel</div>
        <table className={styles.growthTable}>
          <thead><tr><th>Stage</th><th>Households</th><th>%</th></tr></thead>
          <tbody>
            {activation.map(row => (
              <tr key={row.stage}>
                <td>{row.stage}</td>
                <td>{row.households}</td>
                <td>
                  <div className={styles.growthBarWrap}>
                    <div className={styles.growthBar} style={{ width: `${row.pct}%` }} />
                    <span>{row.pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Quick stat cards ── */}
      <div className={styles.growthCard}>
        <div className={styles.growthCardTitle}>Time to first item</div>
        <div className={styles.bigStat}>
          {timeToFirst ? `${timeToFirst.median_minutes}m` : '—'}
        </div>
        <div className={styles.bigStatSub}>
          median &nbsp;·&nbsp; avg {timeToFirst?.avg_minutes ?? '—'}m &nbsp;·&nbsp; n={timeToFirst?.sample_size ?? 0}
        </div>
      </div>

      <div className={styles.growthCard}>
        <div className={styles.growthCardTitle}>Trial → permanent</div>
        <div className={styles.bigStat}>
          {anon ? `${anon.conversion_rate}%` : '—'}
        </div>
        <div className={styles.bigStatSub}>
          {anon?.permanent_accounts ?? 0} permanent &nbsp;·&nbsp; {anon?.anon_active ?? 0} still anon
        </div>
      </div>

      <div className={styles.growthCard}>
        <div className={styles.growthCardTitle}>Registry share rate</div>
        <div className={styles.bigStat}>
          {shareRate ? `${shareRate.share_rate}%` : '—'}
        </div>
        <div className={styles.bigStatSub}>
          {shareRate?.households_shared ?? 0} of {shareRate?.households_with_items ?? 0} households
        </div>
      </div>

      {/* ── Retention ── */}
      <div className={styles.growthCard} style={{ gridColumn: 'span 2' }}>
        <div className={styles.growthCardTitle}>Retention by cohort</div>
        <table className={styles.growthTable}>
          <thead>
            <tr><th>Cohort</th><th>Total</th><th>Active 7d</th><th>Active 30d</th></tr>
          </thead>
          <tbody>
            {retention.map(row => (
              <tr key={row.cohort}>
                <td>{row.cohort}</td>
                <td>{row.total}</td>
                <td>{row.active_7d} <span className={styles.pct}>({row.retention_7d}%)</span></td>
                <td>{row.active_30d} <span className={styles.pct}>({row.retention_30d}%)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Category depth ── */}
      <div className={styles.growthCard} style={{ gridColumn: 'span 2' }}>
        <div className={styles.growthCardTitle}>Items by category</div>
        <div className={styles.catBars}>
          {categories.map(row => (
            <div key={row.category} className={styles.catBarRow}>
              <span className={styles.catBarLabel}>{row.category}</span>
              <div className={styles.catBarTrack}>
                <div className={styles.catBarFill}
                  style={{ width: `${(row.items / maxCatItems) * 100}%` }} />
              </div>
              <span className={styles.catBarVal}>{row.items} items · {row.households} hh</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pass-along funnel ── */}
      <div className={styles.growthCard}>
        <div className={styles.growthCardTitle}>Pass-along funnel</div>
        <table className={styles.growthTable}>
          <thead><tr><th>Stage</th><th>Batches</th><th>Households</th></tr></thead>
          <tbody>
            {passAlong.map(row => (
              <tr key={row.stage}>
                <td>{row.stage}</td>
                <td>{row.batches}</td>
                <td>{row.households}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
