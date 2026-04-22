import { useHousehold } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import styles from './BabySwitcher.module.css'

// Top-of-screen chip row that lets a multi-baby household toggle the active
// baby (or see everything together via "All"). Returns null for single-baby
// households — rendering a one-baby switcher is just noise.
//
// The component is deliberately thin: it reads the selection from
// HouseholdContext and delegates persistence back to it. Screens embed the
// switcher wherever they want it to sit vertically.
//
// Props:
//   from — analytics tag so we can tell "switched on Inventory" apart from
//          "switched on Home". Optional; omitted from the event if absent.
export default function BabySwitcher({ from }) {
  const { babies, selectedBabyId, setSelectedBabyId } = useHousehold()

  // Hide entirely for 0/1 baby. Single-baby is the 90% case today and we
  // don't want to chew up vertical space on it.
  if (babies.length <= 1) return null

  function pick(value) {
    if (value === selectedBabyId) return
    setSelectedBabyId(value)
    track.babySwitched({ to: value === 'all' ? 'all' : 'baby', from: from || null })
  }

  return (
    <nav className={styles.row} aria-label="Switch baby">
      <button
        type="button"
        className={`${styles.chip} ${selectedBabyId === 'all' ? styles.chipActive : ''}`}
        onClick={() => pick('all')}
        aria-pressed={selectedBabyId === 'all'}
      >
        All
      </button>
      {babies.map(b => {
        const isActive = b.id === selectedBabyId
        const label = b.name?.trim() || 'Baby'
        return (
          <button
            key={b.id}
            type="button"
            className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
            onClick={() => pick(b.id)}
            aria-pressed={isActive}
          >
            {label}
          </button>
        )
      })}
    </nav>
  )
}
