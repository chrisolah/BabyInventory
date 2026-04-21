import styles from './IvyBanner.module.css'

// Horizontal ivy banner — mobile counterpart to the vertical IvyDecoration.
// Mounts between the Littleloop nav and the hero's "Free for all families"
// eyebrow pill on the landing page. Hidden on desktop (≥ 960px), where
// the full vertical IvyDecoration handles decoration in the left gutter.
//
// Same construction as the vertical one: a Q-curve stem drawn with
// stroke-dashoffset and leaves sampled at on-curve points that unfurl in
// sequence behind the growing tip. Leaves are rotated so they stick up
// out of the horizontal stem (the base leaf shape points up-right at ~45°
// from horizontal; rotations around -50 to -75 tilt it toward vertical
// with varied left/right lean).
export default function IvyBanner() {
  return (
    <div className={styles.banner} aria-hidden="true">
      <svg
        className={styles.svg}
        viewBox="0 0 360 44"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Horizontal stem with five alternating Bézier waves, left → right. */}
        <path
          className={styles.stem}
          pathLength="1"
          d="M 10 28
             Q 45 10 80 26
             Q 115 42 150 24
             Q 185 8 220 28
             Q 255 42 290 22
             Q 325 8 350 24"
          stroke="#085041"
          strokeOpacity="0.55"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />

        {/* Leaves anchored at sampled on-curve points (segment endpoints and
            quadratic midpoints). Rotations tilt each leaf toward vertical so
            it reads as growing up out of the stem. Scales graduate slightly
            left → right so the last leaf feels like a small bloom. */}

        {/* Leaf 1 — seg 1 midpoint (upper peak), tip leans left */}
        <g transform="translate(45 18.5) rotate(-75)">
          <g
            className={`${styles.leaf} ${styles.leafDelay1}`}
            style={{ '--leaf-scale': 0.9 }}
          >
            <path d="M 0 0 Q 14 -4 20 -14 Q 24 -22 12 -24 Q 2 -18 0 -6 Z" fill="#1D9E75" fillOpacity="0.55" />
            <path d="M 0 0 L 16 -16" stroke="#085041" strokeOpacity="0.45" strokeWidth="0.7" />
          </g>
        </g>

        {/* Leaf 2 — seg 1 end, tip leans right */}
        <g transform="translate(80 26) rotate(-50)">
          <g
            className={`${styles.leaf} ${styles.leafDelay2}`}
            style={{ '--leaf-scale': 0.95 }}
          >
            <path d="M 0 0 Q 14 -4 20 -14 Q 24 -22 12 -24 Q 2 -18 0 -6 Z" fill="#2BA883" fillOpacity="0.55" />
            <path d="M 0 0 L 16 -16" stroke="#085041" strokeOpacity="0.45" strokeWidth="0.7" />
          </g>
        </g>

        {/* Leaf 3 — seg 2 end, tip leans slightly left */}
        <g transform="translate(150 24) rotate(-70)">
          <g
            className={`${styles.leaf} ${styles.leafDelay3}`}
            style={{ '--leaf-scale': 1.0 }}
          >
            <path d="M 0 0 Q 14 -4 20 -14 Q 24 -22 12 -24 Q 2 -18 0 -6 Z" fill="#1D9E75" fillOpacity="0.58" />
            <path d="M 0 0 L 16 -16" stroke="#085041" strokeOpacity="0.45" strokeWidth="0.8" />
          </g>
        </g>

        {/* Leaf 4 — seg 3 midpoint (upper peak), straight up */}
        <g transform="translate(185 17) rotate(-60)">
          <g
            className={`${styles.leaf} ${styles.leafDelay4}`}
            style={{ '--leaf-scale': 1.05 }}
          >
            <path d="M 0 0 Q 14 -4 20 -14 Q 24 -22 12 -24 Q 2 -18 0 -6 Z" fill="#2BA883" fillOpacity="0.6" />
            <path d="M 0 0 L 16 -16" stroke="#085041" strokeOpacity="0.5" strokeWidth="0.8" />
          </g>
        </g>

        {/* Leaf 5 — seg 4 end, tip leans right */}
        <g transform="translate(290 22) rotate(-55)">
          <g
            className={`${styles.leaf} ${styles.leafDelay5}`}
            style={{ '--leaf-scale': 1.1 }}
          >
            <path d="M 0 0 Q 14 -4 20 -14 Q 24 -22 12 -24 Q 2 -18 0 -6 Z" fill="#1D9E75" fillOpacity="0.62" />
            <path d="M 0 0 L 16 -16" stroke="#085041" strokeOpacity="0.5" strokeWidth="0.9" />
          </g>
        </g>

        {/* Leaf 6 — stem end (upper peak), bloom leaf */}
        <g transform="translate(350 24) rotate(-45)">
          <g
            className={`${styles.leaf} ${styles.leafDelay6}`}
            style={{ '--leaf-scale': 1.2 }}
          >
            <path d="M 0 0 Q 14 -4 20 -14 Q 24 -22 12 -24 Q 2 -18 0 -6 Z" fill="#2BA883" fillOpacity="0.65" />
            <path d="M 0 0 L 16 -16" stroke="#085041" strokeOpacity="0.5" strokeWidth="0.9" />
          </g>
        </g>
      </svg>
    </div>
  )
}
