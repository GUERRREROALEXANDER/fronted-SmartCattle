import { Skeleton } from './Skeleton'
import styles from './SkeletonText.module.css'

export interface SkeletonTextProps { lines?: number }
export function SkeletonText({ lines = 3 }: SkeletonTextProps) {
  const count = Number.isFinite(lines) ? Math.max(0, Math.floor(lines)) : 3
  return <div className={styles.lines} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <Skeleton key={index} width={['100%', '92%', '64%'][index % 3]} />)}
  </div>
}
