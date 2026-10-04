import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

export interface SkeletonProps {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  radius?: CSSProperties['borderRadius']
  className?: string
}
export function Skeleton({ width, height, radius, className }: SkeletonProps) {
  return <div aria-hidden="true" className={[styles.skeleton, className].filter(Boolean).join(' ')}
    style={{ width, height, borderRadius: radius }} />
}
