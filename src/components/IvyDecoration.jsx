import styles from './IvyDecoration.module.css'

// Decorative ivy climbing the left gutter on signed-in pages. Pure SVG +
// CSS — no JS state, no layout impact — the container is position:fixed
// with pointer-events:none so it never gets in the way of actual content.
//
// The stem is drawn bottom-up with a stroke-dashoffset tween (pathLength=1
// normalizes the length math). Leaves unfurl on stagger so they appear to
// grow out of the stem as the tip passes each attachment. Total run time
// lands around 9 seconds, which is slow enough to feel like growth rather
// than a loading spinner but short enough that it's settled before a user
// scans the page.
//
// Hidden on viewports narrower than ~960px (no gutter to live in). Also
// respects prefers-reduced-motion — skips the animation and shows the
// end state.
export default function IvyDecoration() {
  return (
    <div className={styles.ivy} aria-hidden="true">
      <svg
        className={styles.svg}
        viewBox="0 0 140 800"
        width="140"
        height="800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main stem — wavy bottom-to-top path, slight left/right sway so it
            reads as organic rather than a pipe. Stroke uses the brand teal
            at reduced opacity so it sits behind content without demanding
            attention. */}
        <path
          className={styles.stem}
          pathLength="1"
          d="M 60 800
             C 48 740 82 680 58 620
             C 34 560 90 500 62 440
             C 34 380 85 320 56 260
             C 28 200 78 140 52 80
             L 52 0"
          stroke="#085041"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Leaves. Each <g> wraps one leaf cluster so the transform-origin
            scale can radiate out from where the leaf meets the stem. Colors
            alternate between the brand teal and a warmer shade so it doesn't
            feel monochrome. */}

        {/* Leaf 1 — right side, low */}
        <g
          className={`${styles.leaf} ${styles.leafDelay1}`}
          transform="translate(60 720)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 20 -4 28 -18 Q 32 -28 20 -30 Q 4 -24 0 -8 Z"
            fill="#1D9E75"
            fillOpacity="0.55"
          />
          <path
            d="M 0 0 L 22 -20"
            stroke="#085041"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
        </g>

        {/* Leaf 2 — left side, mid-low */}
        <g
          className={`${styles.leaf} ${styles.leafDelay2}`}
          transform="translate(62 600) scale(-1 1)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 22 -2 32 -16 Q 36 -28 22 -32 Q 6 -26 0 -10 Z"
            fill="#2BA883"
            fillOpacity="0.6"
          />
          <path
            d="M 0 0 L 24 -22"
            stroke="#085041"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
        </g>

        {/* Leaf 3 — right side, mid */}
        <g
          className={`${styles.leaf} ${styles.leafDelay3}`}
          transform="translate(56 460)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 18 -6 26 -18 Q 30 -30 16 -32 Q 2 -24 0 -8 Z"
            fill="#1D9E75"
            fillOpacity="0.5"
          />
          <path
            d="M 0 0 L 20 -20"
            stroke="#085041"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
        </g>

        {/* Leaf 4 — left side, mid-high */}
        <g
          className={`${styles.leaf} ${styles.leafDelay4}`}
          transform="translate(58 340) scale(-1 1)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 20 -4 28 -18 Q 32 -30 18 -32 Q 4 -24 0 -8 Z"
            fill="#2BA883"
            fillOpacity="0.55"
          />
          <path
            d="M 0 0 L 22 -22"
            stroke="#085041"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
        </g>

        {/* Leaf 5 — right side, high */}
        <g
          className={`${styles.leaf} ${styles.leafDelay5}`}
          transform="translate(54 220)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 16 -4 24 -16 Q 28 -28 14 -30 Q 0 -22 0 -8 Z"
            fill="#1D9E75"
            fillOpacity="0.5"
          />
          <path
            d="M 0 0 L 18 -18"
            stroke="#085041"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
        </g>

        {/* Leaf 6 — small, near top, left */}
        <g
          className={`${styles.leaf} ${styles.leafDelay6}`}
          transform="translate(52 100) scale(-1 1)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 14 -2 20 -14 Q 22 -22 10 -24 Q 0 -18 0 -6 Z"
            fill="#2BA883"
            fillOpacity="0.5"
          />
        </g>
      </svg>
    </div>
  )
}
