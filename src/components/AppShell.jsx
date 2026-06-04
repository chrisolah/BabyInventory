import Sidebar from './Sidebar'
import PullToRefresh from './PullToRefresh'
import styles from './AppShell.module.css'

export default function AppShell({ children }) {
  return (
    <div className={styles.shell}>
      <PullToRefresh />
      <Sidebar />
      <div className={styles.content}>
        {children}
      </div>
    </div>
  )
}
