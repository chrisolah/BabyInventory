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
  getPageAuthSplit,
  getGuideBreakdown,
  getGuideReadsByDay,
  getActivationFunnel,
  getTimeToFirstItem,
  getAnonConversion,
  getRegistryShareRate,
  getRetention,
  getCategoryDepth,
  getPassAlongFunnel,
  getReferrerBreakdown,
  getAuthSplit,
  getHouseholdEventStream,
  FUNNELS,
  TIME_WINDOWS,
} from '../lib/admin'
import { GUIDES } from '../lib/guides'

const GUIDE_TITLE = Object.fromEntries(GUIDES.map(g => [g.slug, g.title]))
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
            ['guides',   'Guides'],
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
          {tab === 'guides' && (
            <GuidesTab sinceDays={window.days} excludeAdmins={excludeAdmins} />
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
  const [userFilter, setUserFilter] = useState('all')

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
  if (rows.length === 0) return <div className={styles.empty}>No households yet.</div> // 'all' | 'accounts' | 'trial'

  const accounts = rows.filter(h => !h.is_trial)
  const trials   = rows.filter(h => h.is_trial)
  const convRate = rows.length > 0
    ? Math.round((accounts.length / rows.length) * 100)
    : 0

  const visibleAccounts = userFilter !== 'trial'  ? accounts : []
  const visibleTrials   = userFilter !== 'accounts' ? trials : []

  return (
    <div>
      <div className={styles.usersSplit}>
        <button
          className={`${styles.usersSplitStat} ${userFilter === 'accounts' ? styles.usersSplitActive : ''}`}
          onClick={() => setUserFilter(f => f === 'accounts' ? 'all' : 'accounts')}
        >
          <span className={styles.usersSplitVal}>{accounts.length}</span>
          <span className={styles.usersSplitLabel}>accounts</span>
        </button>
        <button
          className={`${styles.usersSplitStat} ${userFilter === 'trial' ? styles.usersSplitActive : ''}`}
          onClick={() => setUserFilter(f => f === 'trial' ? 'all' : 'trial')}
        >
          <span className={styles.usersSplitVal}>{trials.length}</span>
          <span className={styles.usersSplitLabel}>in trial</span>
        </button>
        <div className={styles.usersSplitStat}>
          <span className={styles.usersSplitVal}>{convRate}%</span>
          <span className={styles.usersSplitLabel}>trial → account</span>
        </div>
      </div>

      {visibleAccounts.length > 0 && (
        <>
          <div className={styles.usersSectionHead}>Accounts ({accounts.length})</div>
          <HouseholdList rows={visibleAccounts} expanded={expanded} setExpanded={setExpanded} />
        </>
      )}

      {visibleTrials.length > 0 && (
        <>
          <div className={styles.usersSectionHead}>Trial — not yet signed up ({trials.length})</div>
          <HouseholdList rows={visibleTrials} expanded={expanded} setExpanded={setExpanded} />
        </>
      )}

      {visibleAccounts.length === 0 && visibleTrials.length === 0 && (
        <div className={styles.empty}>No results for this filter.</div>
      )}
    </div>
  )
}

function HouseholdList({ rows, expanded, setExpanded }) {
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
                {h.is_trial && <span className={styles.trialBadge}>trial</span>}
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
                <DetailRow label="Members" items={h.member_emails} fallback="(no email — trial user)" />
                <DetailRow label="Babies" items={h.baby_names} fallback="(unnamed)" />
                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>Created</div>
                  <div>{new Date(h.created_at).toLocaleDateString()}</div>
                </div>
                {!h.is_trial && (
                  <div className={styles.detailRow}>
                    <div className={styles.detailLabel}>Activity</div>
                    <HouseholdEventStream householdId={h.household_id} />
                  </div>
                )}
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

function HouseholdEventStream({ householdId }) {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getHouseholdEventStream({ householdId })
      .then(data => { if (!cancelled) setEvents(data) })
      .catch(err => { if (!cancelled) setError(err?.message ?? String(err)) })
    return () => { cancelled = true }
  }, [householdId])

  if (error) return <div className={styles.detailEmpty}>Error loading activity</div>
  if (!events) return <div className={styles.detailEmpty}>Loading…</div>
  if (events.length === 0) return <div className={styles.detailEmpty}>No events yet</div>

  return (
    <div className={styles.eventStream}>
      {events.slice(0, 80).map((e, i) => {
        const props = e.properties ?? {}
        const detail =
          e.event_name === 'page_viewed'       ? (props.page ?? '') :
          e.event_name === 'guide_read'        ? (props.slug ?? '') :
          e.event_name === 'affiliate_link_clicked' ? (props.product ?? props.guide ?? '') :
          e.event_name === 'item_saved'        ? (props.category ?? '') :
          e.event_name === 'item_category_selected' ? (props.category ?? '') :
          e.event_name === 'cta_clicked'       ? (props.cta ?? '') :
          ''
        return (
          <div key={i} className={styles.eventRow}>
            <div className={styles.eventTime}>{timeAgo(e.created_at)}</div>
            <div className={styles.eventName}>
              {e.event_name}
              {detail ? <span className={styles.eventDetail}> — {detail}</span> : null}
            </div>
            <div className={styles.eventDevice}>{e.device_type ?? ''}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Guides tab ───────────────────────────────────────────────────────────────
function GuidesTab({ sinceDays, excludeAdmins }) {
  const [breakdown, setBreakdown] = useState(null)
  const [daily, setDaily] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getGuideBreakdown({ sinceDays: Math.max(sinceDays, 30), excludeAdmins }),
      getGuideReadsByDay({ sinceDays: Math.max(sinceDays, 30), excludeAdmins }),
    ]).then(([b, d]) => {
      setBreakdown(b); setDaily(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [sinceDays, excludeAdmins])

  if (loading) return <div className={styles.loading}>Loading…</div>

  const totalReads      = (breakdown || []).reduce((s, g) => s + Number(g.reads), 0)
  const totalUnique     = (breakdown || []).reduce((s, g) => s + Number(g.unique_readers), 0)
  const totalAffiliate  = (breakdown || []).reduce((s, g) => s + Number(g.affiliate_clicks), 0)
  const guidesWithReads = (breakdown || []).filter(g => Number(g.reads) > 0).length
  const topGuide        = breakdown?.[0]
  const maxReads        = Math.max(...(breakdown || []).map(g => Number(g.reads)), 1)
  const maxDaily        = Math.max(...(daily || []).map(d => Number(d.reads)), 1)

  const affiliateGuides = (breakdown || [])
    .filter(g => Number(g.affiliate_clicks) > 0)
    .sort((a, b) => Number(b.affiliate_clicks) - Number(a.affiliate_clicks))

  return (
    <div className={styles.overviewGrid}>

      {/* Summary row — span 2 */}
      <div className={styles.overviewCard} style={{ gridColumn: 'span 2' }}>
        <div className={styles.overviewCardTitle}>Guide performance (last {sinceDays <= 30 ? '30' : sinceDays}d)</div>
        <div className={styles.northStar} style={{ marginTop: 8 }}>
          <div className={styles.nsCard}>
            <div className={styles.nsStat}>{totalReads.toLocaleString()}</div>
            <div className={styles.nsLabel}>Total reads</div>
          </div>
          <div className={styles.nsDivider} />
          <div className={styles.nsCard}>
            <div className={styles.nsStat}>{totalUnique.toLocaleString()}</div>
            <div className={styles.nsLabel}>Unique readers</div>
          </div>
          <div className={styles.nsDivider} />
          <div className={styles.nsCard}>
            <div className={styles.nsStat}>{guidesWithReads}</div>
            <div className={styles.nsLabel}>Guides read</div>
          </div>
          <div className={styles.nsDivider} />
          <div className={styles.nsCard}>
            <div className={styles.nsStat}>{totalAffiliate}</div>
            <div className={styles.nsLabel}>Affiliate clicks</div>
          </div>
          {topGuide && <>
            <div className={styles.nsDivider} />
            <div className={styles.nsCard} style={{ flex: 2 }}>
              <div className={styles.nsStat} style={{ fontSize: 14, fontWeight: 500 }}>
                {GUIDE_TITLE[topGuide.slug] || topGuide.slug}
              </div>
              <div className={styles.nsLabel}>Top guide — {topGuide.reads} reads</div>
            </div>
          </>}
        </div>
      </div>

      {/* Reads over time — span 2 */}
      <div className={styles.overviewCard} style={{ gridColumn: 'span 2' }}>
        <div className={styles.overviewCardTitle}>Guide reads over time</div>
        {daily && daily.length > 0 ? (
          <div className={styles.barList}>
            {daily.map(r => (
              <div key={r.day} className={styles.bar}>
                <div className={styles.barLabel}>{formatDay(r.day)}</div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(Number(r.reads) / maxDaily) * 100}%` }} />
                </div>
                <div className={styles.barValue}>{Number(r.reads)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>No guide reads in this window yet.</div>
        )}
      </div>

      {/* Per-guide leaderboard */}
      <div className={styles.overviewCard} style={{ gridColumn: 'span 2' }}>
        <div className={styles.overviewCardTitle}>All guides — reads ranking</div>
        {breakdown && breakdown.length > 0 ? (
          <div className={styles.guideLeaderboard}>
            {breakdown.map((g, i) => {
              const pct = Math.round((Number(g.reads) / maxReads) * 100)
              const ctr = Number(g.reads) > 0
                ? Math.round((Number(g.affiliate_clicks) / Number(g.reads)) * 100)
                : 0
              return (
                <div key={g.slug} className={styles.guideRow}>
                  <div className={styles.guideRank}>{i + 1}</div>
                  <div className={styles.guideInfo}>
                    <div className={styles.guideTitle}>
                      {GUIDE_TITLE[g.slug] || g.slug}
                    </div>
                    <div className={styles.guideBar}>
                      <div className={styles.guideBarFill} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className={styles.guideStats}>
                    <span className={styles.guideStat}>{Number(g.reads)} reads</span>
                    <span className={styles.guideStat}>{Number(g.unique_readers)} uniq</span>
                    {Number(g.affiliate_clicks) > 0 && (
                      <span className={styles.guideStatAffiliate}>
                        {Number(g.affiliate_clicks)} clicks · {ctr}% CTR
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.empty}>No guide reads recorded yet.</div>
        )}
      </div>

      {/* Affiliate performance */}
      {affiliateGuides.length > 0 && (
        <div className={styles.overviewCard}>
          <div className={styles.overviewCardTitle}>Affiliate clicks by guide</div>
          <table className={styles.growthTable}>
            <thead>
              <tr><th>Guide</th><th>Reads</th><th>Clicks</th><th>CTR</th></tr>
            </thead>
            <tbody>
              {affiliateGuides.map(g => {
                const ctr = Number(g.reads) > 0
                  ? Math.round((Number(g.affiliate_clicks) / Number(g.reads)) * 100)
                  : 0
                return (
                  <tr key={g.slug}>
                    <td style={{ fontSize: 11 }}>{GUIDE_TITLE[g.slug] || g.slug}</td>
                    <td>{Number(g.reads)}</td>
                    <td>{Number(g.affiliate_clicks)}</td>
                    <td>{ctr}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
  const [, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
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
  const [authSplit, setAuthSplit] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getDailyVisits({ sinceDays, excludeAdmins }),
      getActivationFunnel({ excludeAdmins }),
      getRetention({ excludeAdmins }),
      getTimeToFirstItem({ excludeAdmins }),
      getAnonConversion(),
      getAuthSplit({ sinceDays, excludeAdmins }),
    ]).then(([v, act, ret, t, a, split]) => {
      setVisits(v); setActivation(act); setRetention(ret); setTtf(t); setAnon(a); setAuthSplit(split)
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

      {/* Auth split — logged-in vs anonymous */}
      {authSplit.length > 0 && (() => {
        const li = authSplit.find(r => r.auth_state === 'logged_in') ?? { sessions: 0, users: 0, page_views: 0 }
        const anon2 = authSplit.find(r => r.auth_state === 'anonymous') ?? { sessions: 0, users: 0, page_views: 0 }
        const maxS = Math.max(Number(li.sessions), Number(anon2.sessions), 1)
        return (
          <div className={styles.overviewCard} style={{ gridColumn: 'span 2' }}>
            <div className={styles.overviewCardTitle}>Sessions — logged in vs anonymous</div>
            <div className={styles.authSplitList}>
              {[
                { label: 'Logged in', color: 'var(--teal)', row: li },
                { label: 'Anonymous', color: '#d1d5db', row: anon2 },
              ].map(({ label, color, row }) => (
                <div key={label} className={styles.authSplitRow}>
                  <div className={styles.authSplitLabel}>{label}</div>
                  <div className={styles.authSplitBarTrack}>
                    <div className={styles.authSplitBarFill}
                      style={{ width: `${(Number(row.sessions)/maxS)*100}%`, background: color }} />
                  </div>
                  <div className={styles.authSplitNums}>
                    <strong>{Number(row.sessions)}</strong> sessions
                    {' · '}<strong>{Number(row.users)}</strong> users
                    {' · '}<strong>{Number(row.page_views)}</strong> pages
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

    </div>
  )
}

// ── Product tab ───────────────────────────────────────────────────────────────
function ProductTab({ sinceDays, excludeAdmins, funnelId, onFunnelChange }) {
  const [pages, setPages] = useState(null)
  const [cats, setCats] = useState([])
  const [passAlong, setPassAlong] = useState([])
  const [funnelRows, setFunnelRows] = useState([])
  const [referrers, setReferrers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPageAuthSplit({ sinceDays, excludeAdmins }),
      getCategoryDepth({ excludeAdmins }),
      getPassAlongFunnel({ excludeAdmins }),
      getFunnelRollup(funnelId, { sinceDays, excludeAdmins }),
      getReferrerBreakdown({ sinceDays, excludeAdmins }),
    ]).then(([p, c, pa, f, ref]) => {
      setPages(p); setCats(c); setPassAlong(pa); setFunnelRows(f); setReferrers(ref)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [sinceDays, excludeAdmins, funnelId])

  if (loading) return <div className={styles.loading}>Loading…</div>

  const maxCat = Math.max(...cats.map(c => c.items), 1)
  const maxPage = Math.max(...(pages||[]).map(p => Number(p.total_sessions)), 1)
  const topFunnel = Number(funnelRows[0]?.sessions) || 1

  return (
    <div className={styles.overviewGrid}>

      {/* Page breakdown — auth split */}
      <div className={styles.overviewCard}>
        <div className={styles.overviewCardTitle}>
          Pages
          <span className={styles.pageLegend}>
            <span className={styles.pageLegendTeal} /> in
            <span className={styles.pageLegendGray} /> anon
          </span>
        </div>
        <div className={styles.barList}>
          {(pages||[]).slice(0,12).map(r => {
            const li = Number(r.logged_in_sessions)
            const anon = Number(r.anon_sessions)
            const total = Number(r.total_sessions)
            const liPct = total > 0 ? (li / maxPage) * 100 : 0
            const anonPct = total > 0 ? (anon / maxPage) * 100 : 0
            return (
              <div key={r.page} className={styles.bar}>
                <div className={styles.barLabel} style={{ width: 90, fontSize: 11 }}>{r.page}</div>
                <div className={styles.barSplit}>
                  <div className={styles.barSplitLogin} style={{ width: `${liPct}%` }} />
                  <div className={styles.barSplitAnon}  style={{ width: `${anonPct}%` }} />
                </div>
                <div className={styles.barValueSplit}>{li}<span className={styles.pct}>/{anon}</span></div>
              </div>
            )
          })}
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

      {/* Pass-along funnel */}
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
      </div>

      {/* Traffic sources */}
      <div className={styles.overviewCard}>
        <div className={styles.overviewCardTitle}>Traffic sources (30d)</div>
        <table className={styles.growthTable}>
          <thead><tr><th>Source</th><th>Sessions</th><th>Users</th></tr></thead>
          <tbody>
            {referrers.map(row => (
              <tr key={row.source}>
                <td>{row.source}</td><td>{row.sessions}</td><td>{row.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
