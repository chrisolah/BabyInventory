import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import BatchReview from './BatchReview'
import styles from './TagScanner.module.css'

// ── Batch photo persistence via IndexedDB ────────────────────────────────────
// sessionStorage can't hold data URLs (too large). IndexedDB is available in
// WKWebView (iOS 10+) and survives in-app refreshes, so we use it to persist
// thumbnails across accidental refreshes while the batch is in progress.
const PHOTO_DB_NAME  = 'sprigloop_batch_photos'
const PHOTO_DB_STORE = 'photos'
const PHOTO_DB_VER   = 1

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VER)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(PHOTO_DB_STORE)
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })
}

async function savePhotosToIDB(items) {
  try {
    const db = await openPhotoDB()
    const tx = db.transaction(PHOTO_DB_STORE, 'readwrite')
    const store = tx.objectStore(PHOTO_DB_STORE)
    for (const it of items) {
      const photos = {}
      if (it.thumbnailDataUrl)        photos.thumbnailDataUrl        = it.thumbnailDataUrl
      if (it.garmentThumbnailDataUrl) photos.garmentThumbnailDataUrl = it.garmentThumbnailDataUrl
      if (it.tagThumbnailDataUrl)     photos.tagThumbnailDataUrl     = it.tagThumbnailDataUrl
      if (it.itemDataUrl)             photos.itemDataUrl             = it.itemDataUrl
      if (Object.keys(photos).length > 0) store.put(photos, it.id)
    }
    tx.commit?.()
  } catch { /* silent — degradation is no thumbnails, not a crash */ }
}

async function loadPhotosFromIDB(itemIds) {
  try {
    const db = await openPhotoDB()
    const tx = db.transaction(PHOTO_DB_STORE, 'readonly')
    const store = tx.objectStore(PHOTO_DB_STORE)
    const map = {}
    await Promise.all(itemIds.map(
      (id) => new Promise((res) => {
        const req = store.get(id)
        req.onsuccess = () => { if (req.result) map[id] = req.result; res() }
        req.onerror   = () => res()
      })
    ))
    return map
  } catch { return {} }
}

async function clearPhotosFromIDB(itemIds) {
  try {
    const db = await openPhotoDB()
    const tx = db.transaction(PHOTO_DB_STORE, 'readwrite')
    const store = tx.objectStore(PHOTO_DB_STORE)
    for (const id of itemIds) store.delete(id)
    tx.commit?.()
  } catch { /* silent */ }
}

async function clearAllPhotosFromIDB() {
  try {
    const db = await openPhotoDB()
    const tx = db.transaction(PHOTO_DB_STORE, 'readwrite')
    tx.objectStore(PHOTO_DB_STORE).clear()
    tx.commit?.()
  } catch { /* silent */ }
}

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

// Clear-frame gate (batch mode only). After a batch capture fires, we refuse
// to auto-fire again until the user explicitly taps the on-screen "Scan next"
// button. That's the ONLY way out of the gate.
//
// We previously tried two flavors of automatic re-arm — (a) "watch for an
// idle / non-tag-like frame and re-arm when seen" and (b) "5-second force-
// clear safety belt" — and BOTH produced rogue auto-captures in real use.
// The idle-frame heuristic re-armed on any brief glance at a hand or
// background between items; the timeout re-armed when the phone was set
// down on a pile of clothes. Either failure mode looks the same to the
// user: photos firing without consent. The explicit-tap-only design
// trades a tiny bit of friction (one tap per item) for a complete
// guarantee that nothing fires unless the user asked for it.

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

// CameraModal props:
//   step                   — 'tag' | 'garment'. Tag step uses the tag-shaped
//                            guide + auto-capture; garment step uses no guide
//                            and manual shutter only (no clean visual signal
//                            for "well-framed garment" makes auto fragile).
//                            Ignored when singleStep=true.
//   singleStep             — boolean (default false). When true: single-photo
//                            item mode. No guide, no auto-capture, no skip
//                            buttons, title reads "Photograph the item". The
//                            shutter fires onCapture(blob, { step: 'item' }).
//   onCapture(blob, meta)  — fired when the shutter commits a frame; meta
//                            carries { step, auto }. Parent buffers tag,
//                            advances step, and aggregates the pair.
//   onSkipStep(step)       — user tapped Skip. Parent advances state without
//                            a blob for that step.
//   onClose()              — user tapped the X or pressed Escape
//   onFallback()           — user tapped "Upload instead" / the stream errored
//   batchMode              — boolean: when true, camera stays open after each
//                            ITEM (i.e. after both tag+garment captures) and
//                            accumulates into a batch via the thumbnail strip.
//   onBatchToggle(next)    — user tapped the "Multi" pill. Parent owns state
//                            (arm/disarm is a parent-level concern).
//   batchItems             — array of already-scanned batch items to render
//                            in the thumbnail strip; each item must expose
//                            { id, thumbnailDataUrl }. Pass [] when unused.
//   onReview()             — user tapped the "Review N items" button. Parent
//                            closes the camera and opens the review surface.
function CameraModal({
  step = 'tag',
  singleStep = false,
  onCapture,
  onSkipStep,
  onClose,
  onFallback,
  batchMode = false,
  onBatchToggle,
  batchItems = [],
  onReview,
}) {
  // In singleStep mode we bypass the two-step tag/garment flow entirely.
  // isTagStep drives auto-capture and guide visibility; force false so
  // neither fires when we're in item-recognition mode.
  const isTagStep = !singleStep && step === 'tag'
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const sampleCanvasRef = useRef(null)
  const scoreHistoryRef = useRef([])
  const modalOpenedAtRef = useRef(0)
  // Clear-frame gate. True after a batch capture fires; auto-capture is
  // suppressed until the user explicitly taps "Scan next". See the constant
  // block above for why automatic re-arm (idle-frame OR timeout) was removed.
  const needsClearFrameRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [capturing, setCapturing] = useState(false)
  // Auto-capture flag. Default on; the user can disable via the top-bar
  // pill if they're struggling with the lock heuristic (odd lighting, busy
  // garment pattern misread as "sharp").
  const [autoEnabled, setAutoEnabled] = useState(true)
  // Lock state drives the guide-corner color + hint copy. 'waiting' =
  // aiming, 'locking' = scores are climbing into range, 'locked' = held
  // long enough, about to fire, 'needsClear' = batch mode just captured and
  // we're waiting for the previous garment to leave the frame before re-arming.
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

  // Clear the gate and re-arm auto-capture for the next item. This is the
  // ONLY path out of needsClear in batch mode — the camera will sit on the
  // 'needsClear' state forever until the user taps Scan next. No-op if the
  // gate isn't currently armed; safe to wire up as the button's only handler.
  const handleNextItem = useCallback(() => {
    if (!needsClearFrameRef.current) return
    needsClearFrameRef.current = false
    scoreHistoryRef.current = []
    setLockState('waiting')
  }, [])

  // useCallback so the auto-capture effect below can depend on it stably —
  // otherwise we'd tear down and rebuild the sampling interval on every
  // render, which resets the history window and makes locks fire late.
  //
  // `viaAuto` distinguishes lock-fired captures from manual shutter taps so
  // the parent can tag the analytics event accordingly. Defaults to false so
  // the manual onClick path stays a zero-arg handler.
  const handleShutter = useCallback(async (viaAuto = false) => {
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
      // In singleStep (item) mode the step name is 'item'; the parent
      // treats it as a complete capture without buffering.
      const effectiveStep = singleStep ? 'item' : step
      onCapture?.(blob, { auto: viaAuto, step: effectiveStep })
      // Two-step capture (tag then garment) reshapes when the modal stays
      // mounted vs unmounts. The matrix:
      //   single + tag      → modal stays open (parent flips step to garment)
      //   single + garment  → modal unmounts (parent commits the pair, closes)
      //   batch  + tag      → modal stays open (parent flips step to garment)
      //   batch  + garment  → modal stays open (parent commits, returns step to tag)
      //   singleStep (item) → same as garment: item end for both modes
      // For everything except "single + garment/item" we need to release
      // `capturing` here or the shutter stays locked forever.
      const itemEnd = singleStep || step === 'garment'
      const modalStaysOpen = batchMode || !itemEnd
      if (modalStaysOpen) {
        setCapturing(false)
        scoreHistoryRef.current = []
        if (batchMode && itemEnd) {
          // End of an item in batch mode — gate auto until user taps
          // "Scan next" so the next item's tag step doesn't auto-fire on
          // whatever frame happens to be in view as they pivot the phone.
          // Same anti-rogue-fire rationale as the constants block above.
          needsClearFrameRef.current = true
          setLockState('needsClear')
          // Push the warmup clock forward so the next auto-fire isn't
          // triggered by the same frame that just fired.
          modalOpenedAtRef.current = Date.now()
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('CameraModal shutter failed', err)
      setStreamError('capture_failed')
      setCapturing(false)
    }
  }, [ready, capturing, onCapture, batchMode, step, singleStep])

  // Auto-capture sampling loop. Runs while the stream is ready, auto mode
  // is enabled, the current step is the tag step (garment shots have no
  // clean "well-framed" visual signal so auto on that step would misfire),
  // and we haven't already triggered a capture. Every
  // AUTO_SAMPLE_MS we redraw the full video frame into a tiny offscreen
  // canvas, compute a sharpness score, and check whether the rolling window
  // has been consistently sharp AND stable. Consistently = all samples ≥
  // min threshold; stable = the spread of the window is small relative to
  // its mean (user isn't panning/shaking).
  useEffect(() => {
    if (!ready || !autoEnabled || capturing || streamError || !isTagStep) {
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

        // Clear-frame gate. While armed (set after a batch capture), we
        // refuse to auto-fire entirely. The ONLY way out of the gate is
        // the user tapping the on-screen "Scan next" button, which calls
        // handleNextItem() and clears the flag. We deliberately do not
        // try to auto-detect when the previous garment has left the
        // frame — that heuristic produced rogue captures every time we
        // tried it (idle-streak detection AND a force-clear timer were
        // both attempted and both shipped bugs). Explicit tap is safer.
        if (needsClearFrameRef.current) {
          return
        }

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
              if (!disposed) handleShutter(true)
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
      // Don't reset needsClearFrameRef here — the gate's whole job is to
      // survive the brief effect rerun that happens when `capturing` flips
      // false right after a batch shutter. Resetting it would defeat the
      // whole gate.
    }
  }, [ready, autoEnabled, capturing, streamError, isTagStep, handleShutter])

  // Stream error state: bail out gracefully and offer the file picker.
  // We don't try to recover in place because most errors (permission denied,
  // no camera) aren't going to flip mid-session, and pretending to be
  // "trying again" would just feel broken.
  if (streamError) {
    return (
      <div className={styles.cameraModal} role="dialog" aria-modal="true" aria-label="Camera unavailable">
        <div className={styles.cameraErrorBox}>
          <div className={styles.cameraErrorTitle}>Can’t open the camera</div>
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
    <div className={styles.cameraModal} role="dialog" aria-modal="true" aria-label={isTagStep ? 'Scan the hangtag' : 'Take a wider garment shot'}>
      <video
        ref={videoRef}
        className={styles.cameraVideo}
        onLoadedMetadata={handleLoaded}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
      />

      {/* Guide overlay. Tag step only — the band-shaped guide and
          corner brackets coach the user toward the auto-capture sweet
          spot. On the garment step there's no cleanly-defined "frame
          this region" target (a garment fills whatever space it fills),
          so we drop the scrim entirely and show the full video frame. */}
      {isTagStep && (
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
      )}

      {/* Top bar — title left, auto/multi toggles + close on the right.
          Auto pill reads "Auto · On/Off" so state is obvious without a
          legend. Multi pill is shown when batchMode is available; once the
          batch has ≥1 item it's replaced by a "Review N items" button
          that becomes the primary exit from the camera (more prominent
          than the Close X, which would throw the batch away). */}
      <div className={styles.cameraTopBar}>
        <div className={styles.cameraTopTitle}>
          {/* Title is step-aware. The "X of 2" suffix tells the user where
              they are in the per-item capture flow. In batch mode we
              append a "(N saved)" marker so the user can still see how
              many items they've already captured this session.
              singleStep mode uses a simpler "Photograph the item" title. */}
          {singleStep
            ? 'Photograph the item'
            : isTagStep ? 'Hangtag · 1 of 2' : 'Whole garment · 2 of 2'}
          {batchMode && batchItems.length > 0 && (
            <span className={styles.cameraTopBatchCount}>
              {' · '}{batchItems.length} saved
            </span>
          )}
        </div>
        <div className={styles.cameraTopRight}>
          {!singleStep && (
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
          )}
          {onBatchToggle && batchItems.length === 0 && (
            <button
              type="button"
              className={`${styles.cameraAutoToggle} ${batchMode ? styles.cameraAutoToggleOn : ''}`}
              onClick={() => onBatchToggle(!batchMode)}
              aria-pressed={batchMode}
              aria-label={`Scan multiple items in a row ${batchMode ? 'on' : 'off'}`}
            >
              <span className={styles.cameraAutoDot} aria-hidden="true" />
              Scan many
            </button>
          )}
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

      {/* Framing coach line. Sits just below the guide rect (or where it
          would be on the garment step). Tag-step copy mirrors the auto-
          capture state machine; garment-step copy is simpler since
          there's no auto and no lock \u2014 just a plain framing prompt. */}
      <div className={styles.cameraHint} aria-live="polite">
        {!ready
          ? 'Starting camera\u2026'
          : singleStep
            ? 'Point the camera at the item or its box, then tap to capture.'
            : !isTagStep
              ? 'Frame the whole garment, then tap to capture. Skip if you only want the tag.'
              : !autoEnabled
                ? 'Fit the tag inside the box, then tap to capture'
                : lockState === 'locked'
                  ? 'Got it\u2026'
                  : lockState === 'needsClear'
                    ? 'Captured. Tap Next when you\u2019re ready for the next one.'
                    : lockState === 'locking'
                      ? 'Hold steady\u2026'
                      : 'Fit the tag inside the box'}
      </div>

      {/* Manual "Scan next" button — the primary way to advance in batch
          mode. Renders only while the clear-frame gate is armed (i.e.,
          right after a capture). Big, pulsing, hard to miss. The
          auto-disarm idle detection still runs in the background as a
          fast convenience path, but the button is the explicit, reliable
          mechanism — especially important because a previous attempt to
          add a 5-second auto-timeout caused the camera to keep firing
          when users set their phone down while sorting clothes. */}
      {ready && autoEnabled && lockState === 'needsClear' && (
        <button
          type="button"
          className={styles.cameraNextBtn}
          onClick={handleNextItem}
        >
          Scan next
        </button>
      )}

      {/* Batch thumbnail strip — sits just above the bottom bar when we
          have any scanned items. Horizontal-scroll list of tiny crops so
          the user has a running sense of what they've captured without
          leaving the camera. Keeps the shutter real estate intact. */}
      {batchMode && batchItems.length > 0 && (
        <div className={styles.cameraThumbStrip} aria-label={`${batchItems.length} scanned so far`}>
          {batchItems.map((item) => (
            <div key={item.id} className={styles.cameraThumb}>
              <img src={item.thumbnailDataUrl} alt="" className={styles.cameraThumbImg} />
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar — shutter in the middle. The left slot is context-
          dependent: fallback link when we're in single mode or the batch
          is empty; a prominent "Review N" button once the batch has
          items. The right slot now hosts the per-step Skip button —
          either "Skip tag" (jumps straight to the garment step with no
          tag photo) or "Skip garment" (commits the tag photo only and
          advances the item). Single-photo items are valid; only "skip
          both" is rejected. */}
      <div className={styles.cameraBottomBar}>
        {batchMode && batchItems.length > 0 ? (
          <button
            type="button"
            className={styles.cameraReviewBtn}
            onClick={onReview}
          >
            Review {batchItems.length}
          </button>
        ) : (
          <button
            type="button"
            className={styles.cameraFallbackLink}
            onClick={onFallback}
          >
            Upload instead
          </button>
        )}
        <button
          type="button"
          className={styles.cameraShutter}
          onClick={() => handleShutter(false)}
          disabled={!ready || capturing}
          aria-label="Take photo"
        >
          <span className={styles.cameraShutterInner} />
        </button>
        {!singleStep && (
          <button
            type="button"
            className={styles.cameraSkipBtn}
            onClick={() => onSkipStep?.(step)}
            disabled={capturing}
            aria-label={isTagStep ? 'Skip the tag photo' : 'Skip the garment photo'}
          >
            {isTagStep ? 'Skip tag' : 'Skip garment'}
          </button>
        )}
      </div>

      {/* Shutter flash — pure CSS fade-out. Rendered conditionally so each
          new shutter press re-triggers the animation cleanly (remount =
          fresh animation; otherwise you'd have to hackily toggle a class). */}
      {flash && <div className={styles.cameraFlash} aria-hidden="true" />}
    </div>
  )
}

// Pre-camera mode picker. Bottom-sheet with two large tap targets (single
// vs. batch) plus a Cancel. The whole point of putting this BEFORE the
// camera is that the system "camera in use" toast that mobile Chrome
// shows after permission grant covers the in-camera Multi pill — by the
// time the user can swipe it away, auto-capture has often already fired.
// Routing through this sheet means batchMode is already the right value
// when CameraModal mounts.
function ModePicker({ onPick, onCancel, onManual, mode = 'tag' }) {
  // Escape to dismiss for desktop testing — same pattern as CameraModal.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className={styles.modePickerScrim}
      role="dialog"
      aria-modal="true"
      aria-label="How do you want to add?"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className={styles.modePickerSheet}>
        <div className={styles.modePickerTitle}>How do you want to add?</div>
        <button
          type="button"
          className={styles.modePickerCard}
          onClick={() => onPick(false)}
        >
          <div className={`${styles.modePickerCardIcon} ${styles.modePickerIconSingle}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className={styles.modePickerCardText}>
            <div className={styles.modePickerCardTitle}>Scan one item</div>
            <div className={styles.modePickerCardBody}>
              {mode === 'item'
                ? 'Snap a photo. We prefill the details for you.'
                : 'Snap the tag. We prefill the details for you.'}
            </div>
          </div>
        </button>
        <button
          type="button"
          className={styles.modePickerCard}
          onClick={() => onPick(true)}
        >
          <div className={`${styles.modePickerCardIcon} ${styles.modePickerIconBatch}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <rect x="3" y="9" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="7" y="4" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className={styles.modePickerCardText}>
            <div className={styles.modePickerCardTitle}>Scan a whole stack</div>
            <div className={styles.modePickerCardBody}>Camera stays open. Scan as many as you want, then review.</div>
          </div>
        </button>
        {onManual && (
          <button
            type="button"
            className={styles.modePickerCard}
            onClick={onManual}
          >
            <div className={`${styles.modePickerCardIcon} ${styles.modePickerIconManual}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path d="M12 20h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.modePickerCardText}>
              <div className={styles.modePickerCardTitle}>Type it in</div>
              <div className={styles.modePickerCardBody}>No tag? Fill in the details yourself.</div>
            </div>
          </button>
        )}
        <button type="button" className={styles.modePickerCancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function TagScanner({
  onResult,
  onBatchSaved,
  variant = 'inline',
  label,
  disabled = false,
  // When true, open the mode picker immediately on mount. Used when
  // navigating to /add-item via an "Add item" button — the sheet appears
  // right away instead of requiring a second tap on "Scan a tag".
  autoOpen = false,
  // Called when the user picks "Type it in" from the mode picker. When
  // provided, a third card appears in the picker. When null/undefined the
  // card is hidden (preserving the original two-option behaviour for any
  // surface that embeds TagScanner without a manual-entry path).
  onManual = null,
  // Where in the app this scanner is mounted. Flows through to every
  // analytics event so we can answer "do scans started from Home convert
  // better than scans started from AddItem?" — and eventually 'onboarding'
  // once we wire the cold-start entry point. Defaults to 'unknown' so a
  // stray mount never silently breaks the funnel slice.
  from = 'unknown',
  // 'tag'  = clothing hang-tag two-step flow (default / existing behaviour)
  // 'item' = single-photo visual recognition for non-clothing categories
  mode = 'tag',
  // Passed to the scan-item edge function as a category hint so the model
  // can narrow its taxonomy. Should match a top-level category ID
  // (sleep, feeding, diapering, travel, play, health, bath). null = no hint.
  topCategory = null,
}) {
  const inputRef = useRef(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [errorDebug, setErrorDebug] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  // Pre-camera mode picker. When the user taps the "Scan a tag" button we
  // show this sheet first, asking single vs. batch. Mode is set BEFORE the
  // camera opens, which sidesteps the mobile-Chrome "[site] is using your
  // camera" toast that covers the in-camera Multi pill long enough for
  // auto-capture to fire on a single item the user actually wanted to
  // batch. Skipped when we're falling back to the file picker.
  const [modePickerOpen, setModePickerOpen] = useState(autoOpen)
  // Batch mode state. Set by the pre-camera mode picker (or, after the
  // camera is open, by the in-camera "Multi" toggle for switching modes
  // mid-session). batchItems accumulates { id, thumbnailDataUrl, fields,
  // confidence } — the thumbnail is a data URL derived from the same
  // compressed JPEG we already send up to the Edge Function, so we pay
  // zero extra bytes over the wire. reviewOpen is the boolean that swaps
  // the camera for the <BatchReview> overlay.
  const [batchMode, setBatchMode] = useState(false)
  const [batchItems, setBatchItems] = useState([])
  const [reviewOpen, setReviewOpen] = useState(false)

  // ── Batch draft persistence ─────────────────────────────────────────────
  // Saves fields + confidence (no image data URLs) to sessionStorage so the
  // batch survives an accidental page refresh. Capacitor's WKWebView doesn't
  // fire beforeunload on native refresh, so the BatchReview overlay guard
  // can't protect us there. sessionStorage is cleared by the browser when the
  // tab closes, so there's no stale-draft hazard across sessions.
  const DRAFT_KEY = 'sprigloop_batch_draft'

  // Restore on mount — runs once. If a draft exists, repopulate the batch and
  // re-open the review screen. Photos are loaded from IndexedDB and merged in.
  useEffect(() => {
    (async () => {
      try {
        const saved = sessionStorage.getItem(DRAFT_KEY)
        if (!saved) return
        const draft = JSON.parse(saved)
        if (!Array.isArray(draft.items) || draft.items.length === 0) return
        // Load any persisted photos from IndexedDB and merge them back in.
        const photoMap = await loadPhotosFromIDB(draft.items.map((it) => it.id))
        const restored = draft.items.map((it) => ({
          ...it,
          ...(photoMap[it.id] || {}),
        }))
        setBatchItems(restored)
        setBatchMode(true)
        if (draft.reviewOpen) setReviewOpen(true)
      } catch { /* ignore parse errors — corrupt draft is just lost */ }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist on every batch change. Fields go to sessionStorage (fast, sync);
  // photo data URLs go to IndexedDB (async, handles large blobs).
  useEffect(() => {
    if (batchItems.length === 0) {
      sessionStorage.removeItem(DRAFT_KEY)
      clearAllPhotosFromIDB()
      return
    }
    try {
      const draft = {
        reviewOpen,
        items: batchItems.map(({ id, fields, confidence, confirmed }) => ({
          id, fields, confidence, confirmed: confirmed || false,
        })),
      }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch { /* ignore quota errors — draft just won't persist */ }
    // Async photo save — fires and is not awaited so the sync setState path
    // above completes immediately. Photos that fail to save just won't appear
    // after a refresh; the item data is still intact.
    savePhotosToIDB(batchItems)
  }, [batchItems, reviewOpen])

  // Shared upload + extract path. Both the camera shutter and the file
  // picker funnel through here so error handling — and analytics —
  // stay in one place.
  //
  // pair:
  //   { tag?, garment? } where each is a Blob | File | null. At least one
  //   must be present. The compress-and-base64 step runs once per slot;
  //   the edge function expects { tag: { image_base64, mime_type }, ... }.
  //   For the legacy single-blob file-picker path we shim by passing
  //   { tag: blob, garment: null } since the file picker has always been
  //   tag-shaped from the user's POV.
  //
  // opts:
  //   isBatchCapture — append to the in-progress batch instead of calling
  //                    onResult. True only on camera captures while
  //                    batchMode is armed.
  //   source         — 'camera' | 'file'. Lets the analytics event
  //                    distinguish the camera-modal path from the native
  //                    file picker fallback.
  //   auto           — true when the camera shutter fired from auto-lock,
  //                    false on manual taps. Ignored for the file path.
  const sendForScan = useCallback(async (pair, opts = {}) => {
    const { isBatchCapture = false, source = 'file', auto = false } = opts
    // Common shape stamped on every analytics event for this scan attempt
    // so funnel queries can slice by entry point + capture path without
    // joining tables. Mode is read off `isBatchCapture` (not `batchMode`)
    // so the file-picker path correctly reports 'single' even if the user
    // had armed batch mode and then bailed to upload.
    const trackBase = {
      from,
      source,
      mode: isBatchCapture ? 'batch' : 'single',
      auto,
    }
    const startedAt = Date.now()

    setScanning(true)
    setError(null)
    setErrorDebug(null)
    track.tagScanStarted({ ...trackBase, has_tag_photo: !!pair?.tag, has_garment_photo: !!pair?.garment })

    try {
      // Compress whichever blobs we have. compressToBase64 is the same
      // pipeline as before (1024px long edge, 0.8 JPEG); running it twice
      // when both photos are present roughly doubles client-side encoding
      // cost — still well under a second on a mid-range phone, well worth
      // the OCR quality lift from a wider garment shot.
      const tagPayload     = pair?.tag     ? await compressToBase64(pair.tag)     : null
      const garmentPayload = pair?.garment ? await compressToBase64(pair.garment) : null
      if (!tagPayload && !garmentPayload) {
        throw new Error('no_photos')
      }
      const { data, error: fnErr } = await supabase.functions.invoke(
        'scan-clothing-tag',
        {
          body: {
            tag:     tagPayload     ? { image_base64: tagPayload.base64,     mime_type: tagPayload.mime }     : null,
            garment: garmentPayload ? { image_base64: garmentPayload.base64, mime_type: garmentPayload.mime } : null,
          },
        },
      )
      const duration_ms = Date.now() - startedAt
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
        track.tagScanFailed({
          ...trackBase,
          duration_ms,
          error: info.code,
          http_status:     info.status         ?? null,
          upstream_status: info.upstreamStatus ?? null,
        })
        return
      }
      const fields     = data?.fields
      const confidence = data?.confidence ?? null
      const quota      = data?.quota ?? null
      if (!fields) {
        setError(errorMessageFor('unknown'))
        setErrorDebug('code: empty_response')
        track.tagScanFailed({
          ...trackBase,
          duration_ms,
          error: 'empty_response',
        })
        return
      }
      // Field-level telemetry: count of non-null fields out of 4 plus
      // per-field presence + confidence so we can answer "is item_type
      // the weak field?" / "what % of brand extractions are 'low'?"
      // without needing to redeploy with new events later.
      const filled =
        (fields.brand      != null ? 1 : 0) +
        (fields.size_label != null ? 1 : 0) +
        (fields.category   != null ? 1 : 0) +
        (fields.item_type  != null ? 1 : 0)
      track.tagScanCompleted({
        ...trackBase,
        duration_ms,
        filled,
        has_brand:     fields.brand      != null,
        has_size:      fields.size_label != null,
        has_category:  fields.category   != null,
        has_item_type: fields.item_type  != null,
        confidence_brand:     confidence?.brand      ?? null,
        confidence_size:      confidence?.size_label ?? null,
        confidence_category:  confidence?.category   ?? null,
        confidence_item_type: confidence?.item_type  ?? null,
        quota_used:  quota?.used  ?? null,
        quota_limit: quota?.limit ?? null,
      })
      if (isBatchCapture) {
        // Append to the batch — thumbnails reuse the already-compressed
        // JPEG data URLs so we don't re-encode. The "primary" thumbnail
        // (used by the in-camera strip and any legacy single-image
        // surface) prefers the garment shot since it's more visually
        // recognizable than a tag close-up; falls back to the tag when
        // garment is missing. BatchReview separately reads the explicit
        // tag/garment fields and renders both.
        const id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const tagDataUrl     = tagPayload     ? `data:${tagPayload.mime};base64,${tagPayload.base64}`     : null
        const garmentDataUrl = garmentPayload ? `data:${garmentPayload.mime};base64,${garmentPayload.base64}` : null
        const primary        = garmentDataUrl || tagDataUrl
        setBatchItems((prev) => [
          ...prev,
          {
            id,
            thumbnailDataUrl:        primary,
            tagThumbnailDataUrl:     tagDataUrl,
            garmentThumbnailDataUrl: garmentDataUrl,
            fields,
            confidence,
          },
        ])
        return
      }
      // Second argument lets the parent flag low-confidence fields for
      // review. Third argument carries the photo data URLs so the parent
      // (single-mode AddItem) can upload the garment to storage on save.
      // Older two-arg callers stay compatible — the third arg is optional
      // and recipients that don't read it just ignore it.
      const garmentDataUrl = garmentPayload
        ? `data:${garmentPayload.mime};base64,${garmentPayload.base64}`
        : null
      onResult?.(fields, confidence, { garmentDataUrl })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('TagScanner failed:', err)
      setError(errorMessageFor('unknown'))
      setErrorDebug(`code: client_exception \u00B7 ${String(err?.message ?? err).slice(0, 120)}`)
      track.tagScanFailed({
        ...trackBase,
        duration_ms: Date.now() - startedAt,
        error: 'client_exception',
      })
    } finally {
      setScanning(false)
    }
  }, [onResult, from])

  // Single-photo item scan path. Used when mode === 'item'. Calls the
  // scan-item edge function (visual item recognition) instead of
  // scan-clothing-tag. Photo becomes the item's display image.
  const sendItemForScan = useCallback(async (blob, opts = {}) => {
    const { isBatchCapture = false, auto = false } = opts
    const trackBase = { from, source: 'camera', mode: isBatchCapture ? 'batch' : 'single', auto }
    const startedAt = Date.now()

    setScanning(true)
    setError(null)
    setErrorDebug(null)
    track.tagScanStarted({ ...trackBase, has_tag_photo: false, has_garment_photo: true })

    try {
      const compressed = await compressToBase64(blob)
      const { data, error: fnErr } = await supabase.functions.invoke(
        'scan-item',
        {
          body: {
            item: { image_base64: compressed.base64, mime_type: compressed.mime },
            ...(topCategory ? { category_hint: topCategory } : {}),
          },
        },
      )
      const duration_ms = Date.now() - startedAt
      if (fnErr) {
        const info = await extractFnErrorCode(fnErr)
        // eslint-disable-next-line no-console
        console.warn('TagScanner (item) fn error:', info, fnErr)
        setError(errorMessageFor(info.code))
        const parts = [`code: ${info.code}`]
        if (info.status)         parts.push(`HTTP ${info.status}`)
        if (info.upstreamStatus) parts.push(`upstream ${info.upstreamStatus}`)
        if (info.detail)         parts.push(String(info.detail).slice(0, 240))
        setErrorDebug(parts.join(' · '))
        track.tagScanFailed({
          ...trackBase,
          duration_ms,
          error: info.code,
          http_status:     info.status         ?? null,
          upstream_status: info.upstreamStatus ?? null,
        })
        return
      }
      const fields     = data?.fields
      const confidence = data?.confidence ?? null
      const quota      = data?.quota ?? null
      if (!fields) {
        setError(errorMessageFor('unknown'))
        setErrorDebug('code: empty_response')
        track.tagScanFailed({ ...trackBase, duration_ms, error: 'empty_response' })
        return
      }
      const filled =
        (fields.top_category != null ? 1 : 0) +
        (fields.sub_category != null ? 1 : 0) +
        (fields.item_type    != null ? 1 : 0) +
        (fields.brand        != null ? 1 : 0)
      track.tagScanCompleted({
        ...trackBase,
        duration_ms,
        filled,
        has_brand:            fields.brand        != null,
        has_size:             false,
        has_category:         fields.top_category != null,
        has_item_type:        fields.item_type    != null,
        confidence_brand:     confidence?.brand        ?? null,
        confidence_size:      null,
        confidence_category:  confidence?.top_category ?? null,
        confidence_item_type: confidence?.item_type    ?? null,
        quota_used:  quota?.used  ?? null,
        quota_limit: quota?.limit ?? null,
      })
      const itemDataUrl = `data:${compressed.mime};base64,${compressed.base64}`
      if (isBatchCapture) {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        setBatchItems((prev) => [
          ...prev,
          { id, thumbnailDataUrl: itemDataUrl, itemDataUrl, fields, confidence },
        ])
        return
      }
      // Third arg carries the photo data URL so the parent can upload it
      // to storage on save and set item_photo_path.
      onResult?.(fields, confidence, { itemDataUrl })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('TagScanner (item) failed:', err)
      setError(errorMessageFor('unknown'))
      setErrorDebug(`code: client_exception · ${String(err?.message ?? err).slice(0, 120)}`)
      track.tagScanFailed({ ...trackBase, duration_ms: Date.now() - startedAt, error: 'client_exception' })
    } finally {
      setScanning(false)
    }
  }, [onResult, from, topCategory])

  // Two-photo capture state. `currentStep` tells CameraModal which UI to
  // render and which photo is being captured next; `pendingTagBlob` holds
  // the tag blob between steps so we can submit both at once on the
  // garment shutter (or the user's "Skip garment" tap). Reset whenever a
  // capture session ends — modal close, batch save, file-picker fallback.
  // Stored as state (not ref) so React drives the UI consistently with
  // the buffered value, but it isn't read inside render — only on
  // transitions.
  const [currentStep, setCurrentStep] = useState('tag')
  const [pendingTagBlob, setPendingTagBlob] = useState(null)

  const resetCaptureSession = useCallback(() => {
    setCurrentStep('tag')
    setPendingTagBlob(null)
  }, [])

  const onPick = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // File picker is always single-shot and never auto. We feed it as
    // the tag slot (no garment) — the picker has been tag-shaped from
    // the user's POV since Phase 1, and one-photo OCR via the legacy
    // single-image path is what this fallback was always doing.
    await sendForScan({ tag: file, garment: null }, { source: 'file', auto: false, isBatchCapture: false })
  }, [sendForScan])

  const onCameraCapture = useCallback(async (blob, meta = {}) => {
    // Item mode (non-clothing): single photo, no buffering needed.
    if (meta.step === 'item') {
      const opts = { source: 'camera', auto: !!meta.auto, isBatchCapture: batchMode }
      if (!batchMode) setCameraOpen(false)
      await sendItemForScan(blob, opts)
      return
    }

    // Two-step clothing orchestration. Tag capture buffers the blob and
    // advances to the garment step (camera stays mounted). Garment capture
    // commits the pair: in single mode we close the modal first so the
    // form populates while the scan round-trips; in batch mode we stay
    // open and append to batchItems via sendForScan.
    if (meta.step === 'tag') {
      setPendingTagBlob(blob)
      setCurrentStep('garment')
      return
    }

    // step === 'garment' — end of an item. Commit both photos.
    const opts = { source: 'camera', auto: !!meta.auto, isBatchCapture: batchMode }
    const pair = { tag: pendingTagBlob, garment: blob }
    setPendingTagBlob(null)
    setCurrentStep('tag')

    if (!batchMode) setCameraOpen(false)
    await sendForScan(pair, opts)
  }, [sendForScan, sendItemForScan, batchMode, pendingTagBlob])

  const onSkipStep = useCallback(async (step) => {
    // Two skip behaviors:
    //   step === 'tag'     → drop the tag; advance to garment with no buffer
    //   step === 'garment' → commit whatever's buffered (which will be the
    //                        tag, since the user got here by capturing it).
    //                        If nothing is buffered, that means they
    //                        skipped the tag too and now want to skip
    //                        garment — there's no scan to make. No-op so
    //                        they have to either capture or close.
    if (step === 'tag') {
      setPendingTagBlob(null)
      setCurrentStep('garment')
      return
    }
    if (!pendingTagBlob) return // nothing to commit; user must capture or close
    const opts = { source: 'camera', auto: false, isBatchCapture: batchMode }
    const pair = { tag: pendingTagBlob, garment: null }
    setPendingTagBlob(null)
    setCurrentStep('tag')
    if (!batchMode) setCameraOpen(false)
    await sendForScan(pair, opts)
  }, [sendForScan, batchMode, pendingTagBlob])

  // "Multi" pill in the top bar toggles batch arming. We don't allow
  // flipping it off once the batch has items — the exit path from a
  // non-empty batch is always through Review (to save or discard
  // explicitly). Close X on a non-empty batch prompts a confirm.
  const onBatchToggle = useCallback((next) => {
    setBatchMode(next)
    if (!next) setBatchItems([])
  }, [])

  const onReview = useCallback(() => {
    // If the user heads to Review mid-pair (took a tag photo, didn't take
    // a garment), the buffered tag is abandoned — we don't auto-commit it
    // without their explicit shutter or skip. Same logic as onCameraClose.
    resetCaptureSession()
    setCameraOpen(false)
    setReviewOpen(true)
  }, [resetCaptureSession])

  const onReviewBack = useCallback(() => {
    // "Scan more" from review → re-open the camera with batch preserved.
    // Capture session was already reset on the Review entry; reset again
    // defensively so a fresh open is always tag-step + empty buffer.
    resetCaptureSession()
    setReviewOpen(false)
    setCameraOpen(true)
  }, [resetCaptureSession])

  const onReviewDiscard = useCallback(() => {
    setReviewOpen(false)
    setBatchItems([])
    setBatchMode(false)
  }, [])

  const onBatchComplete = useCallback((savedCount) => {
    setReviewOpen(false)
    setBatchItems([])
    setBatchMode(false)
    onBatchSaved?.(savedCount)
  }, [onBatchSaved])

  // Fired when a save run finishes but unconfirmed rows remain in the
  // review. We surface the toast for the chunk we did save (so the user
  // gets the same positive ack as a full save) without closing the
  // review — the leftover rows stay editable for a follow-up save.
  const onBatchPartialSave = useCallback((savedCount) => {
    onBatchSaved?.(savedCount)
  }, [onBatchSaved])

  const onCameraClose = useCallback(() => {
    // Closing the camera with a batch in flight keeps the batch and
    // shunts the user straight to Review — same semantics as tapping
    // the Review button. Parent's confirm-discard lives on the review
    // screen, where we have enough real estate for the prompt. Either
    // way, drop the in-flight per-item pair (a buffered tag photo
    // without a committed garment is meaningless after the modal
    // closes).
    resetCaptureSession()
    if (batchMode && batchItems.length > 0) {
      setCameraOpen(false)
      setReviewOpen(true)
      return
    }
    setCameraOpen(false)
    // Leaving the camera with no batch resets the arm so the next open
    // starts fresh in single mode.
    setBatchMode(false)
  }, [batchMode, batchItems.length, resetCaptureSession])

  function onTopButton() {
    // Prime audio inside this user gesture so Safari/iOS will actually
    // play the shutter click on capture. Doing this later (from the
    // auto-capture timer, for instance) would hit a suspended context
    // and the sound would silently fail.
    primeAudio()
    // Prefer the live camera; file picker is the fallback route. With the
    // live camera we route through the mode picker first so the user has
    // already chosen single vs. batch before any system "camera in use"
    // toast can race the in-camera toggle. The file picker is single-only
    // by nature, so there's nothing to ask there.
    if (canUseLiveCamera()) {
      setModePickerOpen(true)
    } else {
      inputRef.current?.click()
    }
  }

  // Mode picker resolves to either single-shot or batch, then opens the
  // camera with batchMode already set. We always wipe any leftover batch
  // items first because the picker is the canonical "starting a new scan
  // session" moment — no surprise carry-over from a previous open. Same
  // reset for the per-item step machine: every fresh open starts on the
  // tag step with no buffered photo.
  const onPickMode = useCallback((wantsBatch) => {
    setModePickerOpen(false)
    setBatchItems([])
    setBatchMode(wantsBatch)
    resetCaptureSession()
    setCameraOpen(true)
  }, [resetCaptureSession])

  const onCancelModePicker = useCallback(() => {
    setModePickerOpen(false)
  }, [])

  function onFallbackFromModal() {
    setCameraOpen(false)
    // Drop any half-completed pair when switching to the file picker —
    // the picker path is single-photo from the user's POV and a stale
    // buffered tag would silently get committed alongside the next
    // file. Reset before the picker opens.
    resetCaptureSession()
    // A micro-delay so the modal unmount doesn't swallow the synthetic
    // click on some Android WebViews. 0ms via setTimeout is enough —
    // we just need to yield the task queue.
    setTimeout(() => inputRef.current?.click(), 0)
  }

  const defaultLabel = scanning
    ? 'Scanning\u2026'
    : mode === 'item'
      ? (variant === 'primary' ? 'Scan item' : 'Scan to autofill')
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

      {modePickerOpen && (
        <ModePicker
          onPick={onPickMode}
          onCancel={onCancelModePicker}
          onManual={onManual ? () => { setModePickerOpen(false); onManual() } : null}
          mode={mode}
        />
      )}

      {cameraOpen && (
        <CameraModal
          step={currentStep}
          singleStep={mode === 'item'}
          onCapture={onCameraCapture}
          onSkipStep={onSkipStep}
          onClose={onCameraClose}
          onFallback={onFallbackFromModal}
          batchMode={batchMode}
          onBatchToggle={onBatchToggle}
          batchItems={batchItems}
          onReview={onReview}
        />
      )}

      {reviewOpen && (
        <BatchReview
          items={batchItems}
          setItems={setBatchItems}
          onScanMore={onReviewBack}
          onDiscardAll={onReviewDiscard}
          onComplete={onBatchComplete}
          onPartialSave={onBatchPartialSave}
          mode={mode}
        />
      )}
    </div>
  )
}
