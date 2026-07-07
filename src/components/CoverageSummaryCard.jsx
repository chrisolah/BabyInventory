// Shared "readiness" hero card — big percentage + donut chart on a teal
// background. Originally lived only in Plan.jsx; extracted 2026-07-07 so
// Inventory can show the same hero treatment for whichever tab/age-range is
// selected instead of jumping straight from the category chips into a list.
import DonutChart from './DonutChart'
import styles from './CoverageSummaryCard.module.css'

export default function CoverageSummaryCard({ pct, title, subtitle }) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryLeft}>
        <div className={styles.summaryPct}>{pct}%</div>
        <div className={styles.summaryTitle}>{title}</div>
        <div className={styles.summarySub}>{subtitle}</div>
      </div>
      <div className={styles.summaryRight}>
        <DonutChart
          size={80}
          strokeWidth={8}
          pct={pct}
          color="rgba(255,255,255,0.9)"
          trackColor="rgba(255,255,255,0.18)"
          textColor="#fff"
        />
      </div>
    </div>
  )
}
