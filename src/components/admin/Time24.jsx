function digitsToTime(raw) {
  const digits = String(raw).replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

export function normalizeTime(value, fallback = '') {
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  if (!match) return fallback
  const hour = Math.min(23, Number(match[1]))
  const minute = Math.min(59, Number(match[2] || '0'))
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export default function Time24({ value, onChange, placeholder = '09:00', label }) {
  return (
    <input
      className="admin-time"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      maxLength={5}
      aria-label={label ?? 'Orario 24 ore'}
      value={value}
      onChange={(e) => onChange(digitsToTime(e.target.value))}
      onBlur={() => {
        if (!value.trim()) {
          onChange('')
          return
        }
        onChange(normalizeTime(value, value))
      }}
    />
  )
}
