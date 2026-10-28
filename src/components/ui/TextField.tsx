import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { CircleAlert, Eye, EyeOff, type LucideIcon } from 'lucide-react'
import styles from './TextField.module.css'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
  trailing?: ReactNode
  /** Decorative icon shown inside the input, before the text. */
  leadingIcon?: LucideIcon
  /** Custom leading content; takes precedence over leadingIcon. */
  leading?: ReactNode
}

export function TextField({ label, hint, error, trailing, leading, leadingIcon: LeadingIcon, id, type = 'text',
  required, disabled, className, 'aria-describedby': describedBy, ...props }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [passwordVisible, setPasswordVisible] = useState(false)
  const isPassword = type === 'password'
  const ToggleIcon = passwordVisible ? EyeOff : Eye
  const descriptionIds = [describedBy, hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ')
  const passwordToggle = isPassword ? <button type="button" className={styles.toggle} disabled={disabled}
    aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    aria-pressed={passwordVisible} aria-controls={inputId}
    onClick={() => setPasswordVisible(visible => !visible)}>
    <ToggleIcon size={20} strokeWidth={1.75} aria-hidden="true" />
  </button> : null
  const trailingContent = trailing ?? passwordToggle
  const leadingContent = leading ?? (LeadingIcon ? <LeadingIcon size={18} strokeWidth={1.75} aria-hidden="true" /> : null)

  return <div className={styles.field}>
    <label className={styles.label} htmlFor={inputId}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    <div className={styles.control}>
      <input {...props} id={inputId} type={isPassword && passwordVisible ? 'text' : type}
        required={required} disabled={disabled} aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={descriptionIds || undefined}
        className={[styles.input, trailingContent && styles.hasTrailing, leadingContent && styles.hasLeading, className]
          .filter(Boolean).join(' ')} />
      {leadingContent && <span className={styles.leading} aria-hidden="true">{leadingContent}</span>}
      {trailingContent && <div className={styles.trailing}>{trailingContent}</div>}
    </div>
    {hint && <p id={`${inputId}-hint`} className={styles.hint}>{hint}</p>}
    {error && <p id={`${inputId}-error`} className={styles.error}>
      <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />{error}
    </p>}
  </div>
}
