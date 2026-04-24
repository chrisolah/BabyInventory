import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './TagScanner.module.css'

// TagScanner — Phase 2 step 1 (2026-04-24): live camera preview + tag-shaped
// crop guide.
//
// Primary path now:
//   Tap button → full-screen <CameraModal> opens → live video stream from
//   the rear camera → dashed tag-shaped guide centered in frame to coach
//   framing → user taps shutter → frame grabbed to canvas → same
//   compressToBase64 + scan-clothing-tag pipeline as before.
//
// Fallback path (unchanged):
//   If getUserMedia isn't available (older browsers, in-app webviews, user
//   denies permission, HTTPS issue), we fall back to the native file input
//   — the Phase 1 flow. The file input element is always rendered so we
//   can trigger it from either the top-level button or the "Can't use the
//   camera?" link inside the modal.
//
// What's deliberately NOT in this step:
//   Auto-capture (Phase 2 step 2), haptic/shutter sound (step 3),
//   confidence highlighting (step 4), batch mode (step 5). Scoped tightly
//   so the live-preview foundation ships first and the higher-value levers
//   (batch, confidence) get built on a solid capture layer.

const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp']

// Compress/resize in the browser before upload. Tags don't need high res;
// 1024px long edge at 0.8 JPEG quality is well under the 2MB Edge Function
// cap and keeps the round-trip fast on flaky mobile networks.
//
// Accepts a File or Blob — camera captures hand us a Blob from
// canvas.toBlob, file picks hand us a File. createImageBitmap and
// FileReader both accept either, so the path is shared.
async function compressToBase64(blob, { maxDim = 1024, quality = 0.8 } = {}) {
  // Some Android browsers hand us HEIC which canvas can't decode. Fall back
  // to sending the raw bytes and letting the model handle it — still cheaper
  // than a compression dance that silently corrupts the image.
  const mime = ACCEPTED_MIMES.includes(blob.type) ? blob.type : 'image/jpeg'

  const bitmap = await createImageBitmap(blob).catch(() => null)
  if (!bitmap) {
    // Raw fallback path — read the file as base64 as-is.
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => {
        const dataUrl = r.result
        const comma   = typeof dataUrl === 'string' ? dataUrl.indexOf(',') : -1
        if (comma === -1) return reject(new Error('read_failed'))
        resolve({ base64: dataUrl.slice(comma + 1), mime: blob.type || 'image/jpeg' })
      }
      r.onerror = () => reject(r.error ?? new Error('read_failed'))
      r.readAsDataURL(blob)
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

  const outBlob = await new Promise((res) =>
    canvas.toBlob(res, 'image/jpeg', quality),
  )
  if (!outBlob) throw new Error('compress_failed')

  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error ?? new Error('read_failed'))
    r.readAsDataURL(outBlob)
  })
  const comma = dataUrl.indexOf(',')
  // `mime` was only used in the raw-fallback branch above — the compressed
  // path always lands on image/jpeg, which is what reportlab-style lossy
  // downsampling produces.
  void mime
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
    try {
      const cloned = ctx.clone()
      const parsed = await cloned.json()
      if (parsed?.error) {
        const upstreamStatus = typeof parsed.status === 'number' ? parsed.status : null
        const detail = typeof parsed.detail === 'string' ? parsed.detail.slice(0, 300) : null
        return {
          code: parsed.error,
          status: ctx.status,
          upstreamStatus,
          detail,
        }
      }
    } catch { /* not JSON — try text */ }
    try {
      const txt = await ctx.text()
      if (txt) return { code: 'non_json_response', status: ctx.status, detail: txt.slice(0, 200) }
    } catch { /* give up */ }
    if (ctx.status === 404) return { code: 'not_deployed', status: 404 }
    if (ctx.status === 401) return { code: 'invalid_jwt', status: 401 }
    return { code: 'http_' + ctx.status, status: ctx.status }
  }
  const msg = String(fnErr?.message ?? fnErr ?? '')
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return { code: 'network_error', status: 0, detail: msg }
  }
  return { code: 'unknown', status: 0, detail: msg }
}

// Quick probe for live-camera viability. We don't want to open the modal
// and THEN discover getUserMedia isn't there — the user would see an empty
// black screen before the fallback kicks in.
function canUseLiveCamera() {
  if (typeof navigator === 'undefined') return false
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return false
  }
  // getUserMedia requires a secure context (HTTPS or localhost). Dev on
  // 127.0.0.1:5173 counts as secure; production is HTTPS via Supabase.
  if (typeof window !== 'undefined' && window.isSecureContext === false) return false
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// CameraModal
// ─────────────────────────────────────────────────────────────────────────────
// Full-screen camera UI. Lives co-located with TagScanner because it's the
// only consumer; if another screen ever needs live camera capture we can
// promote it to its own file.
//
// Contract:
//   onCapture(blob)  — called with an image/jpeg Blob when the user taps
//                      the shutter. Parent is responsible for teardown by
//                      setting `open=false`.
//   onClose()        — called when the user taps close or when a fatal
//                      stream error occurs. Parent should set open=false.
//   onFallback()     — called when the user taps "Upload a photo instead"
//                      link. Parent should close the modal and kick the
//                      native file picker.
function CameraModal({ onCapture, onClose, onFallback }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [capturing, setCapturing] = useState(false)

  // Request the stream once on mount. Constraints prefer the rear camera
  // and a high-ish resolution because tag OCR quality degrades fast below
  // ~720p. We don't pin exact dims because phones vary wildly; `ideal`
  // lets the browser pick the closest supported mode.
  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // iOS Safari requires an explicit play() after srcObject even
          // with autoPlay; without it the video element stays black.
          try { await videoRef.current.play() } catch { /* play()'s rejection is
             benign here — the loadedmetadata handler will flip `ready`
             regardless. */ }
        }
      } catch (err) {
        if (cancelled) return
        // NotAllowedError (denied), NotFoundError (no camera),
        // NotReadableError (camera in use by another app), OverconstrainedError
        // (env-facing camera doesn't exist on this device). All map to the
        // same user-facing escape hatch: offer the file picker.
        // eslint-disable-next-line no-console
        console.warn('CameraModal: getUserMedia failed', err)
        setStreamError(err?.name || 'unknown')
      }
    }

    start()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [])

  // Close on Escape so desktop testing (Chrome devtools mobile emulation)
  // doesn't trap the user in the modal.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleLoaded() {
    setReady(true)
  }

  async function handleShutter() {
    const video = videoRef.current
    if (!video || !ready || capturing) return
    setCapturing(true)
    try {
      // Grab the native-resolution frame. compressToBase64 downsamples to
      // 1024px long-edge before upload, so we don't need to prematurely
      // shrink here — keep the full frame in case we later want to crop to
      // the guide rect (Phase 2.2+).
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) throw new Error('video_not_ready')
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, w, h)
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toblob_failed'))), 'image/jpeg', 0.92)
      })
      onCapture?.(blob)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('CameraModal shutter failed', err)
      setStreamError('capture_failed')
      setCapturing(false)
    }
    // Intentionally don't reset capturing on success — the parent will
    // unmount the modal and that releases state with it.
  }

  // Stream error state: bail out gracefully and offer the file picker.
  // We don't try to recover in place because most errors (permission denied,
  // no camera) aren't going to flip mid-session, and pretending to be
  // "trying again" would just feel broken.
  if (streamError) {
    return (
      <div className={styles.cameraModal} role="dialog" aria-modal="true" aria-label="Camera unavailable">
        <div className={styles.cameraErrorBox}>
          <div className={styles.cameraErrorTitle}>Can\u2019t open the camera</div>
          <div className={styles.cameraErrorBody}>
            {streamError === 'NotAllowedError'
              ? 'Camera access was denied. You can still upload a photo from your library.'
              : 'Your device camera isn\u2019t available right now. You can still upload a photo.'}
          </div>
          <div className={styles.cameraErrorActions}>
            <button type="button" className={styles.cameraFallbackBtn} onClick={onFallback}>
              Upload a photo
            </button>
            <button type="button" className={styles.cameraCancelBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.cameraModal} role="dialog" aria-modal="true" aria-label="Scan a clothing tag">
      <video
        ref={videoRef}
        className={styles.cameraVideo}
        onLoadedMetadata={handleLoaded}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
      />

      {/* Guide overlay. Four scrim panels form a "picture frame" around a
          center cutout where the tag should sit. Dashed rect sits inside
          the cutout as the visible guide. Using 4 divs (not SVG mask) so
          we can animate borders and keep the markup testable. */}
      <div className={styles.cameraScrim} aria-hidden="true">
        <div className={`${styles.cameraScrimPanel} ${styles.cameraScrimTop}`} />
        <div className={`${styles.cameraScrimPanel} ${styles.cameraScrimBottom}`} />
        <div className={`${styles.cameraScrimPanel} ${styles.cameraScrimLeft}`} />
        <div className={`${styles.cameraScrimPanel} ${styles.cameraScrimRight}`} />
        <div className={styles.cameraGuide}>
          <div className={styles.cameraGuideCorner + ' ' + styles.cameraGuideCornerTL} />
          <div className={styles.cameraGuideCorner + ' ' + styles.cameraGuideCornerTR} />
          <div className={styles.cameraGuideCorner + ' ' + styles.cameraGuideCornerBL} />
          <div className={styles.cameraGuideCorner + ' ' + styles.cameraGuideCornerBR} />
        </div>
      </div>

      {/* Top bar — close (X) on the right. Title on the left explains what
          we're asking the user to do; framing instruction sits below the
          guide. */}
      <div className={styles.cameraTopBar}>
        <div className={styles.cameraTopTitle}>Scan a tag</div>
        <button
          type="button"
          className={styles.cameraCloseBtn}
          onClick={onClose}
          aria-label="Close camera"
        >
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
            <path d="M5 5 l10 10 M15 5 L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Framing coach line. Sits just below the guide rect so the eye
          naturally moves from "what am I aiming at?" (the dashed box) to
          "how do I aim it?" (this text). */}
      <div className={styles.cameraHint} aria-live="polite">
        {ready ? 'Fit the tag inside the box' : 'Starting camera\u2026'}
      </div>

      {/* Bottom bar — shutter in the middle, fallback link on the left. */}
      <div className={styles.cameraBottomBar}>
        <button
          type="button"
          className={styles.cameraFallbackLink}
          onClick={onFallback}
        >
          Upload instead
        </button>
        <button
          type="button"
          className={styles.cameraShutter}
          onClick={handleShutter}
          disabled={!ready || capturing}
          aria-label="Take photo"
        >
          <span className={styles.cameraShutterInner} />
        </button>
        <span className={styles.cameraBottomSpacer} aria-hidden="true" />
      </div>
    </div>
  )
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
  const [errorDebug, setErrorDebug] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  // Shared upload + extract path. Both the camera shutter and the file
  // picker funnel through here so error handling stays in one place.
  const sendForScan = useCallback(async (blobOrFile) => {
    setScanning(true)
    setError(null)
    setErrorDebug(null)
    try {
      const { base64, mime } = await compressToBase64(blobOrFile)
      const { data, error: fnErr } = await supabase.functions.invoke(
        'scan-clothing-tag',
        { body: { image_base64: base64, mime_type: mime } },
      )
      if (fnErr) {
        const info = await extractFnErrorCode(fnErr)
        // eslint-disable-next-line no-console
        console.warn('TagScanner fn error:', info, fnErr)
        setError(errorMessageFor(info.code))
        const parts = [`code: ${info.code}`]
        if (info.status)         parts.push(`HTTP ${info.status}`)
        if (info.upstreamStatus) parts.push(`upstream ${info.upstreamStatus}`)
        if (info.detail)         parts.push(String(info.detail).slice(0, 240))
        setErrorDebug(parts.join(' \u00B7 '))
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
      setErrorDebug(`code: client_exception \u00B7 ${String(err?.message ?? err).slice(0, 120)}`)
    } finally {
      setScanning(false)
    }
  }, [onResult])

  const onPick = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await sendForScan(file)
  }, [sendForScan])

  const onCameraCapture = useCallback(async (blob) => {
    setCameraOpen(false)
    await sendForScan(blob)
  }, [sendForScan])

  function onTopButton() {
    // Prefer the live camera; file picker is the fallback route.
    if (canUseLiveCamera()) {
      setCameraOpen(true)
    } else {
      inputRef.current?.click()
    }
  }

  function onFallbackFromModal() {
    setCameraOpen(false)
    // A micro-delay so the modal unmount doesn't swallow the synthetic
    // click on some Android WebViews. 0ms via setTimeout is enough —
    // we just need to yield the task queue.
    setTimeout(() => inputRef.current?.click(), 0)
  }

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
        onClick={onTopButton}
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

      {cameraOpen && (
        <CameraModal
          onCapture={onCameraCapture}
          onClose={() => setCameraOpen(false)}
          onFallback={onFallbackFromModal}
        />
      )}
    </div>
  )
}
