import { useCallback, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './TagScanner.module.css'

// TagScanner — Phase 1 of the photo-scan add-item flow.
//
// What it is:
//   A single button ("Scan a tag") that opens the phone's native camera via
//   <input type="file" accept="image/*" capture="environment">, compresses
//   the returned image client-side, POSTs it to the `scan-clothing-tag`
//   Edge Function, and fires onResult({ brand, size_label, category,
//   item_type }) on success.
//
// What it is NOT (deferred to Phase 2):
//   Live camera preview, auto-capture, tag-shaped crop guide, batch mode,
//   confidence highlighting. Phase 1 is deliberately the simplest version
//   that proves the pipeline and gives us a differentiator to dogfood.
//
// Props:
//   onResult(fields)  — called with the parsed field object on success.
//                       Fields may individually be null (low confidence or
//                       unreadable). Caller decides how to prefill.
//   variant           — 'primary' | 'inline'. Primary is the big Home CTA;
//                       inline is the compact button above the AddItem form.
//   label             — override button text. Defaults per variant.
//   disabled          — forward disabled state during parent's own saving.
//
// Why the native file input and not getUserMedia?
//   On mobile Safari + Chrome the `capture` attribute opens the system
//   camera UI directly. That gives us: the phone's real camera controls
//   (zoom, flash, focus tap), HEIC→JPEG handoff on iOS, and zero custom
//   camera code to maintain. Phase 2 will replace this with getUserMedia
//   when we want the crop guide and auto-capture.

const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp']

// Compress/resize in the browser before upload. Tags don't need high res;
// 1024px long edge at 0.8 JPEG quality is well under the 2MB Edge Function
// cap and keeps the round-trip fast on flaky mobile networks.
//
// Returns { base64, mime }. Strips the `data:...;base64,` prefix since the
// function contract expects raw base64.
async function compressToBase64(file, { maxDim = 1024, quality = 0.8 } = {}) {
  // Some Android browsers hand us HEIC which canvas can't decode. Fall back
  // to sending the raw bytes and letting the model handle it — still cheaper
  // than a compression dance that silently corrupts the image.
  const mime = ACCEPTED_MIMES.includes(file.type) ? file.type : 'image/jpeg'

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    // Raw fallback path — read the file as base64 as-is.
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => {
        const dataUrl = r.result
        const comma   = typeof dataUrl === 'string' ? dataUrl.indexOf(',') : -1
        if (comma === -1) return reject(new Error('read_failed'))
        resolve({ base64: dataUrl.slice(comma + 1), mime: file.type || 'image/jpeg' })
      }
      r.onerror = () => reject(r.error ?? new Error('read_failed'))
      r.readAsDataURL(file)
    })
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const blob = await new Promise((res) =>
    canvas.toBlob(res, 'image/jpeg', quality),
  )
  if (!blob) throw new Error('compress_failed')

  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error ?? new Error('read_failed'))
    r.readAsDataURL(blob)
  })
  const comma = dataUrl.indexOf(',')
  return { base64: dataUrl.slice(comma + 1), mime: 'image/jpeg' }
}

// Map known Edge Function error codes to user-friendly copy. Anything we
// don't recognize falls back to the generic retry prompt — the raw code is
// still surfaced in a small debug line below so a tester (read: Chris on a
// phone) can tell us what went wrong without opening devtools.
function errorMessageFor(code) {
  switch (code) {
    case 'rate_limited':
      return 'You\u2019ve hit today\u2019s scan limit. Try again tomorrow, or add by hand for now.'
    case 'image_too_large':
      return 'That photo is too large. Try a new shot \u2014 we\u2019ll compress it automatically next time.'
    case 'unsupported_mime':
      return 'That file type isn\u2019t supported. Use a JPEG or PNG.'
    case 'missing_bearer':
    case 'invalid_jwt':
      return 'Your session expired. Sign in again and retry.'
    case 'missing_anthropic_key':
      return 'Scan isn\u2019t configured yet. Add by hand for now.'
    case 'not_deployed':
      return 'The scan service isn\u2019t reachable. Add by hand for now.'
    case 'network_error':
      return 'Couldn\u2019t reach the scan service. Check your connection and retry.'
    case 'anthropic_bad_json':
    case 'anthropic_http_error':
    case 'anthropic_fetch_failed':
      return 'We couldn\u2019t read that tag. Try a closer, better-lit shot.'
    default:
      return 'Something went wrong. Try again, or add by hand for now.'
  }
}

// Pry the real error code out of whatever supabase-js v2 threw. In v2:
//   - FunctionsHttpError  → err.context is a Response (2xx check failed).
//   - FunctionsRelayError → err.context is a Response (relay/CORS failure).
//   - FunctionsFetchError → no context; fetch itself threw (network / 404
//                           at the functions host / DNS / offline).
// We try Response.json() first (what our function returns on errors), then
// Response.text() as a fallback, and finally give up and return a synthetic
// code so the UI can at least tell the user something actionable.
async function extractFnErrorCode(fnErr) {
  const ctx = fnErr?.context
  if (ctx && typeof ctx.clone === 'function') {
    // It's a Response. Clone so we can try json() then fall back to text().
    try {
      const cloned = ctx.clone()
      const parsed = await cloned.json()
      if (parsed?.error) return { code: parsed.error, status: ctx.status }
    } catch { /* not JSON — try text */ }
    try {
      const txt = await ctx.text()
      if (txt) return { code: 'non_json_response', status: ctx.status, detail: txt.slice(0, 200) }
    } catch { /* give up */ }
    // Known-status fallbacks for empty bodies.
    if (ctx.status === 404) return { code: 'not_deployed', status: 404 }
    if (ctx.status === 401) return { code: 'invalid_jwt', status: 401 }
    return { code: 'http_' + ctx.status, status: ctx.status }
  }
  // No context → fetch itself threw. Most common causes on mobile:
  //   offline, DNS flake, or the function simply isn't deployed at this URL.
  const msg = String(fnErr?.message ?? fnErr ?? '')
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return { code: 'network_error', status: 0, detail: msg }
  }
  return { code: 'unknown', status: 0, detail: msg }
}

export default function TagScanner({
  onResult,
  variant = 'inline',
  label,
  disabled = false,
}) {
  const inputRef = useRef(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  // Debug detail surfaced under the error — the underlying code + status so
  // a tester without devtools can read off what actually failed. Kept small
  // and muted in the CSS; not a long-term user-facing surface.
  const [errorDebug, setErrorDebug] = useState(null)

  const onPick = useCallback(async (e) => {
    const file = e.target.files?.[0]
    // Reset the input so the same file can be picked twice in a row
    // (useful for retry-after-error).
    e.target.value = ''
    if (!file) return

    setScanning(true)
    setError(null)
    setErrorDebug(null)

    try {
      const { base64, mime } = await compressToBase64(file)

      const { data, error: fnErr } = await supabase.functions.invoke(
        'scan-clothing-tag',
        { body: { image_base64: base64, mime_type: mime } },
      )

      if (fnErr) {
        const info = await extractFnErrorCode(fnErr)
        // eslint-disable-next-line no-console
        console.warn('TagScanner fn error:', info, fnErr)
        setError(errorMessageFor(info.code))
        setErrorDebug(`code: ${info.code}${info.status ? ` · HTTP ${info.status}` : ''}`)
        return
      }

      const fields = data?.fields
      if (!fields) {
        setError(errorMessageFor('unknown'))
        setErrorDebug('code: empty_response')
        return
      }

      onResult?.(fields)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('TagScanner failed:', err)
      setError(errorMessageFor('unknown'))
      setErrorDebug(`code: client_exception · ${String(err?.message ?? err).slice(0, 120)}`)
    } finally {
      setScanning(false)
    }
  }, [onResult])

  const defaultLabel = scanning
    ? 'Scanning\u2026'
    : variant === 'primary'
      ? 'Scan a tag'
      : 'Scan a tag to autofill'

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.btn} ${variant === 'primary' ? styles.primary : styles.inline}`}
        onClick={() => inputRef.current?.click()}
        disabled={disabled || scanning}
      >
        <span className={styles.iconWrap} aria-hidden="true">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
            <path
              d="M6.5 4.5 L7.5 3 h5 l1 1.5 H16 a1.5 1.5 0 0 1 1.5 1.5 v8 a1.5 1.5 0 0 1 -1.5 1.5 H4 a1.5 1.5 0 0 1 -1.5 -1.5 v-8 A1.5 1.5 0 0 1 4 4.5 Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </span>
        <span>{label ?? defaultLabel}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className={styles.hiddenInput}
        tabIndex={-1}
        aria-hidden="true"
      />
      {error && (
        <div className={styles.error}>
          {error}
          {errorDebug && <div className={styles.errorDebug}>{errorDebug}</div>}
        </div>
      )}
    </div>
  )
}
