import React from 'react'

// ErrorBoundary — last-resort safety net for uncaught render exceptions.
//
// React 18 only allows class components to be error boundaries (the hook
// equivalent doesn't exist in stable). This sits at the top of the App tree,
// inside <AuthProvider> so we have the user's session if we want to log it,
// and inside <BrowserRouter> so a Link inside the fallback would work — but
// we deliberately use plain <a> tags + window.location for navigation here.
// Reason: by the time this renders, something deep in the tree is broken;
// react-router's runtime might be the thing that broke. Plain anchors are
// the universal escape hatch.
//
// Inline styles (rather than CSS modules) for the same reason: if the bundle
// CSS didn't load (network blip, build error), module classes won't apply
// and the user sees an unstyled wall of text. Inline styles are guaranteed
// to render correctly even if everything else is hostile.
//
// Best-effort analytics: we try to fire a track.errorCaught event so the
// admin dashboard sees real errors. Wrapped in try/catch — if analytics
// itself is what threw, we don't want to retrigger the boundary.

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: null }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || String(error),
    }
  }

  componentDidCatch(error, info) {
    // Last-resort logging. Console first (always works), then analytics
    // best-effort. Both are wrapped to never let this method throw — a
    // throw inside componentDidCatch would mean React could not recover
    // and the user would be stuck on a default error page anyway.
    try {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] caught:', error, info)
    } catch (_) { /* no-op */ }

    try {
      // Lazy-load to avoid circular deps with this top-level component;
      // also means an analytics-module import error doesn't crash the
      // boundary itself.
      import('../lib/analytics').then(({ track }) => {
        track?.errorCaught?.({
          message: error?.message || String(error),
          stack: (error?.stack || '').slice(0, 1000),
          componentStack: (info?.componentStack || '').slice(0, 1000),
          path: typeof window !== 'undefined' ? window.location.pathname : '',
        })
      }).catch(() => { /* no-op */ })
    } catch (_) { /* no-op */ }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    // Inline-styled fallback. Color tokens duplicate globals.css values so
    // the fallback looks branded even if the CSS bundle is what failed.
    const palette = {
      bg: '#FAF7F2',
      text: '#1F2421',
      muted: '#5C6358',
      accent: '#1D9E75',
      accentDark: '#0F6448',
      border: 'rgba(31, 36, 33, 0.08)',
    }

    const wrap = {
      minHeight: '100vh',
      background: palette.bg,
      color: palette.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
    }

    const inner = { maxWidth: 480, width: '100%' }
    const wordmark = { fontSize: 22, fontWeight: 500, marginBottom: 32, color: palette.accentDark }
    const h1 = { fontSize: 28, fontWeight: 500, lineHeight: 1.2, margin: '0 0 16px' }
    const body = { fontSize: 16, lineHeight: 1.55, color: palette.muted, margin: '0 0 24px' }
    const btnRow = { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }
    const primaryBtn = {
      display: 'inline-block',
      minHeight: 44,
      padding: '13px 18px',
      background: palette.accent,
      color: '#FFF',
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 500,
      border: 'none',
      cursor: 'pointer',
      textDecoration: 'none',
      lineHeight: '18px',
    }
    const secondaryBtn = {
      ...primaryBtn,
      background: 'transparent',
      color: palette.accentDark,
      border: `0.5px solid ${palette.border}`,
    }

    return (
      <div style={wrap} role="alert" aria-live="assertive">
        <div style={inner}>
          <div style={wordmark}>sprigloop</div>
          <h1 style={h1}>Something went wrong on our end.</h1>
          <p style={body}>
            The app hit an error it couldn't recover from. Refreshing the page usually clears it. If it keeps happening, drop me a note at{' '}
            <a
              href="mailto:chris@sprigloop.com"
              style={{ color: palette.accentDark, textDecoration: 'underline' }}
            >
              chris@sprigloop.com
            </a>
            {' '}and I'll take a look.
          </p>
          <div style={btnRow}>
            <button
              type="button"
              onClick={this.handleReload}
              style={primaryBtn}
            >
              Refresh the page
            </button>
            <a href="/" style={secondaryBtn}>
              Go to the home page
            </a>
          </div>
          {/* Tiny technical hint for users who care to copy-paste it. Not
              prominent because most users won't read it; it just helps when
              they email Chris and he asks "what did the screen say." */}
          {this.state.errorMessage && (
            <div
              style={{
                marginTop: 32,
                fontSize: 12,
                color: 'rgba(31, 36, 33, 0.4)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                wordBreak: 'break-word',
              }}
            >
              {this.state.errorMessage}
            </div>
          )}
        </div>
      </div>
    )
  }
}
