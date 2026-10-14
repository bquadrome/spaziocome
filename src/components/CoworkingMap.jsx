import { useEffect, useState } from 'react'

// Piantina Coworking: 20 postazioni. Il numero del posto corrisponde all'ordine delle postazioni in admin.
export const COWORKING_ID = 'coworking'
const VIEW = { x: 130, y: 0, w: 1700, h: 1060 }

const SEATS = [
  { n: 20, x: 487, y: 214 },
  { n: 19, x: 698, y: 214 },
  { n: 18, x: 909, y: 214 },
  { n: 17, x: 1120, y: 214 },
  { n: 15, x: 390, y: 605 },
  { n: 13, x: 538, y: 605 },
  { n: 11, x: 730, y: 605 },
  { n: 9, x: 878, y: 605 },
  { n: 7, x: 1069, y: 605 },
  { n: 5, x: 1217, y: 605 },
  { n: 3, x: 1408, y: 605 },
  { n: 1, x: 1557, y: 605 },
  { n: 16, x: 390, y: 927 },
  { n: 14, x: 538, y: 927 },
  { n: 12, x: 730, y: 927 },
  { n: 10, x: 878, y: 927 },
  { n: 8, x: 1069, y: 927 },
  { n: 6, x: 1217, y: 927 },
  { n: 4, x: 1408, y: 927 },
  { n: 2, x: 1557, y: 927 },
]

export const COWORKING_SEATS = SEATS.length

export function usesCoworkingMap(eventId, stations) {
  return eventId === COWORKING_ID && (stations ?? []).length === COWORKING_SEATS
}

const DESKS = [
  { x: 410, y: 104, w: 780, h: 108 },
  { x: 410, y: 515, w: 107, h: 498 },
  { x: 750, y: 515, w: 107, h: 498 },
  { x: 1090, y: 515, w: 107, h: 498 },
  { x: 1428, y: 515, w: 107, h: 498 },
  { x: 1674, y: 515, w: 106, h: 498 },
]

// Su schermi stretti la piantina ruota di 90° in senso antiorario: ingresso in alto, posti più distanziati.
function useVertical() {
  const query = '(max-width: 560px)'
  const [vertical, setVertical] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return undefined
    const onChange = () => setVertical(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return vertical
}

function place(x, y, vertical) {
  const rx = x - VIEW.x
  const ry = y - VIEW.y
  if (!vertical) return { left: `${(rx / VIEW.w) * 100}%`, top: `${(ry / VIEW.h) * 100}%` }
  return { left: `${(ry / VIEW.h) * 100}%`, top: `${((VIEW.w - rx) / VIEW.w) * 100}%` }
}

function Plan({ vertical }) {
  const size = vertical ? `0 0 ${VIEW.h} ${VIEW.w}` : `0 0 ${VIEW.w} ${VIEW.h}`
  const turn = vertical
    ? `translate(0 ${VIEW.w}) rotate(-90) translate(${-VIEW.x} ${-VIEW.y})`
    : `translate(${-VIEW.x} ${-VIEW.y})`
  return (
    <svg className="cw-plan" viewBox={size} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g transform={turn}>
        <path className="cw-floor" d="M395 104H1780V1013H157Z" />
        {DESKS.map((desk) => (
          <rect key={`${desk.x}-${desk.y}`} className="cw-desk" x={desk.x} y={desk.y} width={desk.w} height={desk.h} rx="18" />
        ))}
        <path className="cw-wall" d="M395 104H1350M1446 104H1780V190M1780 398V1013H157L395 104" />
        <path className="cw-door" d="M1350 104A96 96 0 0 1 1446 8" />
        <path className="cw-door-leaf" d="M1446 104V8" />
        <path className="cw-door" d="M1676 190A104 104 0 0 0 1780 294M1676 398A104 104 0 0 1 1780 294" />
        <path className="cw-door-leaf" d="M1780 190H1676M1780 398H1676" />
      </g>
      {vertical ? (
        <text className="cw-label" x={294 - VIEW.y} y={VIEW.w - (1600 - VIEW.x)} textAnchor="middle">
          Ingresso
        </text>
      ) : (
        <text className="cw-label" x={1650 - VIEW.x} y={306 - VIEW.y} textAnchor="end">
          Ingresso
        </text>
      )}
    </svg>
  )
}

export default function CoworkingMap({ stations, value, onChange, isBusy = () => false, ready = true, preview = false }) {
  const vertical = useVertical()
  const list = stations ?? []
  const states = SEATS.map((seat) => {
    const station = list[seat.n - 1]
    const busy = ready && station ? isBusy(station.id) : false
    return { ...seat, station, busy, on: !!station && station.id === value }
  })
  const free = states.filter((seat) => seat.station && !seat.busy).length
  const selected = states.find((seat) => seat.on)

  return (
    <div className="cw">
      <div className={`cw-map${ready ? '' : ' is-idle'}${vertical ? ' is-vertical' : ''}`}>
        <div className="cw-stage">
          <Plan vertical={vertical} />
          {states.map((seat) => (
            <button
              key={seat.n}
              type="button"
              className={`cw-seat${seat.on ? ' is-on' : ''}${seat.busy ? ' is-busy' : ''}`}
              style={place(seat.x, seat.y, vertical)}
              disabled={!ready || !seat.station || seat.busy}
              aria-pressed={seat.on}
              aria-label={`${seat.station?.label ?? `Postazione ${seat.n}`}${seat.busy ? ', occupata' : seat.on ? ', selezionata' : ''}`}
              title={seat.busy ? `${seat.station?.label} · occupata` : seat.station?.label}
              onClick={() => onChange(seat.on && !preview ? '' : seat.station.id)}
            >
              {seat.n}
            </button>
          ))}
        </div>
      </div>

      {preview ? null : (
        <div className="cw-foot">
          <ul className="cw-legend">
            <li>
              <i className="is-free" /> Libera
            </li>
            <li>
              <i className="is-on" /> Selezionata
            </li>
            <li>
              <i className="is-busy" /> Occupata
            </li>
          </ul>
          <p className="cw-status" aria-live="polite">
            {!ready
              ? 'Scegli giorno e orario per vedere le postazioni libere.'
              : selected
                ? `${selected.station.label} selezionata`
                : `${free} ${free === 1 ? 'postazione libera' : 'postazioni libere'} su ${SEATS.length}`}
          </p>
        </div>
      )}
    </div>
  )
}
