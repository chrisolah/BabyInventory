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
  const [tab, setTab] = useState('overview')
  const [windowId, setWindowId] = useState('7d')
  const [excludeAdmins, setExcludeAdmins] = useState(true)
  const [funnelId, setFunnelId] = useState('acquisition')
  const [northStar, setNorthStar] = useState(null)

  const window = useMemo(
    () => TIME_WINDOWS.find((w) => w.id === windowId) ?? TIME_WINDOWS[1],
    [windowId]
  )

  useEffect(() => {
    Promise.all([
      getActivationFunnel({ excludeAdmins }),
      getRegistryShareRate({ excludeAdmins }),
      getHouseholdSummary({ excludeAdmins }),
    ]).then(([act, share, hh]) => {
      const signedUp = act.find(r => r.stage === 'Signed up')
      const activated = act.find(r => r.stage === '1+ items owned')
      setNorthStar({
        households: hh.length,
        activationPct: activated ? activated.pct : 0,
        sharePct: share ? share.share_rate : 0,
      })
    }).catch(() => {})
  }, [excludeAdmins])

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

        {/* ── North star ── */}
        {northStar && (
          <div className={styles.northStar}>
            <div className={styles.nsCard}>
              <div className={styles.nsStat}>{northStar.households}</div>
              <div className={styles.nsLabel}>Households</div>
            </div>
            <div className={styles.nsDivider} />
            <div className={styles.nsCard}>
              <div className={styles.nsStat}>{northStar.activationPct}%</div>
              <div className={styles.nsLabel}>Activated (1+ item)</div>
            </div>
            <div className={styles.nsDivider} />
            <div className={styles.nsCard}>
              <div className={styles.nsStat}>{northStar.sharePct}%</div>
              <div className={styles.nsLabel}>Shared registry</div>
            </div>
          </div>
        )}

        <div className={styles.tabs} role="tablist" aria-label="Admin sections">
          {[
            ['overview', 'Overview'],
            ['users',    'Users'],
            ['product',  'Product'],
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
          {tab === 'overview' && (
            <OverviewTab sinceDays={window.days} excludeAdmins={excludeAdmins} />
          )}
          {tab === 'users' && <HouseholdsTab excludeAdmins={excludeAdmins} />}
          {tab === 'product' && (
            <ProductTab
              sinceDays={window.days}
              excludeAdmins={excludeAdmins}
              funnelId={funnelId}
              onFunnelChange={setFunnelId}
            />
          )}
        </div>
      </main>
    </div>
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

// ── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ sinceDays, excludeAdmins }) {
  const [visits, setVisits] = useState(null)
  const [activation, setActivation] = useState([])
  const [retention, setRetention] = useState([])
  const [ttf, setTtf] = useState(null)
  const [anon, setAnon] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getDailyVisits({ sinceDays, excludeAdmins }),
      getActivationFunnel({ excludeAdmins }),
      getRetention({ excludeAdmins }),
      getTimeToFirstItem({ excludeAdmins }),
      getAnonConversion(),
    ]).then(([v, act, ret, t, a]) => {
      setVisits(v); setActivation(act); setRetention(ret); setTtf(t); setAnon(a)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [sinceDays, excludeAdmins])

  if (loading) return <div className={styles.loading}>Loading…</div>

  const maxSessions = Math.max(...(visits||[]).map(r => Number(r.sessions)), 1)
  const topHouseholds = activation.find(r => r.stage === 'Signed up')?.households || 1

  return (
    <div className={styles.overviewGrid}>

      {/* Visits sparkline */}
      <div className={styles.overviewCard} style={{ gridColumn: 'span 2' }}>
        <div className={styles.overviewCardTitle}>Daily sessions</div>
        <div className={styles.miniStats}>
          {visits && <>
            <span><strong>{visits.reduce((a,r)=>a+Number(r.sessions),0)}</strong> sessions</span>
            <span><strong>{visits.reduce((a,r)=>a+Number(r.users),0)}</strong> users</span>
            <span><strong>{visits.reduce((a,r)=>a+Number(r.events),0)}</strong> events</span>
          </>}
        </div>
        <div className={styles.barList}>
          {(visits||[]).map(r => (
            <div key={r.day} className={styles.bar}>
              <div className={styles.barLabel}>{formatDay(r.day)}</div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(Number(r.sessions)/maxSessions)*100}%` }} />
              </div>
              <div className={styles.barValue}>{Number(r.sessions)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual activation funnel */}
      <div className={styles.overviewCard}>
        <div className={styles.overviewCardTitle}>Activation funnel</div>
        <div className={styles.visualFunnel}>
          {activation.map((row, i) => {
            const w = Math.max(20, row.pct)
            const colors = ['#2D8C6E','#3aab87','#52c4a0','#6dd9b8']
            return (
              <div key={row.stage} className={styles.funnelStage}>
                <div className={styles.funnelBarRow}>
                  <div className={styles.funnelBar}
                    style={{ width: `${w}%`, background: colors[i] || '#2D8C6E' }}>
                    <span className={styles.funnelPct}>{row.pct}%</span>
                  </div>
                </div>
                <div className={styles.funnelMeta}>
                  <span className={styles.funnelLabel}>{row.stage}</span>
                  <span className={styles.funnelCount}>{row.households} households</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Key metrics column */}
      <div className={styles.overviewCard}>
        <div className={styles.overviewCardTitle}>Key metrics</div>
        <div className={styles.metricStack}>
          <div className={styles.metricRow}>
            <div className={styles.metricLabel}>Median time to first item</div>
            <div className={styles.metricVal}>{ttf ? `${ttf.median_minutes}m` : '—'}</div>
          </div>
          <div className={styles.metricRow}>
            <div className={styles.metricLabel}>Avg time to first item</div>
            <div className={styles.metricVal}>{ttf ? `${ttf.avg_minutes}m` : '—'}</div>
          </div>
          <div className={styles.metricRow}>
            <div className={styles.metricLabel}>Trial → permanent</div>
            <div className={styles.metricVal}>{anon ? `${anon.conversion_rate}%` : '—'}</div>
          </div>
          <div className={styles.metricRow}>
            <div className={styles.metricLabel}>Anon still active</div>
            <div className={styles.metricVal}>{anon?.anon_active ?? '—'}</div>
          </div>
          <div className={styles.metricRow}>
            <div className={styles.metricLabel}>Permanent accounts</div>
            <div className={styles.metricVal}>{anon?.permanent_accounts ?? '—'}</div>
          </div>
        </div>

        <div className={styles.overviewCardTitle} style={{ marginTop: 20 }}>Retention by cohort</div>
        <table className={styles.growthTable}>
          <thead><tr><th>Cohort</th><th>Total</th><th>7d</th><th>30d</th></tr></thead>
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

    </div>
  )
}

// ── Product tab ───────────────────────────────────────────────────────────────
function ProductTab({ sinceDays, excludeAdmins, funnelId, onFunnelChange }) {
  const [pages, setPages] = useState(null)
  const [guides, setGuides] = useState(null)
  const [cats, setCats] = useState([])
  const [passAlong, setPassAlong] = useState([])
  const [funnelRows, setFunnelRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPageBreakdown({ sinceDays, excludeAdmins }),
      getGuideBreakdown({ sinceDays: Math.max(sinceDays, 30), excludeAdmins }),
      getCategoryDepth({ excludeAdmins }),
      getPassAlongFunnel({ excludeAdmins }),
      getFunnelRollup(funnelId, { sinceDays, excludeAdmins }),
    ]).then(([p, g, c, pa, f]) => {
      setPages(p); setGuides(g); setCats(c); setPassAlong(pa); setFunnelRows(f)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [sinceDays, excludeAdmins, funnelId])

  if (loading) return <div className={styles.loading}>Loading…</div>

  const maxCat = Math.max(...cats.map(c => c.items), 1)
  const maxPage = Math.max(...(pages||[]).map(p => Number(p.sessions)), 1)
  const topFunnel = Number(funnelRows[0]?.sessions) || 1

  return (
    <div className={styles.overviewGrid}>

      {/* Page breakdown */}
      <div className={styles.overviewCard}>
        <div className={styles.overviewCardTitle}>Pages</div>
        <div className={styles.barList}>
          {(pages||[]).slice(0,12).map(r => (
            <div key={r.page} className={styles.bar}>
              <div className={styles.barLabel} style={{ width: 90, fontSize: 11 }}>{r.page}</div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(Number(r.sessions)/maxPage)*100}%` }} />
              </div>
              <div className={styles.barValue}>{Number(r.sessions)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category depth */}
      <div className={styles.overviewCard}>
        <div className={styles.overviewCardTitle}>Items by category</div>
        <div className={styles.catBars}>
          {cats.map(row => (
            <div key={row.category} className={styles.catBarRow}>
              <span className={styles.catBarLabel}>{row.category}</span>
              <div className={styles.catBarTrack}>
                <div className={styles.catBarFill} style={{ width: `${(row.items/maxCat)*100}%` }} />
              </div>
              <span className={styles.catBarVal}>{row.items} · {row.households} hh</span>
            </div>
          ))}
        </div>
      </div>

      {/* Funnel */}
      <div className={styles.overviewCard}>
        <div className={styles.overviewCardTitle}>
          Event funnel —{' '}
          <select value={funnelId} onChange={e => onFunnelChange(e.target.value)}
            className={styles.funnelSelect}>
            {FUNNELS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div className={styles.visualFunnel}>
          {funnelRows.map((row, i) => {
            const w = Math.max(20, (Number(row.sessions)/topFunnel)*100)
            return (
              <div key={row.step} className={styles.funnelStage}>
                <div className={styles.funnelBarRow}>
                  <div className={styles.funnelBar}
                    style={{ width: `${w}%`, background: i === 0 ? '#2D8C6E' : '#4ABDA0' }}>
                    <span className={styles.funnelPct}>{Number(row.sessions)}</span>
                  </div>
                </div>
                <div className={styles.funnelMeta}>
                  <span className={styles.funnelLabel}>{row.event_name}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pass-along + Guides */}
      <div className={styles.overviewCard}>
        <div className={styles.overviewCardTitle}>Pass-along funnel</div>
        <table className={styles.growthTable}>
          <thead><tr><th>Stage</th><th>Batches</th><th>Households</th></tr></thead>
          <tbody>
            {passAlong.map(row => (
              <tr key={row.stage}>
                <td>{row.stage}</td><td>{row.batches}</td><td>{row.households}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {guides && guides.length > 0 && <>
          <div className={styles.overviewCardTitle} style={{ marginTop: 20 }}>Guide reads (30d)</div>
          <table className={styles.growthTable}>
            <thead><tr><th>Guide</th><th>Reads</th><th>Clicks</th></tr></thead>
            <tbody>
              {guides.slice(0,8).map(g => (
                <tr key={g.slug}>
                  <td style={{ fontSize: 11 }}>{g.slug}</td>
                  <td>{g.reads}</td><td>{g.affiliate_clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>}
      </div>

    </div>
  )
}
