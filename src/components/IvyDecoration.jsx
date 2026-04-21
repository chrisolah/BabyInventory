import styles from './IvyDecoration.module.css'

// Decorative ivy climbing the left gutter on signed-in pages. Pure SVG +
// CSS — no JS state, no layout impact — the container is position:fixed
// with pointer-events:none so it never gets in the way of actual content.
//
// The stem travels diagonally from the bottom-left corner to the top-right
// of the gutter section, waving side-to-side as it climbs. Leaves stay
// hidden until the growing tip reaches the midway point (~4.3s into the
// 9s stem animation), then unfurl in sequence. The final three leaves are
// tagged .leafBig and land at 1.2x scale, so the vine visibly "blooms"
// at the top instead of tapering off.
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
        {/* Main stem — bottom-left (10, 800) → top-right (130, 10), with
            alternating horizontal sways to read as organic. pathLength=1
            normalizes the dashoffset math regardless of curve length. */}
        <path
          className={styles.stem}
          pathLength="1"
          d="M 10 800
             Q 45 720 25 620
             Q 5 540 35 470
             Q 65 400 45 330
             Q 25 260 70 200
             Q 110 140 100 80
             L 130 10"
          stroke="#085041"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Leaf 1 — midway, right side. First to appear. */}
        <g
          className={`${styles.leaf} ${styles.leafDelay1}`}
          transform="translate(30 615)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 18 -4 26 -16 Q 30 -26 18 -28 Q 4 -22 0 -8 Z"
            fill="#1D9E75"
            fillOpacity="0.55"
          />
          <path
            d="M 0 0 L 20 -18"
            stroke="#085041"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
        </g>

        {/* Leaf 2 — mid, left side of stem. */}
        <g
          className={`${styles.leaf} ${styles.leafDelay2}`}
          transform="translate(32 470) scale(-1 1)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 20 -4 28 -16 Q 32 -28 18 -30 Q 4 -22 0 -8 Z"
            fill="#2BA883"
            fillOpacity="0.55"
          />
          <path
            d="M 0 0 L 22 -20"
            stroke="#085041"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
        </g>

        {/* Leaf 3 — right side, two-thirds up. */}
        <g
          className={`${styles.leaf} ${styles.leafDelay3}`}
          transform="translate(48 335)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 18 -6 26 -18 Q 30 -30 16 -32 Q 2 -24 0 -8 Z"
            fill="#1D9E75"
            fillOpacity="0.55"
          />
          <path
            d="M 0 0 L 20 -22"
            stroke="#085041"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
        </g>

        {/* Leaf 4 — bigger, left-ish, starting the top bloom. */}
        <g
          className={`${styles.leaf} ${styles.leafBig} ${styles.leafDelay4}`}
          transform="translate(65 205) scale(-1 1)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 22 -4 32 -18 Q 36 -30 20 -34 Q 4 -26 0 -10 Z"
            fill="#2BA883"
            fillOpacity="0.6"
          />
          <path
            d="M 0 0 L 24 -24"
            stroke="#085041"
            strokeOpacity="0.5"
            strokeWidth="1"
          />
        </g>

        {/* Leaf 5 — bigger, right, near the top cluster. */}
        <g
          className={`${styles.leaf} ${styles.leafBig} ${styles.leafDelay5}`}
          transform="translate(95 130)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 22 -4 32 -18 Q 36 -30 20 -34 Q 4 -26 0 -10 Z"
            fill="#1D9E75"
            fillOpacity="0.6"
          />
          <path
            d="M 0 0 L 24 -24"
            stroke="#085041"
            strokeOpacity="0.5"
            strokeWidth="1"
          />
        </g>

        {/* Leaf 6 — biggest, part of the top-right bloom, up-and-right. */}
        <g
          className={`${styles.leaf} ${styles.leafBig} ${styles.leafDelay6}`}
          transform="translate(115 55) rotate(-15)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 22 -6 32 -20 Q 36 -32 18 -34 Q 2 -26 0 -10 Z"
            fill="#2BA883"
            fillOpacity="0.65"
          />
          <path
            d="M 0 0 L 24 -24"
            stroke="#085041"
            strokeOpacity="0.5"
            strokeWidth="1"
          />
        </g>

        {/* Leaf 7 — biggest, the other half of the top bloom, up-and-left. */}
        <g
          className={`${styles.leaf} ${styles.leafBig} ${styles.leafDelay7}`}
          transform="translate(125 25) scale(-1 1) rotate(-10)"
          style={{ transformOrigin: '0 0' }}
        >
          <path
            d="M 0 0 Q 20 -4 28 -18 Q 32 -30 16 -32 Q 2 -24 0 -8 Z"
            fill="#1D9E75"
            fillOpacity="0.6"
          />
        </g>
      </svg>
    </div>
  )
}
