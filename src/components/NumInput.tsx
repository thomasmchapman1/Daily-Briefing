import { useEffect, useState } from 'react'

interface Props {
  value: number | null | undefined
  onChange: (value: number | null) => void
  placeholder?: string
  /** Decimal keypad (weights, miles) or whole numbers (reps, heart rate). */
  decimal?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

/** A number field that lets you type freely ("195.") and reports a number, or null when empty. */
export function NumInput({ value, onChange, placeholder, decimal = true, id, className = '', ...rest }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value))

  // Follow outside changes (a synced edit, a tick that filled in the plan's numbers).
  useEffect(() => {
    setText((t) => (Number(t) === value && t !== '' ? t : value == null ? '' : String(value)))
  }, [value])

  return (
    <input
      id={id}
      className={`input tnum ${className}`}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
      placeholder={placeholder}
      value={text}
      aria-label={rest['aria-label']}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.')
        if (!/^\d*\.?\d*$/.test(t)) return
        setText(t)
        if (t === '' || t === '.') onChange(null)
        else if (Number.isFinite(Number(t))) onChange(Number(t))
      }}
    />
  )
}
