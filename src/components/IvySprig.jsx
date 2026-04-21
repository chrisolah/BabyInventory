import styles from './IvySprig.module.css'

// Tiny horizontal ivy sprig — the mobile-header version of the vine. Slots
// under the wardrobe name inside the sticky header on logged-in pages.
// Hidden on desktop (≥ 960px) where the vertical IvyDecoration in the
// gutter provides the decoration instead.
//
// Same animation recipe as its big siblings (IvyDecoration, IvyBanner):
// Q-curve stem drawn via stroke-dashoffset + leaves at on-curve points
// that unfurl in sequence. Just much smaller — viewBox is 180×14 so it
// fits comfortably under a 16px header title without adding meaningful
// vertical weight.
export default function IvySprig() {
  return (
    <div className={styles.sprig} aria-hidden="true">
      <svg
        className={styles.svg}
        viewBox="0 0 180 14"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tiny horizontal stem with three waves. */}
        <path
          className={styles.stem}
          pathLength="1"
          d="M 4 9
             Q 28 2 52 10
             Q 76 14 100 6
             Q 124 1 148 9
             Q 164 13 176 8"
          stroke="#085041"
          strokeOpacity="0.5"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
        />

        {/* Four small leaves pointing up out of the stem. Sampled at on-curve
            points; rotations tilt each leaf toward vertical. */}

        <g transform="translate(28 6) rotate(-70)">
          <g className={`${styles.leaf} ${styles.leafDelay1}`} style={{ '--leaf-scale': 0.85 }}>
            <path d="M 0 0 Q 6 -2 9 -7 Q 11 -11 5 -12 Q 1 -9 0 -3 Z" fill="#1D9E75" fillOpacity="0.55" />
          </g>
        </g>

        <g transform="translate(52 10) rotate(-50)">
          <g className={`${styles.leaf} ${styles.leafDelay2}`} style={{ '--leaf-scale': 0.9 }}>
            <path d="M 0 0 Q 6 -2 9 -7 Q 11 -11 5 -12 Q 1 -9 0 -3 Z" fill="#2BA883" fillOpacity="0.58" />
          </g>
        </g>

        <g transform="translate(100 6) rotate(-65)">
          <g className={`${styles.leaf} ${styles.leafDelay3}`} style={{ '--leaf-scale': 1.0 }}>
            <path d="M 0 0 Q 6 -2 9 -7 Q 11 -11 5 -12 Q 1 -9 0 -3 Z" fill="#1D9E75" fillOpacity="0.6" />
          </g>
        </g>

        <g transform="translate(148 9) rotate(-55)">
          <g className={`${styles.leaf} ${styles.leafDelay4}`} style={{ '--leaf-scale': 1.1 }}>
            <path d="M 0 0 Q 6 -2 9 -7 Q 11 -11 5 -12 Q 1 -9 0 -3 Z" fill="#2BA883" fillOpacity="0.62" />
          </g>
        </g>

        <g transform="translate(176 8) rotate(-40)">
          <g className={`${styles.leaf} ${styles.leafDelay5}`} style={{ '--leaf-scale': 1.15 }}>
            <path d="M 0 0 Q 6 -2 9 -7 Q 11 -11 5 -12 Q 1 -9 0 -3 Z" fill="#1D9E75" fillOpacity="0.62" />
          </g>
        </g>
      </svg>
    </div>
  )
}
