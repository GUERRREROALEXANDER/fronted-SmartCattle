import type { EventCategory, EventKind, Severity } from '../types/domain'

// Severity is a presentation default until the backend sends severity. Labels must not accuse people of crimes.
export const eventCatalog: Record<EventKind, { label: string; category: EventCategory; defaultSeverity: Severity }> = {
  cattle_out_of_zone: { label: 'Animal fuera de la zona segura', category: 'cattle', defaultSeverity: 'warning' },
  person_detected: { label: 'Persona detectada', category: 'security', defaultSeverity: 'info' },
  possible_intrusion: { label: 'Posible intrusión', category: 'security', defaultSeverity: 'critical' },
  external_animal_detected: { label: 'Animal externo detectado', category: 'cattle', defaultSeverity: 'warning' },
  possible_unauthorized_movement: { label: 'Posible movimiento no autorizado de ganado', category: 'security', defaultSeverity: 'critical' },
  camera_disconnected: { label: 'Cámara desconectada', category: 'system', defaultSeverity: 'warning' },
  ai_unavailable: { label: 'Servicio de visión no disponible', category: 'system', defaultSeverity: 'critical' },
}

export function detectedObjectLabel(value: string): string {
  switch (value) {
    case 'cow': return 'bovino'
    case 'person': return 'persona'
    case 'vehicle': return 'vehículo'
    default: return value
  }
}
