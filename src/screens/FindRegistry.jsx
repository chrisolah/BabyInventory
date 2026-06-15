import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { track } from '../lib/analytics'
import styles from './FindRegistry.module.css'

// Public search page — no auth required.
<<<<<<< HEAD
// Gift-givers find a household's registry by name (household or parent).
=======
// Gift-givers find a household's registry by parent name.
>>>>>>> dev
// Reads ?q= from the URL so deep-links like /find-registry?q=Johnson work.
export default function FindRegistry() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [results, setResults] = useState(null)   // null = not searched yet
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Run the search whenever the URL ?q= param changes (handles deep-link + back nav)
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    if (q !== query) setQuery(q)
    if (q.trim().length >= 2) {
      runSearch(q.trim())
    } else {
      setResults(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Auto-focus the search input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function runSearch(q) {
    setLoading(true)
    setError(null)
    track.ctaClicked('registry_search')
    try {
      const { data, error: rpcError } = await supabase
        .schema(currentSchema)
        .rpc('search_registries', { _query: q })
      if (rpcError) throw rpcError
      setResults(data ?? [])
    } catch (err) {
      console.error('Registry search error:', err)
      setError('Something went wrong. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 2) return
<<<<<<< HEAD
    // Update URL so the search is shareable and back-nav works
=======
>>>>>>> dev
    setSearchParams(q ? { q } : {}, { replace: false })
  }

  function handleChange(e) {
    setQuery(e.target.value)
<<<<<<< HEAD
    // Clear results if the input is emptied
=======
>>>>>>> dev
    if (!e.target.value.trim()) setResults(null)
  }

  const searched = results !== null
  const isEmpty = searched && results.length === 0

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.title}>Find a registry</h1>
          <p className={styles.subtitle}>
<<<<<<< HEAD
            Search by family name or parent name to find a Sprigloop registry.
=======
            Search by a parent's name to find their Sprigloop registry.
>>>>>>> dev
          </p>
        </div>

        <form className={styles.searchForm} onSubmit={handleSubmit} role="search">
          <div className={styles.searchRow}>
            <input
              ref={inputRef}
              className={styles.searchInput}
              type="search"
              value={query}
              onChange={handleChange}
<<<<<<< HEAD
              placeholder="e.g. Johnson family or Sarah Johnson"
              aria-label="Search registries"
=======
              placeholder="e.g. Sarah Johnson"
              aria-label="Search registries by parent name"
>>>>>>> dev
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              className={styles.searchButton}
              type="submit"
              disabled={query.trim().length < 2 || loading}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {query.trim().length > 0 && query.trim().length < 2 && (
            <p className={styles.hint}>Enter at least 2 characters to search.</p>
          )}
        </form>

        {error && (
          <div className={styles.errorMsg}>{error}</div>
        )}

        {searched && !loading && (
          <div className={styles.results}>
            {isEmpty ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>No registries found for "{searchParams.get('q')}"</p>
                <p className={styles.emptyHint}>
<<<<<<< HEAD
                  Try searching by the parent's first or last name, or the family name.
=======
                  Try searching by a first name, last name, or both.
>>>>>>> dev
                </p>
              </div>
            ) : (
              <>
                <p className={styles.resultCount}>
                  {results.length === 20
                    ? '20+ registries found'
                    : `${results.length} ${results.length === 1 ? 'registry' : 'registries'} found`}
                </p>
                <ul className={styles.resultList}>
                  {results.map((r) => (
                    <li key={r.household_id} className={styles.resultCard}>
                      <div className={styles.cardInfo}>
                        <div className={styles.cardHousehold}>{r.household_name}</div>
                        {r.member_names?.length > 0 && (
                          <div className={styles.cardMembers}>
                            {r.member_names.join(' & ')}
                          </div>
                        )}
                        {r.baby_names?.length > 0 && (
                          <div className={styles.cardBabies}>
                            {r.baby_names.length === 1
                              ? `Baby: ${r.baby_names[0]}`
                              : `Babies: ${r.baby_names.join(', ')}`}
                          </div>
                        )}
                      </div>
                      <button
                        className={styles.viewButton}
                        onClick={() => {
                          track.ctaClicked('registry_result_view')
                          navigate(`/registry/${r.registry_token}`)
                        }}
                      >
                        View registry
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {!searched && !loading && (
          <div className={styles.callout}>
            <p>
              Have a registry link already?{' '}
              <span className={styles.calloutNote}>
                Click the link the parent shared with you to view it directly.
              </span>
            </p>
          </div>
        )}

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Don't have a Sprigloop account?{' '}
            <button className={styles.footerLink} onClick={() => navigate('/signup')}>
              Create one free
            </button>
            {' '}to build your own registry.
          </p>
        </div>
      </div>
    </div>
  )
}
