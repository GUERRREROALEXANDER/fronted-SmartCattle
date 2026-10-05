import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { FilterX, ListChecks, Moon, ShieldAlert } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { EventRow } from '../../components/events/EventRow'
import { describeApiError } from '../../api/errors'
import { Button, EmptyState, ErrorState, Notice, PageHeader, SkeletonText } from '../../components/ui'
import { eventCatalog } from '../../lib/eventCatalog'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useResource } from '../../lib/useResource'
import { getSecurityHours, listCameras, listEvents } from '../../services'
import type { FarmEvent } from '../../types/domain'
import { cameraName } from '../dashboard/dashboardModel'
import { EventDetail } from './EventDetail'
import {
  countByCategory, defaultFilters, filterEvents, groupByDay, hasActiveFilters, isRestrictedTime,
  type CategoryTab, type EventFilters, type Period, type SeverityFilter,
} from './eventsModel'
import styles from './EventsPage.module.css'

const tabs: { id: CategoryTab; label: string }[] = [
  { id: 'all', label: 'Todos' }, { id: 'security', label: 'Seguridad' }, { id: 'cattle', label: 'Ganado' }, { id: 'system', label: 'Sistema' },
]
const periods: { id: Period; label: string }[] = [
  { id: 'all', label: 'Todo el historial' }, { id: 'today', label: 'Hoy' }, { id: '24h', label: 'Últimas 24 horas' }, { id: '7d', label: 'Últimos 7 días' },
]
const severities: { id: SeverityFilter; label: string }[] = [
  { id: 'all', label: 'Todas' }, { id: 'warning', label: 'Advertencia o más' }, { id: 'critical', label: 'Solo críticas' },
]
const isTab = (value: string | null): value is CategoryTab => tabs.some(tab => tab.id === value)

export function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [filters, setFilters] = useState<Omit<EventFilters, 'tab'>>({ period: 'all', cameraId: null, severity: 'all' })
  const tab: CategoryTab = isTab(tabParam) ? tabParam : 'all'
  const selectedId = searchParams.get('event')
  const desktop = useMediaQuery('(min-width: 1024px)')
  const detailHeadingId = useId()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const events = useResource(signal => listEvents({ signal }), { refreshMs: 15_000 })
  const cameras = useResource(signal => listCameras({ signal }), { refreshMs: 60_000 })
  const hours = useResource(signal => getSecurityHours({ signal }))

  const all = events.data ?? []
  const active: EventFilters = { ...filters, tab }
  const visible = filterEvents(all, active, now)
  const counts = countByCategory(all)
  const groups = groupByDay(visible, now)
  const selected = all.find(event => event.id === selectedId) ?? null
  const restricted = (event: FarmEvent) => hours.data != null
    && eventCatalog[event.kind].category === 'security' && isRestrictedTime(event.occurredAt, hours.data.restrictedFrom, hours.data.restrictedTo)

  const update = (changes: Record<string, string | null>) => setSearchParams(previous => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    return next
  }, { replace: true })
  const select = (event: FarmEvent | null) => update({ event: event?.id ?? null })
  const clearFilters = () => setFilters({ period: defaultFilters.period, cameraId: null, severity: defaultFilters.severity })

  const detail = selected && <EventDetail event={selected} cameraLabel={cameraName(cameras.data ?? null, selected.cameraId)}
    restricted={restricted(selected)} now={now} onClose={() => select(null)} headingId={detailHeadingId} />

  return <div className={styles.page}>
    <PageHeader title="Eventos" actions={events.data && <p className={styles.count}>
      {visible.length === 1 ? '1 evento' : `${visible.length} eventos`}
    </p>} />

    <div className={styles.tabs} role="group" aria-label="Categoría">
      {tabs.map(item => <button key={item.id} type="button" className={styles.tab} aria-pressed={tab === item.id}
        onClick={() => update({ tab: item.id === 'all' ? null : item.id, event: null })}>
        {item.id === 'security' && <ShieldAlert size={16} strokeWidth={1.75} aria-hidden="true" />}
        {item.label}<span className={`${styles.tabCount} tabular`}>{counts[item.id]}</span>
      </button>)}
    </div>

    {tab === 'security' && <div className={styles.securityBrief}>
      <p><strong>Una detección de persona no indica intención.</strong> Verifica la cámara antes de actuar o avisar a otros.</p>
      {hours.data && <p className={styles.hours}>
        <Moon size={16} strokeWidth={1.75} aria-hidden="true" />
        Horario restringido {pad(hours.data.restrictedFrom)}:00–{pad(hours.data.restrictedTo)}:00. Las detecciones en ese horario se marcan.
      </p>}
    </div>}

    <div className={styles.filters}>
      <Select label="Periodo" value={filters.period} options={periods}
        onChange={value => setFilters(current => ({ ...current, period: value as Period }))} />
      <Select label="Cámara" value={filters.cameraId ?? ''}
        options={[{ id: '', label: 'Todas las cámaras' }, ...(cameras.data ?? []).map(camera => ({ id: camera.id, label: camera.name }))]}
        onChange={value => setFilters(current => ({ ...current, cameraId: value || null }))} />
      <Select label="Severidad" value={filters.severity} options={severities}
        onChange={value => setFilters(current => ({ ...current, severity: value as SeverityFilter }))} />
      {hasActiveFilters(active) && <Button variant="ghost" size="sm" icon={FilterX} onClick={clearFilters}>Limpiar filtros</Button>}
    </div>

    <div className={styles.layout}>
      <section className={styles.list} aria-label="Lista de eventos">
        {events.status === 'loading' && <SkeletonText lines={8} />}
        {events.status === 'error' && !events.data && <ErrorState {...describeApiError(events.error)} onRetry={events.reload} />}
        {events.status === 'error' && events.data && <Notice tone="warning" title={describeApiError(events.error).title}>
          Se muestran los últimos eventos recibidos. Se reintenta automáticamente.
        </Notice>}
        {events.data && all.length === 0 && <EmptyState icon={ListChecks} title="Sin eventos registrados"
          description="Cuando el sistema de visión detecte algo, aparecerá aquí." />}
        {events.data && all.length > 0 && visible.length === 0 && <EmptyState icon={FilterX} title="Ningún evento coincide"
          description="Prueba con otro periodo, cámara o severidad."
          action={hasActiveFilters(active) ? <Button variant="secondary" size="sm" onClick={clearFilters}>Limpiar filtros</Button> : undefined} />}
        {groups.map(group => <div key={group.key} className={styles.group}>
          <h2 className={styles.day}>{group.label}<span className={`${styles.dayCount} tabular`}>{group.events.length}</span></h2>
          <ol className={styles.rows}>
            {group.events.map(event => <EventRow key={event.id} event={event} now={now}
              cameraLabel={cameraName(cameras.data ?? null, event.cameraId)}
              selected={event.id === selectedId} onSelect={select}
              badge={restricted(event) ? <span className={styles.nightBadge}><Moon size={12} strokeWidth={2} aria-hidden="true" />Horario restringido</span> : undefined} />)}
          </ol>
        </div>)}
      </section>

      {desktop && <aside className={styles.detailPanel} aria-labelledby={selected ? detailHeadingId : undefined}>
        {detail ?? <p className={styles.placeholder}>Selecciona un evento para ver qué pasó, cuándo, dónde y con qué evidencia.</p>}
      </aside>}
    </div>

    {!desktop && <DetailSheet open={Boolean(selected)} onClose={() => select(null)} labelledBy={detailHeadingId}>{detail}</DetailSheet>}
  </div>
}

const pad = (hour: number) => String(hour).padStart(2, '0')

function Select({ label, value, options, onChange }: {
  label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void
}) {
  const id = useId()
  return <div className={styles.select}>
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </div>
}

/** Bottom sheet for the event detail on phones (native dialog: focus trap, Escape and backdrop close). */
function DetailSheet({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return <dialog ref={ref} className={styles.sheet} aria-labelledby={labelledBy} onClose={onClose}
    onClick={event => { if (event.target === ref.current) ref.current?.close() }}>
    <div className={styles.sheetBody}>{children}</div>
  </dialog>
}
