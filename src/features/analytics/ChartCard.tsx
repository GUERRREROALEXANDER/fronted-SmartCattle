import { useId, type ReactNode } from 'react'
import { StaggerItem } from '../../motion'
import styles from './ChartCard.module.css'

export interface ChartTable {
  headers: readonly string[]
  rows: readonly (readonly (string | number)[])[]
}

export function ChartCard({ title, insight, footnote, table, index = 0, className, children }: {
  title: string
  insight: string
  footnote?: string
  table: ChartTable
  index?: number
  className?: string
  children: ReactNode
}) {
  const titleId = useId()
  return <StaggerItem index={index} className={[styles.item, className].filter(Boolean).join(' ')}>
    <figure className={styles.card} aria-labelledby={titleId}>
      <figcaption className={styles.caption}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <p className={styles.insight}>{insight}</p>
      </figcaption>
      <div className={styles.visual}>{children}</div>
      {footnote && <p className={styles.footnote}>{footnote}</p>}
      <table className="visually-hidden">
        <caption>{title}: datos de la gráfica</caption>
        <thead><tr>{table.headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>
          {row.map((cell, cellIndex) => cellIndex === 0
            ? <th key={cellIndex} scope="row">{cell}</th>
            : <td key={cellIndex}>{cell}</td>)}
        </tr>)}</tbody>
      </table>
    </figure>
  </StaggerItem>
}
