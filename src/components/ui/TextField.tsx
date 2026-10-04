import { useId, useState, type InputHTMLAttributes } from 'react'
import { CircleAlert, Eye, EyeOff } from 'lucide-react'
import styles from './TextField.module.css'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

export function TextField({ label, hint, error, id, type = 'text', required, disabled,
  className, 'aria-describedby': describedBy, ...props }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [passwordVisible, setPasswordVisible] = useState(false)
  const isPassword = type === 'password'
  const ToggleIcon = passwordVisible ? EyeOff : Eye
  const descriptionIds = [describedBy, hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ')

  return <div className={styles.field}>
    <label className={styles.label} htmlFor={inputId}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    <div className={styles.control}>
      <input {...props} id={inputId} type={isPassword && passwordVisible ? 'text' : type}
        required={required} disabled={disabled} aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={descriptionIds || undefined}
        className={[styles.input, isPassword && styles.password, className].filter(Boolean).join(' ')} />
      {isPassword && <button type="button" className={styles.toggle} disabled={disabled}
        aria-label="Mostrar contraseña" aria-pressed={passwordVisible} aria-controls={inputId}
        onClick={() => setPasswordVisible(visible => !visible)}>
        <ToggleIcon size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>}
    </div>
    {hint && <p id={`${inputId}-hint`} className={styles.hint}>{hint}</p>}
    {error && <p id={`${inputId}-error`} className={styles.error}>
      <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />{error}
    </p>}
  </div>
}
