import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Circle, Clock3, Info, Loader2, Lock, LockKeyhole, Mail, TriangleAlert, UserRound, UsersRound, X } from 'lucide-react'
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../app/auth/useAuth'
import { Button, Notice, TextField } from '../../components/ui'
import { demoAccounts, demoPassword } from '../../mocks/mockAuth'
import { duration, ease, staggerDelay } from '../../motion'
import { AuthError } from '../../types/auth'
import {
  getPasswordStrength, validateEmail, validateIdentifier, validateNewPassword, validatePassword,
  validatePasswordConfirmation, validateUsername, type PasswordStrength,
} from './validation'
import styles from './AuthForm.module.css'

type Field = 'identifier' | 'username' | 'email' | 'password' | 'confirmPassword'
type SubmitStatus = 'idle' | 'pending' | 'success'
interface FormNotice { tone: 'critical' | 'warning'; title: string; text: string }
const emptyValues = { identifier: '', username: '', email: '', password: '', confirmPassword: '' }
const deadlineIn = (ms: number) => Date.now() + ms
// Fields reveal right after the card springs in.
const REVEAL_START = 0.28

function SuccessCheck() {
  const reduce = useReducedMotion()
  return <motion.svg className={styles.successCheck} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"
    initial={reduce ? false : { scale: 0.4, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
    transition={{ type: 'spring', stiffness: 420, damping: 18 }}>
    <circle cx="12" cy="12" r="11" className={styles.successDisc} />
    <motion.path d="M7 12.5l3.2 3.2L17 9" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
      initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ delay: 0.12, duration: 0.32, ease: ease.out }} />
  </motion.svg>
}

function PasswordStrengthMeter({ id, strength }: { id: string; strength: PasswordStrength }) {
  const reduce = useReducedMotion()
  const tone = strength.score === 5 ? styles.strengthStrong : strength.score >= 3 ? styles.strengthMedium : styles.strengthWeak
  return <div id={id} className={styles.strength}>
    <div className={styles.strengthHeader}>
      <span>Seguridad de la contraseña</span>
      <span className={styles.strengthLabel} aria-live="polite">{strength.label}</span>
    </div>
    <div className={styles.strengthTrack} role="meter" aria-label="Seguridad de la contraseña"
      aria-valuemin={0} aria-valuemax={5} aria-valuenow={strength.score}
      aria-valuetext={`${strength.label}: ${strength.score} de 5 requisitos cumplidos`}>
      <motion.div className={`${styles.strengthFill} ${tone}`} initial={false}
        animate={{ scaleX: strength.score / 5 }} transition={{ duration: reduce ? 0 : duration.state, ease: ease.out }} />
    </div>
    <ul className={styles.strengthHints} aria-label="Requisitos de la contraseña">
      {strength.checks.map(check => <li key={check.id} className={check.met ? styles.hintMet : styles.hintPending}>
        {check.met ? <Check size={14} strokeWidth={2.25} aria-hidden="true" /> : <Circle size={12} strokeWidth={1.75} aria-hidden="true" />}
        <span>{check.label}</span><span className={styles.srOnly}>: {check.met ? 'cumplido' : 'pendiente'}</span>
      </li>)}
    </ul>
  </div>
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register, isDemoMode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reduce = useReducedMotion()
  const shakeControls = useAnimationControls()
  const formId = useId()
  const isRegistration = mode === 'register'
  const [values, setValues] = useState(emptyValues)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [serverErrors, setServerErrors] = useState<Partial<Record<Field, string>>>({})
  const [notice, setNotice] = useState<FormNotice | null>(null)
  const [capsLockField, setCapsLockField] = useState<Field | null>(null)
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const [remember, setRemember] = useState(true)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [shownMode, setShownMode] = useState(mode)
  if (shownMode !== mode) {
    setRecoveryOpen(false)
    // Switching between login and register keeps the form mounted; start each mode clean.
    setShownMode(mode)
    setValues(emptyValues)
    setTouched({})
    setSubmitted(false)
    setServerErrors({})
    setNotice(null)
    setCapsLockField(null)
  }
  const pending = status === 'pending'
  const success = status === 'success'
  const busy = pending || success
  const cooldownActive = cooldownEnd !== null
  const passwordId = `${formId}-password`
  const confirmPasswordId = `${formId}-confirm-password`
  const strengthId = `${formId}-password-strength`
  const strength = getPasswordStrength(values.password)
  const errors: Record<Field, string | null> = {
    identifier: serverErrors.identifier ?? validateIdentifier(values.identifier),
    username: serverErrors.username ?? validateUsername(values.username),
    email: serverErrors.email ?? validateEmail(values.email),
    password: serverErrors.password ?? (isRegistration ? validateNewPassword(values.password) : validatePassword(values.password)),
    confirmPassword: serverErrors.confirmPassword ?? validatePasswordConfirmation(values.password, values.confirmPassword),
  }

  // Re-arm on mount: StrictMode runs the cleanup once in development before remounting.
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (notice || cooldownActive) noticeRef.current?.focus()
  }, [notice, cooldownActive])
  useEffect(() => {
    if (cooldownEnd === null) return
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, cooldownEnd - Date.now())
      setCooldownSeconds(Math.ceil(remaining / 1000))
      if (remaining === 0) setCooldownEnd(null)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownEnd])

  function focusField(field: Field) {
    const input = formRef.current?.elements.namedItem(field)
    if (input instanceof HTMLInputElement) input.focus()
  }
  function showErrorFeedback() {
    if (!reduce) {
      void shakeControls.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.3, ease: ease.out } })
    }
  }
  function update(field: Field, value: string) {
    setValues(current => ({ ...current, [field]: value }))
    setServerErrors(current => ({ ...current, [field]: undefined }))
    setNotice(null)
  }
  function fieldProps(field: Field) {
    return {
      name: field, value: values[field], required: true, disabled: busy, className: styles.input,
      error: (submitted || touched[field] || serverErrors[field] ? errors[field] : null) ?? undefined,
      onBlur: () => {
        setTouched(current => ({ ...current, [field]: true }))
        setCapsLockField(current => current === field ? null : current)
      },
      onChange: (event: ChangeEvent<HTMLInputElement>) => update(field, event.target.value),
    }
  }
  function checkCapsLock(field: Field, event: KeyboardEvent<HTMLInputElement>) {
    setCapsLockField(event.getModifierState('CapsLock') ? field : null)
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || success || cooldownActive) return
    setSubmitted(true)
    setNotice(null)
    const fieldOrder: readonly Field[] = isRegistration
      ? ['username', 'email', 'password', 'confirmPassword']
      : ['identifier', 'password']
    const firstInvalid = fieldOrder.find(field => errors[field])
    if (firstInvalid) {
      showErrorFeedback()
      focusField(firstInvalid)
      return
    }

    inFlight.current = true
    setStatus('pending')
    let succeeded = false
    try {
      if (isRegistration) {
        await register({
          username: values.username.trim().toLowerCase(), email: values.email.trim(), password: values.password,
        })
      } else {
        await login({ identifier: values.identifier.trim(), password: values.password })
      }
      succeeded = true
      setStatus('success')
      const state = location.state as { from?: { pathname?: string } } | null
      const from = state?.from?.pathname
      const destination = !isRegistration && typeof from === 'string' && from.startsWith('/')
        && !from.startsWith('//') && from !== '/login' && from !== '/register' ? from : '/'
      await new Promise(resolve => window.setTimeout(resolve, reduce ? 150 : 450))
      if (mounted.current) void navigate(destination, { replace: true })
    } catch (error) {
      if (!isRegistration && error instanceof AuthError && error.code === 'rate_limited') {
        const retryAfterMs = Math.max(0, error.retryAfterMs ?? 30_000)
        setCooldownSeconds(Math.ceil(retryAfterMs / 1000))
        setCooldownEnd(deadlineIn(retryAfterMs))
      } else if (isRegistration && error instanceof AuthError && (error.code === 'email_taken' || error.code === 'username_taken')) {
        const field = error.code === 'email_taken' ? 'email' : 'username'
        const message = error.code === 'email_taken' ? 'Ya existe una cuenta con este correo.' : 'Ese nombre de usuario ya está en uso.'
        setServerErrors(current => ({ ...current, [field]: message }))
        setNotice({ tone: 'critical', title: error.code === 'email_taken' ? 'Correo ya registrado' : 'Usuario no disponible', text: message })
        requestAnimationFrame(() => focusField(field))
      } else if (error instanceof AuthError && error.code === 'unavailable') {
        setNotice({ tone: 'warning', title: isRegistration ? 'Registro no disponible' : 'Inicio de sesión no disponible',
          text: 'El backend de SmartCattle todavía no ofrece autenticación.' })
      } else if (!isRegistration && error instanceof AuthError && error.code === 'invalid_credentials') {
        setNotice({ tone: 'critical', title: 'Usuario o contraseña incorrectos', text: 'Revisa los datos e inténtalo de nuevo.' })
      } else {
        setNotice({ tone: 'critical', title: isRegistration ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesión',
          text: 'Inténtalo de nuevo en unos segundos.' })
      }
      showErrorFeedback()
    } finally {
      inFlight.current = false
      if (!succeeded && mounted.current) setStatus('idle')
    }
  }
  function fillDemo(role: 'owner' | 'worker') {
    const account = demoAccounts.find(account => account.role === role)
    if (!account) return
    setValues({ identifier: account.username, username: '', email: '', password: demoPassword, confirmPassword: '' })
    setServerErrors({})
    setSubmitted(false)
    setTouched({})
    setNotice(null)
  }

  const contentState = pending ? 'pending' : success ? 'success' : cooldownActive ? 'cooldown' : 'idle'
  const buttonLabel = pending
    ? (isRegistration ? 'Creando cuenta…' : 'Ingresando…')
    : success
      ? (isRegistration ? 'Cuenta creada' : 'Acceso concedido')
      : cooldownActive
        ? `Reintenta en ${cooldownSeconds} s`
        : (isRegistration ? 'Crear cuenta' : 'Ingresar')
  const entrance = {
    initial: { opacity: 0, height: 0, y: reduce ? 0 : 8 },
    animate: { opacity: 1, height: 'auto' as const, y: 0 },
    exit: { opacity: 0, height: 0, y: reduce ? 0 : -8 },
    transition: { duration: reduce ? duration.micro : duration.panel, ease: ease.out },
  }
  const rise = (index: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: REVEAL_START + staggerDelay(index), duration: 0.45, ease: ease.out },
  })

  return <>
    <motion.form ref={formRef} className={styles.form} noValidate onSubmit={handleSubmit}
      aria-busy={pending} animate={shakeControls}>
      <div className={styles.serverRegion} aria-live="polite" aria-atomic="true">
        {notice && <Notice ref={noticeRef} tabIndex={-1} tone={notice.tone} title={notice.title}>{notice.text}</Notice>}
        {cooldownActive && <Notice ref={noticeRef} tabIndex={-1} tone="warning" title="Hicimos una pausa de seguridad">
          Después de 5 intentos fallidos, espera 30 segundos antes de volver a intentarlo.
        </Notice>}
      </div>
      {cooldownActive && <p className={styles.cooldown} role="timer" aria-live="off">
        <Clock3 size={18} aria-hidden="true" />Podrás intentarlo de nuevo en <strong>{cooldownSeconds} s</strong>.
      </p>}

      <motion.div className={styles.slot} {...rise(0)}>
        <AnimatePresence initial={false} mode="popLayout">
          {isRegistration ? <motion.div key="register-identity" className={styles.registerFields} {...entrance}>
            <TextField label="Usuario" autoComplete="username" autoCapitalize="none" spellCheck={false}
              maxLength={20} leadingIcon={UserRound} {...fieldProps('username')} />
            <TextField label="Correo electrónico" type="email" autoComplete="email" inputMode="email"
              autoCapitalize="none" spellCheck={false} leadingIcon={Mail} {...fieldProps('email')} />
          </motion.div> : <motion.div key="login-identifier" className={styles.animatedField} {...entrance}>
            <TextField label="Usuario o correo" autoComplete="username" autoCapitalize="none" spellCheck={false}
              leadingIcon={UserRound} {...fieldProps('identifier')} />
          </motion.div>}
        </AnimatePresence>
      </motion.div>

      <motion.div className={styles.slot} {...rise(1)}><motion.div className={styles.passwordBlock} layout={!reduce}>
        <TextField id={passwordId} label="Contraseña" type="password" leadingIcon={Lock}
          autoComplete={isRegistration ? 'new-password' : 'current-password'}
          aria-describedby={[isRegistration && strengthId, capsLockField === 'password' && `${passwordId}-caps`].filter(Boolean).join(' ') || undefined}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => checkCapsLock('password', event)}
          onKeyUp={(event: KeyboardEvent<HTMLInputElement>) => checkCapsLock('password', event)}
          {...fieldProps('password')} />
        {isRegistration && <PasswordStrengthMeter id={strengthId} strength={strength} />}
        {capsLockField === 'password' && <p id={`${passwordId}-caps`} className={styles.capsWarning} role="status">
          <TriangleAlert size={17} aria-hidden="true" />Bloq Mayús está activado.
        </p>}
      </motion.div></motion.div>

      <AnimatePresence initial={false}>
        {!isRegistration && <motion.div key="login-extras" className={styles.animatedField} {...entrance}>
          <motion.div className={styles.extras} {...rise(2)}>
            <label className={styles.remember}>
              <input type="checkbox" name="remember" checked={remember} disabled={busy}
                onChange={event => setRemember(event.target.checked)} />
              <span className={styles.checkbox} aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
              Recordarme
            </label>
            <button type="button" className={styles.linkButton} aria-expanded={recoveryOpen} aria-controls={`${formId}-recovery`}
              onClick={() => setRecoveryOpen(open => !open)}>
              ¿Olvidaste tu contraseña?
            </button>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
      <div id={`${formId}-recovery`} className={styles.recoveryRegion} aria-live="polite">
        <AnimatePresence initial={false}>
          {!isRegistration && recoveryOpen && <motion.div key="recovery" className={styles.animatedField} {...entrance}>
            <div className={styles.recovery}>
              <Info className={styles.recoveryIcon} size={18} strokeWidth={2} aria-hidden="true" />
              <div>
                <p className={styles.recoveryTitle}>Recuperación no disponible todavía</p>
                <p>En la demostración aún no se puede restablecer la contraseña. Usa una cuenta de demostración o crea una cuenta nueva.</p>
              </div>
              <button type="button" className={styles.recoveryClose} aria-label="Cerrar aviso" onClick={() => setRecoveryOpen(false)}>
                <X size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </motion.div>}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {isRegistration && <motion.div key="confirm-password" className={styles.animatedField} {...entrance}>
          <TextField id={confirmPasswordId} label="Confirmar contraseña" type="password" autoComplete="new-password"
            leadingIcon={LockKeyhole}
            aria-describedby={capsLockField === 'confirmPassword' ? `${confirmPasswordId}-caps` : undefined}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => checkCapsLock('confirmPassword', event)}
            onKeyUp={(event: KeyboardEvent<HTMLInputElement>) => checkCapsLock('confirmPassword', event)}
            {...fieldProps('confirmPassword')} />
          {capsLockField === 'confirmPassword' && <p id={`${confirmPasswordId}-caps`} className={styles.capsWarning} role="status">
            <TriangleAlert size={17} aria-hidden="true" />Bloq Mayús está activado.
          </p>}
        </motion.div>}
      </AnimatePresence>

      <motion.div className={styles.slot} {...rise(3)}><motion.div layout={!reduce}>
        <Button type="submit" variant="primary" fullWidth disabled={busy || cooldownActive}
          aria-busy={pending} className={[styles.submit, success && styles.submitSuccess].filter(Boolean).join(' ')}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={contentState} className={styles.submitContent}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.88 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.88 }} transition={{ duration: duration.micro, ease: ease.out }}>
              {pending && <Loader2 className={styles.spinner} size={19} strokeWidth={2} aria-hidden="true" />}
              {success && <SuccessCheck />}
              {cooldownActive && !busy && <Clock3 size={18} aria-hidden="true" />}
              <span>{buttonLabel}</span>
            </motion.span>
          </AnimatePresence>
        </Button>
      </motion.div></motion.div>
    </motion.form>

    {!isRegistration && isDemoMode && <motion.details className={styles.demo} {...rise(4)}>
      <summary>
        <span className={styles.demoIcon} aria-hidden="true"><UsersRound size={16} strokeWidth={2} /></span>
        <span className={styles.demoSummaryText}>Cuentas de demostración</span>
        <ChevronDown className={styles.demoChevron} size={18} strokeWidth={2} aria-hidden="true" />
      </summary>
      <div className={styles.demoContent}>
        <p>Elige un perfil para completar el formulario. Contraseña para ambos: <strong>{demoPassword}</strong>.</p>
        <div className={styles.demoActions}>
          {demoAccounts.map(account => <Button key={account.id} variant="secondary" disabled={busy || cooldownActive}
            onClick={() => fillDemo(account.role)}>
            <span>{account.role === 'owner' ? 'Dueña' : 'Trabajador'}</span>
            <span className={styles.demoUsername}>{account.username}</span>
          </Button>)}
        </div>
      </div>
    </motion.details>}
    {isRegistration && <p className={styles.note}>Las cuentas de trabajador se crean por invitación del dueño de la finca. Esa función llegará cuando el backend la ofrezca.</p>}
  </>
}
