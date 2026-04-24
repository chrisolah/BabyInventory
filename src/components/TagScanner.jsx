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
// ── Capture feedback (Phase 2 step 3) ─────────────────────────────────────
// Haptic + audio cues fired at the exact moment of capture. Both are
// best-effort: unsupported platforms (iOS for vibrate, or an audio context
// that never unlocked) silently no-op. The goal is to make the capture
// feel *committed* — like a real camera shutter — so the user knows the
// tag was read without having to wait for the upload round-trip.

// Module-scoped so it survives across modal opens. Creating AudioContexts
// is expensive and some browsers enforce a low limit; reusing one avoids
// both costs. Populated lazily the first time primeAudio runs inside a
// user-gesture handler (see onTopButton), which is what iOS Safari
// requires before it'll unlock audio output.
let sharedAudioCtx = null

function primeAudio() {
  try {
    if (!sharedAudioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext
      if (!Ctor) return
      sharedAudioCtx = new Ctor()
    }
    // Safari starts contexts in 'suspended' state even after creation;
    // resume() inside a user gesture is what actually unlocks output.
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => { /* iOS silent mode — no-op */ })
    }
  } catch {
    // Audio simply unavailable. Every feedback call below guards against
    // a null context so we'll just go silent.
  }
}

// Synthesize a short "click" (noise burst through a bandpass filter with a
// fast attack/decay envelope). Keeps the bundle free of any audio assets
// and gives us per-call tweakability. Total duration ~60ms.
function playShutterSound() {
  try {
    const ctx = sharedAudioCtx
    if (!ctx || ctx.state !== 'running') return

    const now = ctx.currentTime
    const dur = 0.06

    // White-noise buffer — random samples in [-1, 1). Cheap to build at
    // this length (≈2600 samples at 44.1kHz).
    const len = Math.max(1, Math.round(ctx.sampleRate * dur))
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1)

    const src = ctx.createBufferSource()
    src.buffer = buffer

    // Bandpass centered in the upper-mid so it reads as a mechanical
    // "tick" rather than a thud or hiss.
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(2100, now)
    filter.Q.setValueAtTime(1.6, now)

    // Gain envelope: 4ms attack, exponential decay across the rest.
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.28, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    src.start(now)
    src.stop(now + dur + 0.01)
  } catch {
    // Audio graph failed mid-assembly — nothing we can do. Skip.
  }
}

// Short vibration pulse. Android honors this; iOS Safari doesn't implement
// vibrate at all, so the check returns undefined and we exit cleanly.
function vibrateShutter() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(25)
    }
  } catch { /* some wrappers throw if device is in DND mode */ }
}

// ── Auto-capture heuristics (Phase 2 step 2, revised 2026-04-24) ──────────
// Revision history:
//   v1 (2026-04-24): full-frame edge-energy sharpness score. Never fired
//       reliably in real-world testing — baby clothing tags aren't retail
//       hang tags. They're care labels / seam strips / printed-on-garment
//       labels, typically 5% of the frame and drowned by surrounding
//       fabric pattern when scoring across the whole image.
//   v2 (this):     sample only the guide region; score text-likeness
//       instead of raw sharpness. Text has a distinctive signature — rows
//       of high-frequency dark/light transitions (letter strokes +
//       whitespace) — that solid fabric and geometric patterns don't
//       share.
//
// The sample rect matches the guide's CSS geometry: center horizontal band,
// roughly 60% of width × 28% of height. Sampling only this region means a
// small tag inside the guide contributes the bulk of the signal, rather
// than being averaged out against noisy fabric.
const AUTO_SAMPLE_WIDTH    = 240   // 2:1 to match the new band-shaped guide
const AUTO_SAMPLE_HEIGHT   = 120
const AUTO_SAMPLE_MS       = 240   // ~4Hz — plenty for this signal
const AUTO_HISTORY_LEN     = 4     // ~1s rolling window
const AUTO_TEXT_MIN        = 18    // min text-likeness score across the window
const AUTO_STABILITY_RATIO = 0.35  // forgiving; text scores are noisier than
                                   // sharpness scores and perfect stability
                                   // on a handheld shot is unrealistic
const AUTO_WARMUP_MS       = 700
const AUTO_LOCK_HOLD_MS    = 260

// Fraction of the video frame that maps to the guide region. Kept slightly
// wider than the CSS band so small framing errors (tag slightly outside the
// visible guide) still contribute to the score — punishing users for
// imperfect aim is exactly what made v1 feel broken.
const AUTO_SRC_X_FRAC      = 0.15  // left edge at 15%
const AUTO_SRC_Y_FRAC      = 0.32  // top edge at 32%
const AUTO_SRC_W_FRAC      = 0.70  // 70% wide
const AUTO_SRC_H_FRAC      = 0.36  // 36% tall

// Text-likeness score. High when the sampled region contains rows of
// dense dark/light transitions (letter strokes on a lighter background,
// or vice versa). Low on solid fabric, plain skin, and most repeating
// patterns.
//
// Pipeline:
//   1. Convert RGB → luminance (cheap Y' ~= 0.3R + 0.6G + 0.1B).
//   2. Compute the mean luminance as an adaptive threshold baseline, then
//      subtract a margin so we're counting pixels that are *meaningfully*
//      darker than the surround (not just "below average").
//   3. Compute global dark-pixel ratio. Reject regions that are almost
//      entirely light (solid white fabric, sky) or almost entirely dark
//      (heavy fabric, shadow) — neither shape is text-bearing.
//   4. Per-row, count luminance-threshold crossings. Text rows cross
//      many times (one or two per letter stroke); uniform rows and most
//      fabric textures cross rarely or with very uniform density.
//   5. Return the fraction of rows with ≥ MIN_ROW_CROSSINGS crossings,
//      scaled to 0–100. Empirically: 0 on solid surfaces, 5–12 on
//      textured fabric, 20–60 on actual text regions.
function computeTextLikeness(imageData) {
  const { data, width, height } = imageData
  const px = width * height

  // Luminance pass + running mean.
  const lum = new Float32Array(px)
  let sumLum = 0
  for (let i = 0; i < px; i++) {
    const p = i * 4
    const l = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    lum[i] = l
    sumLum += l
  }
  const meanLum = sumLum / px
  // 20-count margin below mean. Tuned empirically: smaller values treat
  // every mid-gray pixel as "dark" (noisy on textured fabric); larger
  // values miss faded low-contrast care labels.
  const darkThreshold = meanLum - 20

  // Sanity gate — dark ratio. Text regions have roughly 5–55% dark pixels
  // depending on font weight and background. Outside this range it's
  // almost certainly not a label.
  let darkCount = 0
  for (let i = 0; i < px; i++) if (lum[i] < darkThreshold) darkCount++
  const darkRatio = darkCount / px
  if (darkRatio < 0.04 || darkRatio > 0.60) return 0

  // Per-row transition count. A row crossing the threshold N times implies
  // ~N/2 disjoint dark segments, which is what character strokes look like
  // when scanned horizontally.
  const MIN_ROW_CROSSINGS = 5  // minimum to count a row as "text-bearing"
  let textRows = 0
  for (let y = 0; y < height; y++) {
    const off = y * width
    let prev = lum[off] < darkThreshold
    let crossings = 0
    for (let x = 1; x < width; x++) {
      const curr = lum[off + x] < darkThreshold
      if (curr !== prev) crossings++
      prev = curr
    }
    if (crossings >= MIN_ROW_CROSSINGS) textRows++
  }
  return (textRows / height) * 100
}

function CameraModal({ onCapture, onClose, onFallback }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const sampleCanvasRef = useRef(null)
  const scoreHistoryRef = useRef([])
  const modalOpenedAtRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [capturing, setCapturing] = useState(false)
  // Auto-capture flag. Default on; the user can disable via the top-bar
  // pill if they're struggling with the lock heuristic (odd lighting, busy
  // garment pattern misread as "sharp").
  const [autoEnabled, setAutoEnabled] = useState(true)
  // Lock state drives the guide-corner color + hint copy. 'waiting' =
  // aiming, 'locking' = scores are climbing into range, 'locked' = held
  // long enough, about to fire.
  const [lockState, setLockState] = useState('waiting')
  // Shutter flash overlay. Flips true for ~280ms when the shutter fires so
  // the user gets a visual "gotcha" even if audio is muted on the device
  // (iOS silent switch) and vibrate isn't supported.
  const [flash, setFlash] = useState(false)

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
    // Start the auto-capture clock here instead of on mount — we don't want
    // the warmup countdown to overlap with the "starting camera…" phase
    // where the video element is still black.
    modalOpenedAtRef.current = Date.now()
  }

  // useCallback so the auto-capture effect below can depend on it stably —
  // otherwise we'd tear down and rebuild the sampling interval on every
  // render, which resets the history window and makes locks fire late.
  const handleShutter = useCallback(async () => {
    const video = videoRef.current
    if (!video || !ready || capturing) return
    setCapturing(true)
    // Fire all three feedback channels *before* the canvas/toBlob work so
    // the cue feels instantaneous. Each is best-effort — audio fails on
    // locked contexts, vibrate fails on iOS, flash always works. The user
    // hears/feels/sees "gotcha" in the same instant their finger lifts (or
    // the auto-lock timer fires), not 40ms later when the encode finishes.
    setFlash(true)
    playShutterSound()
    vibrateShutter()
    // Clear the flash after its fade — handled purely in CSS, but we need
    // to un-mount the element so the next shutter can re-trigger the
    // animation. 280ms covers the fade plus a small buffer.
    setTimeout(() => setFlash(false), 280)

    try {
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
  }, [ready, capturing, onCapture])

  // Auto-capture sampling loop. Runs while the stream is ready, auto mode
  // is enabled, and we haven't already triggered a capture. Every
  // AUTO_SAMPLE_MS we redraw the full video frame into a tiny offscreen
  // canvas, compute a sharpness score, and check whether the rolling window
  // has been consistently sharp AND stable. Consistently = all samples ≥
  // min threshold; stable = the spread of the window is small relative to
  // its mean (user isn't panning/shaking).
  useEffect(() => {
    if (!ready || !autoEnabled || capturing || streamError) {
      scoreHistoryRef.current = []
      setLockState('waiting')
      return
    }

    // Lazily init the offscreen canvas. Reusing across samples avoids
    // allocator churn in the JS heap on slower phones.
    if (!sampleCanvasRef.current) {
      const c = document.createElement('canvas')
      c.width = AUTO_SAMPLE_WIDTH
      c.height = AUTO_SAMPLE_HEIGHT
      sampleCanvasRef.current = c
    }
    const sc = sampleCanvasRef.current
    const sctx = sc.getContext('2d', { willReadFrequently: true })

    let lockTimer = null
    let disposed = false

    function takeSample() {
      if (disposed) return
      const video = videoRef.current
      if (!video || !video.videoWidth) return
      // Warmup grace period so the user isn't ambushed by an insta-fire.
      if (Date.now() - modalOpenedAtRef.current < AUTO_WARMUP_MS) return

      try {
        // Crop to the guide region rather than sampling the whole frame.
        // The sub-rect in native video coordinates corresponds roughly to
        // the centered band the user is aiming into; we use fractional
        // coefficients so this works across video resolutions without
        // hard-coding pixel math. Slight padding around the visible guide
        // (AUTO_SRC_*_FRAC values) makes the heuristic forgiving of
        // imperfect aim — users don't need to frame the tag pixel-perfect
        // to get credit.
        const sx = Math.floor(video.videoWidth  * AUTO_SRC_X_FRAC)
        const sy = Math.floor(video.videoHeight * AUTO_SRC_Y_FRAC)
        const sw = Math.floor(video.videoWidth  * AUTO_SRC_W_FRAC)
        const sh = Math.floor(video.videoHeight * AUTO_SRC_H_FRAC)
        sctx.drawImage(video, sx, sy, sw, sh, 0, 0, AUTO_SAMPLE_WIDTH, AUTO_SAMPLE_HEIGHT)
        const imageData = sctx.getImageData(0, 0, AUTO_SAMPLE_WIDTH, AUTO_SAMPLE_HEIGHT)
        const score = computeTextLikeness(imageData)

        const hist = scoreHistoryRef.current
        hist.push(score)
        if (hist.length > AUTO_HISTORY_LEN) hist.shift()

        if (hist.length < AUTO_HISTORY_LEN) {
          setLockState('waiting')
          return
        }

        let min = Infinity, max = -Infinity, sum = 0
        for (const v of hist) {
          if (v < min) min = v
          if (v > max) max = v
          sum += v
        }
        const mean = sum / hist.length
        const allSharp = min >= AUTO_TEXT_MIN
        const stable = mean > 0 && ((max - min) / mean) <= AUTO_STABILITY_RATIO

        if (allSharp && stable) {
          // Don't double-arm: if a lock timer is already running, leave it
          // alone. Resetting it every tick would cause us to never fire.
          if (!lockTimer) {
            setLockState('locked')
            lockTimer = setTimeout(() => {
              lockTimer = null
              if (!disposed) handleShutter()
            }, AUTO_LOCK_HOLD_MS)
          }
        } else {
          // If we previously armed a lock but the user has since moved,
          // cancel the pending fire and drop back to 'locking' / 'waiting'.
          if (lockTimer) {
            clearTimeout(lockTimer)
            lockTimer = null
          }
          setLockState(allSharp ? 'locking' : 'waiting')
        }
      } catch {
        // video.readyState quirks on some Androids throw 'InvalidStateError'
        // from getImageData right after orientation change. Swallow and
        // try the next tick — the stream usually settles within 300ms.
      }
    }

    const intervalHandle = setInterval(takeSample, AUTO_SAMPLE_MS)

    return () => {
      disposed = true
      clearInterval(intervalHandle)
      if (lockTimer) clearTimeout(lockTimer)
      scoreHistoryRef.current = []
    }
  }, [ready, autoEnabled, capturing, streamError, handleShutter])

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
          center cutout where the tag should sit. Corner brackets (not a
          full dashed box) so the user's eye doesn't fight trying to align
          to a complete rectangle. The cornerLocked modifier turns the
          brackets teal as a visual confirmation when auto-capture arms. */}
      <div className={styles.cameraScrim} aria-hidden="true">
        <div className={`${styles.cameraScrimPanel} ${styles.cameraScrimTop}`} />
        <div className={`${styles.cameraScrimPanel} ${styles.cameraScrimBottom}`} />
        <div className={`${styles.cameraScrimPanel} ${styles.cameraScrimLeft}`} />
        <div className={`${styles.cameraScrimPanel} ${styles.cameraScrimRight}`} />
        <div className={styles.cameraGuide}>
          <div className={`${styles.cameraGuideCorner} ${styles.cameraGuideCornerTL} ${lockState === 'locked' ? styles.cameraGuideCornerLocked : ''}`} />
          <div className={`${styles.cameraGuideCorner} ${styles.cameraGuideCornerTR} ${lockState === 'locked' ? styles.cameraGuideCornerLocked : ''}`} />
          <div className={`${styles.cameraGuideCorner} ${styles.cameraGuideCornerBL} ${lockState === 'locked' ? styles.cameraGuideCornerLocked : ''}`} />
          <div className={`${styles.cameraGuideCorner} ${styles.cameraGuideCornerBR} ${lockState === 'locked' ? styles.cameraGuideCornerLocked : ''}`} />
        </div>
      </div>

      {/* Top bar — title left, auto-capture toggle + close on the right.
          Toggle is a small pill that reads "Auto · On" / "Auto · Off" so
          state is obvious without a legend. */}
      <div className={styles.cameraTopBar}>
        <div className={styles.cameraTopTitle}>Scan a tag</div>
        <div className={styles.cameraTopRight}>
          <button
            type="button"
            className={`${styles.cameraAutoToggle} ${autoEnabled ? styles.cameraAutoToggleOn : ''}`}
            onClick={() => setAutoEnabled(v => !v)}
            aria-pressed={autoEnabled}
            aria-label={`Auto-capture ${autoEnabled ? 'on' : 'off'}`}
          >
            <span className={styles.cameraAutoDot} aria-hidden="true" />
            Auto {autoEnabled ? 'on' : 'off'}
          </button>
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
      </div>

      {/* Framing coach line. Sits just below the guide rect so the eye
          naturally moves from "what am I aiming at?" (the dashed box) to
          "how do I aim it?" (this text). Copy changes with auto lock
          state so the user gets real-time feedback. */}
      <div className={styles.cameraHint} aria-live="polite">
        {!ready
          ? 'Starting camera\u2026'
          : !autoEnabled
            ? 'Fit the tag inside the box, then tap to capture'
            : lockState === 'locked'
              ? 'Got it\u2026'
              : lockState === 'locking'
                ? 'Hold steady\u2026'
                : 'Fit the tag inside the box'}
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

      {/* Shutter flash — pure CSS fade-out. Rendered conditionally so each
          new shutter press re-triggers the animation cleanly (remount =
          fresh animation; otherwise you'd have to hackily toggle a class). */}
      {flash && <div className={styles.cameraFlash} aria-hidden="true" />}
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
      const fields     = data?.fields
      const confidence = data?.confidence ?? null
      if (!fields) {
        setError(errorMessageFor('unknown'))
        setErrorDebug('code: empty_response')
        return
      }
      // Second argument lets the parent flag low-confidence fields for
      // review. Older callers that only take `fields` stay compatible.
      onResult?.(fields, confidence)
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
    // Prime audio inside this user gesture so Safari/iOS will actually
    // play the shutter click on capture. Doing this later (from the
    // auto-capture timer, for instance) would hit a suspended context
    // and the sound would silently fail.
    primeAudio()
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
