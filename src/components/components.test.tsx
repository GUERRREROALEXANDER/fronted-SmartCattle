import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { alarm } from '../lib/alarm'
import { AlarmBanner } from './layout/AlarmBanner'
import { TopBar } from './layout/TopBar'
import { Button, Notice, StatusPill, TextField } from './ui'

describe('Button', () => {
  it('defaults to a non-submitting button', () => {
    expect(renderToStaticMarkup(<Button>Guardar</Button>)).toContain('type="button"')
  })

  it('disables itself and announces busy while loading, keeping the label for width', () => {
    const html = renderToStaticMarkup(<Button loading>Guardar</Button>)
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Guardar')
  })
})

describe('TextField', () => {
  it('links the label, error and invalid state to the input', () => {
    const html = renderToStaticMarkup(<TextField id="mail" label="Correo" error="Escribe tu correo." />)
    expect(html).toContain('for="mail"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="mail-error"')
    expect(html).toContain('Escribe tu correo.')
  })

  it('adds an accessible show/hide toggle for passwords', () => {
    const html = renderToStaticMarkup(<TextField id="pw" label="Contraseña" type="password" />)
    expect(html).toContain('type="password"')
    expect(html).toContain('aria-label="Mostrar contraseña"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-controls="pw"')
  })

  it('lets a custom trailing slot replace the password toggle', () => {
    const html = renderToStaticMarkup(<TextField label="Clave" type="password" trailing={<span>extra</span>} />)
    expect(html).toContain('extra')
    expect(html).not.toContain('Mostrar contraseña')
  })

  it('keeps plain text fields without a trailing slot', () => {
    expect(renderToStaticMarkup(<TextField label="Nombre" />)).not.toContain('<button')
  })
})

describe('Notice and StatusPill', () => {
  it('uses alert for critical notices and status otherwise', () => {
    expect(renderToStaticMarkup(<Notice tone="critical" title="Error" />)).toContain('role="alert"')
    expect(renderToStaticMarkup(<Notice tone="info" title="Dato" />)).toContain('role="status"')
  })

  it('shows the status text, not only color', () => {
    expect(renderToStaticMarkup(<StatusPill tone="safe" label="Dentro" />)).toContain('Dentro')
  })
})

describe('alarm controls', () => {
  afterEach(() => {
    alarm.clear('test:cow')
    alarm.setMuted(false)
  })

  it('renders no banner while the alarm is idle', () => {
    expect(renderToStaticMarkup(<AlarmBanner />)).toBe('')
  })

  it('shows the reason and active source count when raised', () => {
    alarm.raise('test:cow', 'Vaca 12 fuera de la zona segura')
    const html = renderToStaticMarkup(<AlarmBanner />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Vaca 12 fuera de la zona segura')
    expect(html).toContain('1 fuente activa')
    expect(html).toContain('Silenciar')
  })

  it('exposes the mute state on the top bar bell', () => {
    expect(renderToStaticMarkup(<TopBar />)).toContain('aria-label="Silenciar alarma"')
    alarm.setMuted(true)
    const muted = renderToStaticMarkup(<TopBar />)
    expect(muted).toContain('aria-pressed="true"')
    expect(muted).toContain('aria-label="Activar sonido de alarma"')
  })
})
