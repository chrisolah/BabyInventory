import styles from './IvyDecoration.module.css'

// Decorative ivy climbing the left gutter. Pure SVG + CSS — no JS state,
// no layout impact — the container is position:fixed with pointer-events:none
// so it never gets in the way of actual content.
//
// Geometry:
//   - The container is horizontally centered in the left gutter, offset
//     down from the viewport top so the stem ends just below whichever
//     nav the page uses (landing nav and inventory header are both ~60px).
//   - The SVG uses a viewBox of 140×800. The stem starts at the horizontal
//     centre (x=70) of that viewBox at the bottom (y=800) and sways up to
//     the top-right (y=10) with six alternating Bézier waves.
//   - Leaves are anchored at *actual points on the stem curve* (sampled
//     midpoints and quarter-points of each Q segment, via the identity
//     Q(0.5) = 0.25·P0 + 0.5·C + 0.25·P2). That's what makes them look
//     like they're growing out of the stem instead of floating next to it.
//
// Animation:
//   - The stem draws bottom-up over 9s via stroke-dashoffset.
//   - Leaves stay hidden until the growing tip passes the midway point
//     (~4.3s). They then unfurl in sequence from lowest → highest.
//   - Each leaf declares its own final scale via the --leaf-scale custom
//     property, read by the unfurl keyframe. Scales graduate from 0.85 at
//     the bottom-most visible leaf to 1.4 at the top bloom, so the vine
//     visibly "blooms out" at the top.
//
// Each leaf uses a two-<g> structure: outer group positions via the SVG
// transform attribute, inner group carries the CSS animation. A CSS
// transform on an SVG element *replaces* the element's transform attribute
// — combining both on one node makes the leaves scale from the SVG origin
// instead of their placed attachment point. Splitting them avoids this.
//
// Hidden below ~960px viewport (no gutter to live in). Respects
// prefers-reduced-motion — skips the animation and shows the end state.
export default function IvyDecoration() {
  return (
    <div className={styles.ivy} aria-hidden="true">
      <svg
        className={styles.svg}
        viewBox="0 0 140 800"
        preserveAspectRatio="xMidYMax meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main stem — bottom-centre (70, 800) → top-right (110, 10), with
            six alternating quadratic waves to read as organic. pathLength=1
            normalises the dashoffset math regardless of curve length. */}
        <path
          className={styles.stem}
          pathLength="1"
          d="M 70 800
             Q 105 730 70 660
             Q 35 590 80 520
             Q 120 450 80 380
             Q 40 310 90 240
             Q 125 170 85 100
             Q 60 50 110 10"
          stroke="#085041"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Leaves are anchored at on-curve points. All leaves live on the
            upper half of the stem (y ≤ 415) so they only appear once the
            growing tip has reached the midway point. Scale graduates from
            0.85 to 1.4 as we climb. */}

        {/* Leaf 1 — seg 3 @ t=0.75, just past midway. Stem here is sweeping
            up-and-left from (100,450) toward (80,380), so the leaf sprouts
            to the right, away from the curve. */}
        <g transform="translate(95 415)">
          <g
            className={`${styles.leaf} ${styles.leafDelay1}`}
            style={{ '--leaf-scale': 0.85 }}
          >
            <path d="M 0 0 Q 18 -4 26 -16 Q 30 -26 18 -28 Q 4 -22 0 -8 Z" fill="#1D9E75" fillOpacity="0.55" />
            <path d="M 0 0 L 20 -18" stroke="#085041" strokeOpacity="0.45" strokeWidth="0.8" />
          </g>
        </g>

        {/* Leaf 2 — seg 3 end. Stem continues up-and-left from here. */}
        <g transform="translate(80 380)">
          <g
            className={`${styles.leaf} ${styles.leafDelay2}`}
            style={{ '--leaf-scale': 0.9 }}
          >
            <path d="M 0 0 Q 20 -4 28 -16 Q 32 -28 18 -30 Q 4 -22 0 -8 Z" fill="#2BA883" fillOpacity="0.55" />
            <path d="M 0 0 L 22 -20" stroke="#085041" strokeOpacity="0.45" strokeWidth="0.8" />
          </g>
        </g>

        {/* Leaf 3 — seg 4 midpoint. Stem reaches its leftmost here, so the
            leaf points further left (scale -1 1 flips horizontally). */}
        <g transform="translate(62.5 310) scale(-1 1)">
          <g
            className={`${styles.leaf} ${styles.leafDelay3}`}
            style={{ '--leaf-scale': 0.95 }}
          >
            <path d="M 0 0 Q 20 -6 28 -18 Q 32 -30 16 -30 Q 2 -22 0 -8 Z" fill="#1D9E75" fillOpacity="0.55" />
            <path d="M 0 0 L 22 -22" stroke="#085041" strokeOpacity="0.45" strokeWidth="0.8" />
          </g>
        </g>

        {/* Leaf 4 — seg 4 @ t=0.75, stem starting its sway back to the right. */}
        <g transform="translate(70.625 275)">
          <g
            className={`${styles.leaf} ${styles.leafDelay4}`}
            style={{ '--leaf-scale': 1.0 }}
          >
            <path d="M 0 0 Q 22 -4 30 -18 Q 34 -30 18 -30 Q 4 -22 0 -8 Z" fill="#2BA883" fillOpacity="0.58" />
            <path d="M 0 0 L 24 -22" stroke="#085041" strokeOpacity="0.45" strokeWidth="0.9" />
          </g>
        </g>

        {/* Leaf 5 — seg 4 end. Flipped and rotated so it points upward and
            to the left of the stem, standing noticeably more vertical than
            the right-side leaves below/above it. */}
        <g transform="translate(90 240) scale(-1 1) rotate(-30)">
          <g
            className={`${styles.leaf} ${styles.leafDelay5}`}
            style={{ '--leaf-scale': 1.05 }}
          >
            <path d="M 0 0 Q 22 -4 32 -18 Q 36 -30 20 -32 Q 4 -24 0 -10 Z" fill="#1D9E75" fillOpacity="0.58" />
            <path d="M 0 0 L 24 -24" stroke="#085041" strokeOpacity="0.5" strokeWidth="0.9" />
          </g>
        </g>

        {/* Leaf 6 — seg 5 @ t=0.25, stem reaching rightmost. */}
        <g transform="translate(102.8 205)">
          <g
            className={`${styles.leaf} ${styles.leafDelay6}`}
            style={{ '--leaf-scale': 1.1 }}
          >
            <path d="M 0 0 Q 22 -6 32 -20 Q 36 -32 18 -32 Q 2 -24 0 -10 Z" fill="#2BA883" fillOpacity="0.6" />
            <path d="M 0 0 L 24 -24" stroke="#085041" strokeOpacity="0.5" strokeWidth="1" />
          </g>
        </g>

        {/* Leaf 7 — seg 5 midpoint, still right side. Slight upward rotation
            so it leans into the emerging top bloom. */}
        <g transform="translate(106.25 170) rotate(-10)">
          <g
            className={`${styles.leaf} ${styles.leafDelay7}`}
            style={{ '--leaf-scale': 1.15 }}
          >
            <path d="M 0 0 Q 22 -6 32 -20 Q 38 -32 20 -34 Q 4 -26 0 -10 Z" fill="#1D9E75" fillOpacity="0.6" />
            <path d="M 0 0 L 24 -24" stroke="#085041" strokeOpacity="0.5" strokeWidth="1" />
          </g>
        </g>

        {/* Leaf 8 — seg 5 end, flipped to the left. Stem is weaving back
            toward (60, 50), so the leaf hangs off the outer curve. */}
        <g transform="translate(85 100) scale(-1 1)">
          <g
            className={`${styles.leaf} ${styles.leafDelay8}`}
            style={{ '--leaf-scale': 1.25 }}
          >
            <path d="M 0 0 Q 22 -6 32 -20 Q 38 -32 20 -34 Q 4 -26 0 -10 Z" fill="#2BA883" fillOpacity="0.62" />
            <path d="M 0 0 L 24 -24" stroke="#085041" strokeOpacity="0.5" strokeWidth="1" />
          </g>
        </g>

        {/* Leaf 9 — seg 6 @ t=0.75, part of the top bloom. Tilted up-and-right. */}
        <g transform="translate(89.7 30.6) rotate(-20)">
          <g
            className={`${styles.leaf} ${styles.leafDelay9}`}
            style={{ '--leaf-scale': 1.3 }}
          >
            <path d="M 0 0 Q 22 -6 34 -20 Q 40 -32 20 -36 Q 4 -26 0 -10 Z" fill="#1D9E75" fillOpacity="0.65" />
            <path d="M 0 0 L 26 -26" stroke="#085041" strokeOpacity="0.5" strokeWidth="1" />
          </g>
        </g>

        {/* Leaf 10 — stem tip, the crown of the bloom. Rotated so it sprouts
            up-and-right at a sharper angle. */}
        <g transform="translate(110 10) rotate(-35)">
          <g
            className={`${styles.leaf} ${styles.leafDelay10}`}
            style={{ '--leaf-scale': 1.4 }}
          >
            <path d="M 0 0 Q 24 -6 36 -22 Q 42 -34 22 -38 Q 4 -28 0 -12 Z" fill="#2BA883" fillOpacity="0.65" />
            <path d="M 0 0 L 28 -28" stroke="#085041" strokeOpacity="0.55" strokeWidth="1.1" />
          </g>
        </g>
      </svg>
    </div>
  )
}
