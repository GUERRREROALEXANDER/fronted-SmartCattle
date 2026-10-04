import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../app/auth/useAuth'
import { Button, Notice, TextField } from '../../components/ui'
import { demoAccounts, demoPassword } from '../../mocks/mockAuth'
import { AuthError } from '../../types/auth'
import { validateEmail, validateName, validatePassword } from './validation'
import styles from './AuthForm.module.css'

type Field = 'name' | 'email' | 'password'
interface FormNotice { tone: 'critical' | 'warning'; title: string; text: string }

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register, isDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isRegistration = mode === 'register'
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [notice, setNotice] = useState<FormNotice | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false)
  const errors = {
    name: isRegistration ? validateName(values.name) : null,
    email: emailError ?? validateEmail(values.email),
    password: validatePassword(values.password),
  }
  useEffect(() => { if (notice) noticeRef.current?.focus() }, [notice])

  function focusField(field: Field) {
    const input = formRef.current?.elements.namedItem(field)
    if (input instanceof HTMLInputElement) input.focus()
  }
  function update(field: Field, value: string) {
    setValues(current => ({ ...current, [field]: value }))
    if (field === 'email') setEmailError(null)
    setNotice(null)
  }
  function fieldProps(field: Field) {
    return {
      name: field, value: values[field], required: true, disabled: pending,
      error: (submitted || touched[field] ? errors[field] : null) ?? undefined,
      onBlur: () => setTouched(current => ({ ...current, [field]: true })),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => update(field, event.target.value),
    }
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    setSubmitted(true)
    setNotice(null)
    const firstInvalid = (['name', 'email', 'password'] as const).find(field => errors[field])
    if (firstInvalid) { focusField(firstInvalid); return }
    inFlight.current = true
    setPending(true)
    try {
      if (isRegistration) await register({ ...values, name: values.name.trim(), email: values.email.trim() })
      else await login({ email: values.email.trim(), password: values.password })
      const state = location.state as { from?: { pathname?: string } } | null
      const from = state?.from?.pathname
      const destination = !isRegistration && typeof from === 'string' && from.startsWith('/')
        && !from.startsWith('//') && from !== '/login' && from !== '/register' ? from : '/'
      void navigate(destination, { replace: true })
    } catch (error) {
      if (isRegistration && error instanceof AuthError && error.code === 'email_taken') {
        setEmailError('Ya existe una cuenta con este correo.')
        // Focus after pending fields are enabled by the next render.
        requestAnimationFrame(() => focusField('email'))
      } else if (error instanceof AuthError && error.code === 'unavailable') {
        setNotice({ tone: 'warning', title: isRegistration ? 'Registro no disponible' : 'Inicio de sesión no disponible',
          text: 'El backend de SmartCattle todavía no ofrece autenticación.' })
      } else if (!isRegistration && error instanceof AuthError && error.code === 'invalid_credentials') {
        setNotice({ tone: 'critical', title: 'Correo o contraseña incorrectos', text: 'Revisa los datos e inténtalo de nuevo.' })
      } else {
        setNotice({ tone: 'critical', title: isRegistration ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesión',
          text: 'Inténtalo de nuevo en unos segundos.' })
      }
    } finally { inFlight.current = false; setPending(false) }
  }
  function fillDemo(role: 'owner' | 'worker') {
    const account = demoAccounts.find(account => account.role === role)
    if (!account) return
    setValues(current => ({ ...current, email: account.email, password: demoPassword }))
    setEmailError(null)
    setNotice(null)
  }
  return <>
    <form ref={formRef} className={styles.form} noValidate onSubmit={handleSubmit} aria-busy={pending}>
      {notice && <Notice ref={noticeRef} tabIndex={-1} tone={notice.tone} title={notice.title}>{notice.text}</Notice>}
      {isRegistration && <TextField label="Nombre" autoComplete="name" {...fieldProps('name')} />}
      <TextField label="Correo electrónico" type="email" autoComplete="email" inputMode="email" {...fieldProps('email')} />
      <TextField label="Contraseña" type="password" autoComplete={isRegistration ? 'new-password' : 'current-password'}
        hint={isRegistration ? 'Mínimo 8 caracteres.' : undefined} {...fieldProps('password')} />
      <Button type="submit" variant="primary" fullWidth loading={pending}>
        {isRegistration ? (pending ? 'Creando cuenta…' : 'Crear cuenta') : (pending ? 'Ingresando…' : 'Ingresar')}
      </Button>
    </form>
    {!isRegistration && isDemo && <div className={styles.supplement}>
      <Notice tone="info" title="Modo demostración">
        <p>La autenticación es simulada mientras el backend no la ofrezca. Contraseña de prueba: {demoPassword}.</p>
        <div className={styles.demoActions}>
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => fillDemo('owner')}>Entrar como dueño</Button>
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => fillDemo('worker')}>Entrar como trabajador</Button>
        </div>
      </Notice>
    </div>}
    {isRegistration && <p className={styles.note}>Las cuentas de trabajador se crean por invitación del dueño de la finca. Esa función llegará cuando el backend la ofrezca.</p>}
  </>
}
