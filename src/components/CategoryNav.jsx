// Shared category navigation — chip row (mobile) + sidebar (desktop) — used
// by both Plan and Inventory. Extracted 2026-07-07: the two screens had
// byte-identical icon SVGs and near-identical chip/sidebar markup copy-pasted
// in each file, which meant a color or icon tweak in one place silently
// didn't apply to the other. This is the single source of truth now.
//
// Each screen still supplies its own `categories` array (label/id/color/icon)
// so the 9th "special" entry (Registry, which navigates away rather than
// filtering) can keep whatever id/behavior that screen already uses — only
// the render + the 8 shared category icons are consolidated here.

import styles from './CategoryNav.module.css'

// ── Shared icons ────────────────────────────────────────────────────────────
export function ClothingNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M7 2L4 5l2.5 1.5V17h7V6.5L16 5l-3-3-2 2-2-2z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
export function SleepNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M3 10.5A7.5 7.5 0 0013.5 3a7.5 7.5 0 100 15A7.5 7.5 0 003 10.5z"
        stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
export function FeedingNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M8 2v3a4 4 0 004 4v9a1 1 0 01-2 0v-5H8v5a1 1 0 01-2 0V2h2z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
export function DiaperNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 9h16" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}
export function TravelNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M2 14h16M5 14V9l5-4 5 4v5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="6" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="14" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}
export function PlayNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 7.5l5 2.5-5 2.5V7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
export function HealthNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M10 17S3 12.5 3 7.5A4 4 0 0110 5a4 4 0 017 2.5C17 12.5 10 17 10 17z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
export function BathNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M3 11h14v1.5a5 5 0 01-10 0" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 11V5.5A1.5 1.5 0 017.5 5a1.5 1.5 0 011.5 1.5V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
// Bookmark shape — used for the Registry/Wishlist tab on both screens.
export function BookmarkNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M5 3h10a1 1 0 011 1v12l-6-3-6 3V4a1 1 0 011-1z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

// ── Chip row (mobile, horizontal scroll) ────────────────────────────────────
// `categories`: [{ id, label, icon, color }]. `onSelect` receives the whole
// category object so callers can special-case an entry (e.g. Registry
// navigates away instead of just switching tabs) without this component
// needing to know about routing.
export function CategoryChipRow({ categories, activeId, onSelect }) {
  return (
    <div className={styles.catRow}>
      {categories.map(cat => {
        const active = activeId === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            className={`${styles.catChip} ${styles[`catChip_${cat.color}`]} ${active ? styles.catChipActive : ''}`}
            onClick={() => onSelect(cat)}
            aria-label={cat.label}
            aria-pressed={active}
          >
            <div className={`${styles.catChipIcon} ${styles[`catChipIcon_${cat.color}`]}`}>
              <cat.icon />
            </div>
            <span className={styles.catChipLabel}>{cat.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Sidebar (desktop, vertical) ──────────────────────────────────────────────
export function CategorySidebar({ categories, activeId, onSelect, label = 'Category' }) {
  return (
    <aside className={styles.catSidebar} aria-label={label}>
      <div className={styles.catSidebarLabel}>{label}</div>
      {categories.map(cat => (
        <button
          key={cat.id}
          type="button"
          className={`${styles.catSidebarItem} ${activeId === cat.id ? styles.catSidebarItemActive : ''}`}
          onClick={() => onSelect(cat)}
          aria-label={cat.label}
        >
          <span className={styles.catSidebarIcon}><cat.icon /></span>
          <span className={styles.catSidebarText}>{cat.label}</span>
        </button>
      ))}
    </aside>
  )
}
