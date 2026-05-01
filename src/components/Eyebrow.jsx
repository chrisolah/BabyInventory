// Small uppercase pill label that sits above section content. Carries the
// landing's signature section-opener motif into the authed surfaces. Use
// sparingly — one per top-level section, not on every sub-group, otherwise
// the page becomes noisy.
//
// Colors are semantic, not decorative:
//   teal   — active / current / call-to-action
//   amber  — caution / archived / outgrown
//   purple — secondary / completed / informational
//   gray   — neutral / metadata / default
//
// The component renders a <span> not a <div>, and uses align-self: flex-start
// so it doesn't stretch when placed inside a flex column. Pair with a section
// wrapper that uses display:flex; flex-direction:column.

import styles from './Eyebrow.module.css'

export default function Eyebrow({ color = 'gray', children, className = '' }) {
  const cls = `${styles.eyebrow} ${styles[color] ?? styles.gray} ${className}`.trim()
  return <span className={cls}>{children}</span>
}
