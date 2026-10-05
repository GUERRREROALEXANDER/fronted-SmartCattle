import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EventRow } from '../../components/events/EventRow'
import { describeApiError } from '../../api/errors'
import { EmptyState, ErrorState, PageHeader, SkeletonText } from '../../components/ui'
import { formatCount, formatTime } from '../../lib/format'
import { useResource } from '../../lib/useResource'
import { getDetectedCattleCount, getRegisteredCattleCount, hasPicture, listCameras, listEvents, loadCameraSnapshots } from '../../services'
import { cameraName } from '../dashboard/dashboardModel'
import { HerdSummary } from '../dashboard/HerdSummary'
import { cattleEvents, herdByCamera, visibleTotals } from './cattleModel'
import styles from './CattlePage.module.css'

export function CattlePage() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const registered = useResource(signal => getRegisteredCattleCount({ signal }))
  const detected = useResource(signal => getDetectedCattleCount({ signal }), { refreshMs: 15_000 })
  const cameras = useResource(signal => listCameras({ signal }), { refreshMs: 15_000 })
  const events = useResource(signal => listEvents({ signal }), { refreshMs: 15_000 })
  const ids = (cameras.data ?? []).map(camera => camera.id)
  const frames = useResource(signal => loadCameraSnapshots(ids, signal), { key: ids.join(','), refreshMs: 15_000 })

  const rows = frames.data && cameras.data
    ? herdByCamera(cameras.data, Object.fromEntries(ids.map(id => [id, frames.data![id]?.frame ?? null])), id => hasPicture(frames.data![id]?.stream))
    : []
  const totals = visibleTotals(rows)
  const recent = cattleEvents(events.data ?? []).slice(0, 8)

  return <div className={styles.page}>
    <PageHeader title="Ganado" />

    <div className={styles.layout}>
      <div className={styles.main}>
        <HerdSummary title="Hato" registered={registered} detected={detected} />

        <section aria-labelledby="by-camera-title">
          <h2 id="by-camera-title" className={styles.sectionTitle}>Visibles por cámara</h2>
          <p className={styles.lead}>
            Cada cámara cubre solo una parte de la finca, así que estos conteos no suman el total del hato.
          </p>
          {cameras.status === 'success' && !cameras.data
            ? <ErrorState title="Cámaras no disponibles" description="El servidor todavía no ofrece cámaras ni detecciones." />
            : !frames.data
              ? <SkeletonText lines={4} />
              : <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Cámara</th>
                      <th scope="col" className={styles.wide}>Zona</th>
                      <th scope="col" className={styles.num}>Bovinos visibles</th>
                      <th scope="col" className={styles.num}>Fuera de zona</th>
                      <th scope="col" className={`${styles.num} ${styles.wide}`}>Última imagen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => <tr key={row.camera.id}>
                      <th scope="row"><Link to={`/live?camera=${encodeURIComponent(row.camera.id)}`}>{row.camera.name}</Link></th>
                      <td className={styles.wide}>{row.camera.location}</td>
                      <td className={styles.num}>{row.visible === null ? <span className={styles.muted}>Sin imagen</span> : formatCount(row.visible)}</td>
                      <td className={styles.num}>{row.outside === null ? <span className={styles.muted}>—</span>
                        : row.outside > 0 ? <strong className={styles.outside}>{formatCount(row.outside)}</strong> : '0'}</td>
                      <td className={`${styles.num} ${styles.wide}`}>{row.capturedAt ? formatTime(row.capturedAt) : <span className={styles.muted}>—</span>}</td>
                    </tr>)}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" className={styles.totalLabel}>En imagen ahora ({totals.analyzed} {totals.analyzed === 1 ? 'cámara' : 'cámaras'} con imagen)</th>
                      <td className={styles.wide} />
                      <td className={styles.num}>{formatCount(totals.visible)}</td>
                      <td className={styles.num}>{totals.outside > 0 ? <strong className={styles.outside}>{formatCount(totals.outside)}</strong> : '0'}</td>
                      <td className={styles.wide} />
                    </tr>
                  </tfoot>
                </table>
              </div>}
        </section>
      </div>

      <aside className={styles.aside}>
        <section aria-labelledby="cattle-events-title">
          <div className={styles.heading}>
            <h2 id="cattle-events-title" className={styles.sectionTitle}>Movimientos recientes</h2>
            <Link className={styles.all} to="/events">Ver todos</Link>
          </div>
          {events.status === 'loading' ? <SkeletonText lines={5} />
            : events.status === 'error' && !events.data ? <ErrorState {...describeApiError(events.error)} onRetry={events.reload} />
              : recent.length === 0 ? <EmptyState title="Sin movimientos registrados" description="Las salidas de zona y los animales externos aparecerán aquí." />
                : <ol className={styles.events}>
                  {recent.map(event => <EventRow key={event.id} event={event} cameraLabel={cameraName(cameras.data ?? null, event.cameraId)} now={now} />)}
                </ol>}
        </section>
      </aside>
    </div>
  </div>
}
