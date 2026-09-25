import { EVENT_COLORS, WEEKDAYS, monthCells } from '../../store/bookingStore.js'

export function CalDirIcon({ dir }) {
  const isPrev = dir === 'prev'
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d={isPrev ? 'M10 3.2 5.2 8 10 12.8' : 'M6 3.2 10.8 8 6 12.8'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function CalendarMonth({
  year,
  month,
  onPrev,
  onNext,
  onSelect,
  selected = [],
  blocked = [],
  disabled = [],
  markers = {},
  mode = 'select',
}) {
  const title = new Date(year, month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const cells = monthCells(year, month)

  return (
    <div className="cal">
      <div className="cal-nav">
        <button type="button" className="cal-dir" onClick={onPrev} aria-label="Mese precedente">
          <CalDirIcon dir="prev" />
        </button>
        <strong>{title}</strong>
        <button type="button" className="cal-dir" onClick={onNext} aria-label="Mese successivo">
          <CalDirIcon dir="next" />
        </button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((day) => (
          <span className="cal-wd" key={day.id}>
            {day.label}
          </span>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <span className="cal-cell is-empty" key={`e-${i}`} />
          const isSel = selected.includes(iso)
          const isBlock = blocked.includes(iso)
          const isOff = disabled.includes(iso)
          const dots = markers[iso] ?? []
          return (
            <button
              key={iso}
              type="button"
              className={`cal-cell${isSel ? ' is-sel' : ''}${isBlock ? ' is-block' : ''}${isOff ? ' is-off' : ''}`}
              onClick={() => onSelect?.(iso)}
              disabled={mode === 'select' && isOff}
            >
              <span>{Number(iso.slice(8))}</span>
              {dots.length ? (
                <i className="cal-dots">
                  {dots.slice(0, 4).map((dot) => (
                    <b
                      key={dot.id}
                      style={{
                        background: EVENT_COLORS[dot.eventId] ?? '#002ec1',
                        opacity: dot.status === 'active' ? 1 : 0.35,
                      }}
                    />
                  ))}
                </i>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
